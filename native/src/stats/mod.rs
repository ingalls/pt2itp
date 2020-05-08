use neon::prelude::*;
use super::stream::GeoStream;
use std::collections::HashMap;
use geo::algorithm::contains::Contains;

mod explode;
mod count;
mod tree;

#[derive(Serialize, Deserialize, Debug)]
struct StatsArgs {
    input: Option<String>,
    bounds: Option<String>
}

impl StatsArgs {
    pub fn new() -> Self {
        StatsArgs {
            input: None,
            bounds: None
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Stats {
    pub feats: i64, // Total number of features
    pub clusters: i64, // Total number of addr/network clusters
    pub invalid: i64, // Total number of unrecognized features (not counted in feats)
    pub addresses: i64, // Total number of address points in clusters/orphans
    pub intersections: i64, // Total number of address features
    pub address_orphans: i64, // Total number of address orphans
    pub network_orphans: i64, // Total number of network orphans
    pub bounds: HashMap<String, StatsBound>
}

impl Stats {
    fn new() -> Self {
        Stats {
            feats: 0,
            clusters: 0,
            invalid: 0,
            addresses: 0,
            intersections: 0,
            address_orphans: 0,
            network_orphans: 0,
            bounds: HashMap::new()
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct StatsBound {
    pub names: Vec<String>,
    pub synonyms: Vec<String>,
    pub addresses: i64,
    pub intersections: i64,
    pub custom: StatsCustom
}

impl StatsBound {
    fn new() -> Self {
        StatsBound {
            names: Vec::new(),
            synonyms: Vec::new(),
            addresses: 0,
            intersections: 0,
            custom: StatsCustom::new()
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct StatsCustom {
    pub postcodes: i64,
    pub accuracy: StatsAccuracy
}

impl StatsCustom {
    pub fn new() -> Self {
        StatsCustom {
            postcodes: 0,
            accuracy: StatsAccuracy::new()
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct StatsAccuracy {
    pub rooftop: i64,
    pub parcel: i64,
    pub point: i64
}

impl StatsAccuracy {
    pub fn new() -> Self {
        StatsAccuracy {
            rooftop: 0,
            parcel: 0,
            point: 0
        }
    }
}

pub fn stats(mut cx: FunctionContext) -> JsResult<JsValue> {
    let args: StatsArgs = match cx.argument_opt(0) {
        None => StatsArgs::new(),
        Some(arg) => {
            if arg.is_a::<JsUndefined>() || arg.is_a::<JsNull>() {
                StatsArgs::new()
            } else {
                let arg_val = cx.argument::<JsValue>(0)?;
                neon_serde::from_value(&mut cx, arg_val)?
            }
        }
    };

    let mut boundmap: HashMap<String, StatsBound> = HashMap::new();

    let is_bounded = args.bounds.is_some();

    let tree = if is_bounded {
        println!("ok - loading bounds");
        tree::create(args.bounds, &mut boundmap)
    } else {
        rstar::RTree::bulk_load(vec![])
    };

    let mut stats = Stats::new();

    for geo in GeoStream::new(args.input) {
        let feat = match geo {
            geojson::GeoJson::Feature(feat) => feat,
            _ => {
                stats.invalid += 1;
                continue;
            }
        };

        if feat.geometry.is_none() {
            stats.invalid += 1;
            continue;
        }

        match feat.geometry.as_ref().unwrap().value {
            geojson::Value::MultiPoint(_)
            | geojson::Value::GeometryCollection(_) => {
                stats.feats += 1;
            },
            _ => {
                stats.invalid += 1;
                continue;
            }
        };

        let addr = count::addresses(&feat);
        let intsec = count::intersections(&feat);
        let net = count::networks(&feat);

        stats.addresses += addr;
        stats.intersections += intsec;

        if addr == 0 && net == 0 && intsec == 0 {
            stats.invalid += 1;
        } else if addr > 0 && net > 0 {
            stats.clusters += 1;
        } else if addr > 0 {
            stats.address_orphans += 1;
        } else if net > 0 {
            stats.network_orphans += 1;
        }

        if is_bounded {
            let names: Vec<String> = match &feat.properties {
                None => vec![],
                Some(ref props) => match props.get(&String::from("carmen:text")) {
                    None => vec![],
                    Some(ref names) => match names {
                        serde_json::Value::String(string) => {
                            string.split(',').map(|name| {
                                String::from(name)  
                            }).collect()
                        },
                        _ => vec![]
                    }
                }
            };

            for addr in explode::addresses(&feat) {
                for bound in tree.locate_all_at_point(&[addr.geom[0], addr.geom[1]]) {
                    if bound.geom.contains(&geo::Point::new(addr.geom[0], addr.geom[1])) {
                        let mut bm_item = boundmap.get_mut(&bound.name).unwrap();

                        bm_item.addresses += 1;

                        if !names.is_empty() {
                            if !bm_item.names.contains(&names[0]) {
                                bm_item.names.push(names[0].clone());
                            }

                            if names.len() > 1 {
                                for ele in 1..names.len() {
                                    if !bm_item.synonyms.contains(&names[ele]) {
                                        bm_item.synonyms.push(names[ele].clone());
                                    }
                                }
                            }
                        }

                        if addr.postcode.is_some() {
                            bm_item.custom.postcodes += 1;
                        }

                        match &addr.accuracy {
                            Some(accuracy) => {
                                if accuracy == &String::from("rooftop") {
                                    bm_item.custom.accuracy.rooftop += 1;
                                } else if accuracy == &String::from("point") {
                                    bm_item.custom.accuracy.point += 1;
                                } else if accuracy == &String::from("parcel") {
                                    bm_item.custom.accuracy.parcel += 1;
                                } else {
                                    panic!("accuracy must be rooftop/parcel/point not {}", accuracy);
                                }
                            },
                            None => ()
                        };
                    }
                };
            }

            for intersection in explode::intersections(&feat) {
                for bound in tree.locate_all_at_point(&[intersection.geom[0], intersection.geom[1]]) {
                    if bound.geom.contains(&geo::Point::new(intersection.geom[0], intersection.geom[1])) {
                        let mut bm_item = boundmap.get_mut(&bound.name).unwrap();
                        bm_item.intersections += 1;
                    }
                };
            }
        }
    }

    for value in boundmap.values_mut() {
        value.names.sort();
        value.synonyms.sort();
    }

    stats.bounds = boundmap;

    Ok(neon_serde::to_value(&mut cx, &stats)?)
}

use neon::prelude::*;
use super::stream::GeoStream;
use std::collections::HashMap;
use std::convert::TryInto;
use geo::algorithm::{
    bounding_rect::BoundingRect
};

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
    feats: i64, // Total number of features
    clusters: i64, // Total number of addr/network clusters
    invalid: i64, // Total number of unrecognized features (not counted in feats)
    addresses: i64, // Total number of address points in clusters/orphans
    intersections: i64, // Total number of address features
    address_orphans: i64, // Total number of address orphans
    network_orphans: i64 // Total number of network orphans
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
            network_orphans: 0
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

    let boundmap: HashMap<i64, String> = HashMap::new();

    if args.bounds.is_some() {
        let bounds_stream = GeoStream::new(args.bounds);

        for bound in bounds_stream {
            let feat = match bound {
                geojson::GeoJson::Feature(feat) => feat,
                _ => panic!("Bounds must be (Multi)Polygon Features")
            };

            let geom: geo::Geometry<f64> = feat.geometry.unwrap().value.try_into().unwrap();

            let geom = match geom {
                geo::Geometry::Polygon(poly) => geo::MultiPolygon(vec![poly]),
                geo::Geometry::MultiPolygon(mpoly) => mpoly,
                _ => panic!("Bound must be (Multi)Polygon Features")
            };

            let bound = geom.bounding_rect();
        }
    }

    let feat_stream = GeoStream::new(args.input);

    let mut stats = Stats::new();

    for geo in feat_stream {
        match geo {
            geojson::GeoJson::Feature(feat) => {
                stats.feats = stats.feats + 1;

                if feat.geometry.is_none() { continue; }

                match feat.geometry.as_ref().unwrap().value {
                    geojson::Value::MultiPoint(_) => {
                        let addr = count_addresses(&feat);
                        let intsec = count_intersections(&feat);

                        if intsec > 0 {
                            stats.intersections = stats.intersections + intsec;
                        } if addr > 0 {
                            stats.addresses = stats.addresses + addr;
                            stats.address_orphans = stats.address_orphans + 1;
                        } else {
                            stats.invalid = stats.invalid + 1;
                        }
                    },
                    geojson::Value::GeometryCollection(_) => {
                        let addr = count_addresses(&feat);
                        let net = count_networks(&feat);
                        let intsec = count_intersections(&feat);

                        if addr == 0 && net == 0 && intsec == 0 {
                            stats.invalid = stats.invalid + 1;
                        } else if addr > 0 && net > 0 {
                            stats.addresses = stats.addresses + count_addresses(&feat);

                            stats.clusters = stats.clusters + 1;
                        } else if addr > 0 {
                            stats.addresses = stats.addresses + count_addresses(&feat);

                            stats.address_orphans = stats.address_orphans + 1;
                        } else if net > 0 {
                            stats.network_orphans = stats.network_orphans + 1;
                        }

                        stats.intersections = stats.intersections + intsec;
                    },
                    _ => {
                        stats.invalid = stats.invalid + 1;
                    }
                }
            },
            _ => {
                stats.invalid = stats.invalid + 1;
            }
        };
    }

    Ok(neon_serde::to_value(&mut cx, &stats)?)
}

fn count_addresses(feat: &geojson::Feature) -> i64 {
    match feat.properties {
        None => 0,
        Some(ref props) => match props.get(&String::from("carmen:addressnumber")) {
            None => 0,
            Some(prop) => match prop.as_array() {
                None => 0,
                Some(ref array) => {
                    if array.len() == 0 {
                        return 0;
                    }

                    let mut addr = 0;

                    for ele in array.iter() {
                        if ele.is_array() {
                            for elenest in ele.as_array().unwrap() {
                                if elenest.is_number() || elenest.is_string() {
                                    addr = addr + 1;
                                }
                            }
                        } else if ele.is_number() || ele.is_string() {
                            addr = addr + 1;
                        }
                    }

                    addr
                }
            }
        }
    }
}

fn count_intersections(feat: &geojson::Feature) -> i64 {
    match feat.properties {
        None => 0,
        Some(ref props) => match props.get(&String::from("carmen:intersections")) {
            None => 0,
            Some(prop) => match prop.as_array() {
                None => 0,
                Some(ref array) => {
                    if array.len() == 0 {
                        return 0;
                    }

                    let mut intsecs = 0;

                    for ele in array.iter() {
                        if ele.is_array() {
                            for elenest in ele.as_array().unwrap() {
                                if elenest.is_number() || elenest.is_string() {
                                    intsecs = intsecs + 1;
                                }
                            }
                        } else if ele.is_string() {
                            intsecs = intsecs + 1;
                        }
                    }

                    intsecs
                }
            }
        }
    }
}

fn count_networks(feat: &geojson::Feature) -> i64 {
    match feat.properties {
        None => 0,
        Some(ref props) => {
            if props.contains_key(&String::from("carmen:rangetype")) {
                1
            } else {
                0
            }
        }
    }
}

use neon::prelude::*;
use super::stream::GeoStream;
use std::collections::HashMap;

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

    let mut tree = match is_bounded {
        true => tree::create(args.bounds, &mut boundmap),
        false => rstar::RTree::bulk_load(vec![])
    };

    let mut stats = Stats::new();

    for geo in GeoStream::new(args.input) {
        let feat = match geo {
            geojson::GeoJson::Feature(feat) => feat,
            _ => {
                stats.invalid = stats.invalid + 1;
                continue;
            }
        };

        if feat.geometry.is_none() {
            stats.invalid = stats.invalid + 1;
            continue;
        }

        stats.feats = stats.feats + 1;

        match &feat.geometry.as_ref().unwrap().value {
            geojson::Value::MultiPoint(mp) => {
                let addr = count::addresses(&feat);
                let intsec = count::intersections(&feat);
                if intsec > 0 {
                    stats.intersections = stats.intersections + intsec;
                } if addr > 0 {
                    stats.addresses = stats.addresses + addr;
                    stats.address_orphans = stats.address_orphans + 1;
                } else {
                    stats.invalid = stats.invalid + 1;
                }
            },
            geojson::Value::GeometryCollection(gc) => {
                for geom in gc {

                    /*
                    for mp_it in 0..mp.len() {
                        let pt = &mp[mp_it];

                        println!("{}, {}", pt[0], pt[1]);
                        for bound in tree.locate_all_at_point(&[pt[0], pt[1]]) {
                            println!("{:?}", bound.name);
                        }
                    }
                    */
                }

                let addr = count::addresses(&feat);
                let net = count::networks(&feat);
                let intsec = count::intersections(&feat);

                if addr == 0 && net == 0 && intsec == 0 {
                    stats.invalid = stats.invalid + 1;
                } else if addr > 0 && net > 0 {
                    stats.addresses = stats.addresses + count::addresses(&feat);

                    stats.clusters = stats.clusters + 1;
                } else if addr > 0 {
                    stats.addresses = stats.addresses + count::addresses(&feat);

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
    }

    Ok(neon_serde::to_value(&mut cx, &stats)?)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Stats {
    feats: i64, // Total number of features
    clusters: i64, // Total number of addr/network clusters
    invalid: i64, // Total number of unrecognized features (not counted in feats)
    addresses: i64, // Total number of address points in clusters/orphans
    intersections: i64, // Total number of address features
    address_orphans: i64, // Total number of address orphans
    network_orphans: i64, // Total number of network orphans
    custom: StatsCustom
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
            custom: StatsCustom::new()
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct StatsBound {
    addresses: i64,
    intersections: i64,
    custom: StatsCustom
}

impl StatsBound {
    fn new() -> Self {
        StatsBound {
            addresses: 0,
            intersections: 0,
            custom: StatsCustom::new()
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct StatsCustom {
    postcodes: i64,
    accuracy: StatsAccuracy
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
    rooftop: i64,
    parcel: i64,
    point: i64
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

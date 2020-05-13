#[derive(Debug, PartialEq)]
pub struct StatAddress {
    pub geom: Vec<f64>,
    pub number: String,
    pub accuracy: Option<String>,
    pub postcode: Option<String>
}

#[derive(Debug, PartialEq)]
pub struct StatIntersection {
    pub geom: Vec<f64>
}

///
/// Take a GeoJSON feature and explode it into a vector of individual address points
///
pub fn addresses(feat: &geojson::Feature) -> Vec<StatAddress> {
    let mut addrs = Vec::new();

    let (numbers, ele) = match feat.properties {
        None => {
            return addrs;
        },
        Some(ref props) => match props.get(&String::from("carmen:addressnumber")) {
            None => {
                return addrs;
            },
            Some(ref array) => {
                if !array.is_array() {
                    return addrs;
                }

                let array = array.as_array().unwrap();

                if array.is_empty() {
                    return addrs;
                }

                if array[0].is_number() || array[0].is_string() {
                    // Feature is a MultiPoint
                    (array, 0)
                } else {
                    // Feature is a GeometryCollection
                    let mut ele = 0;
                    for arr in array {
                        if arr.is_array() && !arr.as_array().unwrap().is_empty() {
                            break;
                        } else {
                            ele += 1;
                        }
                    }

                    (array[ele].as_array().unwrap(), ele)
                }
            }
        }
    };

    let coords = match &feat.geometry {
        Some(geom) => match &geom.value {
            geojson::Value::MultiPoint(mp) => mp,
            geojson::Value::GeometryCollection(gc) => match &gc[ele].value {
                geojson::Value::MultiPoint(mp) => mp,
                _ => panic!("Expected MultiPoint geometry")
            }
            _ => panic!("Only MultiPoint & GeometryCollections are supported")
        },
        None => panic!("geometry required")
    };

    if coords.len() != numbers.len() {
        panic!("coordinate array must equal numbers array");
    }

    for ele in 0..numbers.len() {
        let stat = StatAddress {
            geom: coords[ele].clone(),
            number: match &numbers[ele] {
                serde_json::Value::String(string) => string.to_string(),
                serde_json::Value::Number(num) => num.to_string(),
                _ => panic!("Address numbers must be a string/numeric")
            },
            accuracy: match get_prop(&feat, "accuracy", ele.to_string()) {
                None => None,
                Some(serde_json::Value::String(string)) => Some(string),
                _ => panic!("accuracy property should be string")
            },
            postcode: match get_prop(&feat, "override:postcode", ele.to_string()) {
                None => None,
                Some(serde_json::Value::String(string)) => Some(string),
                Some(serde_json::Value::Number(num)) => Some(num.to_string()),
                _ => panic!("postcode property should be string/number")

            }
        };

        addrs.push(stat);
    }

    addrs
}

fn get_prop(feat: &geojson::Feature, key: impl ToString, ele: String) -> Option<serde_json::Value> {
    let key = key.to_string();
    match feat.properties {
        None => None,
        Some(ref props) => match props.get(&key) {
            Some(prop) => match get_override(props, &key, ele) {
                None => {
                    if prop.is_null() {
                        None
                    } else {
                        Some(prop.clone())
                    }
                },
                Some(override_prop) => Some(override_prop)
            },
            None => match get_override(props, &key, ele) {
                None => None,
                Some(override_prop) => Some(override_prop)
            }
        }
    }
}

fn get_override(props: &serde_json::Map<String, serde_json::Value>, key: &str, ele: String) -> Option<serde_json::Value> {
    match props.get(&String::from("carmen:addressprops")) {
        None => None,
        Some(ref props) => match props.get(&key) {
            None => None,
            Some(prop) => match prop.get(&ele) {
                None => None,
                Some(prop_value) => {
                    if prop_value.is_null() {
                        None
                    } else {
                        Some(prop_value.clone())
                    }
                }
            }
        }
    }
}

///
/// Take a GeoJSON feature and explode it into a vector of individual intersection geometries
///
pub fn intersections(feat: &geojson::Feature) -> Vec<StatIntersection> {
    let mut ints = Vec::new();

    match feat.properties {
        None => ints,
        Some(ref props) => match props.get(&String::from("carmen:intersections")) {
            None => ints,
            Some(ref array) => {
                if !array.is_array() {
                    return ints;
                }

                let array = array.as_array().unwrap();

                if array.is_empty() {
                    return ints;
                }

                let mut ele = 0;
                for arr in array {
                    if arr.is_array() && !arr.as_array().unwrap().is_empty() {
                        break;
                    } else {
                        ele += 1;
                    }
                }

                let coords = match &feat.geometry {
                    Some(geom) => match &geom.value {
                        geojson::Value::GeometryCollection(gc) => match &gc[ele].value {
                            geojson::Value::MultiPoint(mp) => mp,
                            _ => panic!("Expected MultiPoint geometry")
                        }
                        _ => panic!("Only GeometryCollections are supported for intersections")
                    },
                    None => panic!("geometry required")
                };

                for coord in coords {
                    let stat = StatIntersection {
                        geom: coord.clone()
                    };

                    ints.push(stat);
                }

                ints
            }
        }
    }
}

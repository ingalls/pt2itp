use crate::Address;

#[derive(Debug, PartialEq)]
pub struct StatAddress {
    geom: [f64; 2],
    accuracy: Option<String>,
    postcode: Option<String>
}

///
/// Take a GeoJSON feature and explode it into a vector of individual address points
///
pub fn addresses(feat: &geojson::Feature) -> Vec<StatAddress> {
    let addrs = Vec::new();

    let (numbers, coords) = match feat.properties {
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

                if array.len() == 0 {
                    return addrs;
                }

                if array[0].is_number() || array[0].is_string() {
                    (array, 0)
                } else {
                    let mut ele = 0;
                    for arr in array {
                        if arr.is_array() && arr.as_array().unwrap().len() > 0 {
                            break;
                        } else {
                            ele = ele + 1;
                        }
                    }

                    (array[ele].as_array().unwrap(), 0)
                }
            }
        }
    };

    println!("{:?}", addrs);

    addrs
}

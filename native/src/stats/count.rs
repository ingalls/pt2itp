pub fn addresses(feat: &geojson::Feature) -> i64 {
    match feat.properties {
        None => 0,
        Some(ref props) => match props.get(&String::from("carmen:addressnumber")) {
            None => 0,
            Some(prop) => match prop.as_array() {
                None => 0,
                Some(ref array) => {
                    if array.is_empty() {
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

pub fn intersections(feat: &geojson::Feature) -> i64 {
    match feat.properties {
        None => 0,
        Some(ref props) => match props.get(&String::from("carmen:intersections")) {
            None => 0,
            Some(prop) => match prop.as_array() {
                None => 0,
                Some(ref array) => {
                    if array.is_empty() {
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

pub fn networks(feat: &geojson::Feature) -> i64 {
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

use postgis::ewkb::AsEwkbPoint;
use postgis::ewkb::EwkbWrite;
use regex::{Regex, RegexSet};

use crate::{Context, Names, Name, hecate};

/// A representation of a single Address
#[derive(Debug)]
pub struct Address {
    /// An optional identifier for the address
    pub id: Option<i64>,

    pub version: i64,

    /// The address number, can be numeric or semi-numeric (100 vs 100a)
    pub number: String,

    /// Vector of all street name synonyms
    pub names: Names,

    /// String source/provider/timestamp for the given data
    pub source: String,

    /// Should the feature be output
    pub output: bool,

    /// Should the address feature be used to generate interpolation
    pub interpolate: bool,

    /// JSON representation of properties
    pub props: serde_json::Map<String, serde_json::Value>,

    /// Simple representation of Lng/Lat geometry
    pub geom: geojson::PointType
}

impl Address {
    pub fn new(feat: geojson::GeoJson, context: &Context) -> Result<Self, String> {
        let feat = match feat {
            geojson::GeoJson::Feature(feat) => feat,
            _ => { return Err(String::from("Not a GeoJSON Feature")); }
        };

        let mut props = match feat.properties {
            Some(props) => props,
            None => { return Err(String::from("Feature has no properties")); }
        };

        let number = get_number(&mut props)?;

        let version = match feat.foreign_members {
            Some(mut props) => get_version(&mut props)?,
            None => 0
        };

        let source = get_source(&mut props)?;
        let interpolate = get_interpolate(&mut props)?;
        let output = get_output(&mut props)?;

        let geom = match feat.geometry {
            Some(geom) => match geom.value {
                geojson::Value::Point(pt) => {
                    if pt.len() != 2 {
                        return Err(String::from("Geometry must have 2 coordinates"));
                    }

                    if pt[0] < -180.0 || pt[0] > 180.0 {
                        return Err(String::from("Geometry exceeds +/-180deg coord bounds"));
                    } else if pt[1] < -85.0 || pt[1] > 85.0 {
                        return Err(String::from("Geometry exceeds +/-85deg coord bounds"));
                    }

                    pt
                },
                _ => { return Err(String::from("Addresses must have Point geometry")); }
            },
            None => { return Err(String::from("Addresses must have geometry")); }
        };

        let mut names = Names::from_value(props.remove(&String::from("street")), &context)?;

        names.set_source(String::from("address"));

        let mut addr = Address {
            id: match feat.id {
                Some(geojson::feature::Id::Number(id)) => id.as_i64(),
                _ => None
            },
            number: number,
            version: version,
            names: names,
            output: output,
            source: source,
            interpolate: interpolate,
            props: props,
            geom: geom
        };

        addr.std()?;

        Ok(addr)
    }

    ///
    /// Construct an address instance via a Row JSON Value
    ///
    pub fn from_value(value: serde_json::Value) -> Result<Self, String> {
        let mut value = match value {
            serde_json::Value::Object(obj) => obj,
            _ => { return Err(String::from("Address::from_row value must be JSON Object")); }
        };

        let names: Names = match value.remove(&String::from("names")) {
            Some(names) => {
                let names: Vec<Name> = match serde_json::from_value(names) {
                    Ok(names) => names,
                    Err(err) => { return Err(format!("Names Conversion Error: {}", err.to_string())); }
                };

                Names {
                    names: names
                }
            },
            None => { return Err(String::from("names key/value is required")); }
        };

        let props = match value.remove(&String::from("props")) {
            Some(props) => match props {
                serde_json::Value::Object(obj) => obj,
                _ => { return Err(String::from("Address::from_row value must be JSON Object")); }
            },
            None => { return Err(String::from("props key/value is required")); }
        };

        let geom = match value.remove(&String::from("geom")) {
            Some(geom) => match geom {
                serde_json::value::Value::String(geom) => match geom.parse::<geojson::GeoJson>() {
                    Ok (geom) => match geom {
                        geojson::GeoJson::Geometry(geom) => match geom.value {
                            geojson::Value::Point(pt) => pt,
                            _ => { return Err(String::from("Geometry must be point type")); }
                        },
                        _ => { return Err(String::from("Geometry must be point type")); }
                    },
                    Err(err) => { return Err(format!("geom parse error: {}", err.to_string())); }
                },
                _ => { return Err(String::from("geom only supports TEXT type")); }
            },
            None => { return Err(String::from("geom key/value is required")); }
        };

        Ok(Address {
            id: get_id(&mut value)?,
            number: get_number(&mut value)?,
            version: get_version(&mut value)?,
            names: names,
            output: get_output(&mut value)?,
            source: get_source(&mut value)?,
            interpolate: get_interpolate(&mut value)?,
            props: props,
            geom: geom
        })
    }

    pub fn std(&mut self) -> Result<(), String> {
        self.number = self.number.to_lowercase();

        // Remove 1/2 Numbers from addresses as they are not currently supported
        lazy_static! {
            static ref HALF: Regex = Regex::new(r"\s1/2$").unwrap();
            static ref UNIT: Regex = Regex::new(r"^(?P<num>\d+)\s(?P<unit>[a-z])$").unwrap();
            static ref SUPPORTED: RegexSet = RegexSet::new(&[
                r"^\d+[a-z]?$",
                r"^(\d+)-(\d+)[a-z]?$",
                r"^(\d+)([nsew])(\d+)[a-z]?$",
                r"^([nesw])(\d+)([nesw]\d+)?$"
            ]).unwrap();
        }

        self.number = HALF.replace(self.number.as_str(), "").to_string();

        // Transform '123 B' = '123B' so it is supported
        self.number = UNIT.replace(self.number.as_str(), "$num$unit").to_string();

        if !SUPPORTED.is_match(self.number.as_str()) {
            return Err(String::from("Number is not a supported address/unit type"));
        }

        if self.number.len() > 10 {
            return Err(String::from("Number should not exceed 10 chars"));
        }

        Ok(())
    }

    ///
    ///Return a PG Copyable String of the feature
    ///
    ///name, number, source, props, geom
    ///
    pub fn to_tsv(self) -> String {
        let geom = postgis::ewkb::Point::new(self.geom[0], self.geom[1], Some(4326)).as_ewkb().to_hex_ewkb();

        format!("{id}\t{version}\t{names}\t{number}\t{source}\t{output}\t{props}\t{geom}\n",
            id = match self.id {
                None => String::from(""),
                Some(id) => id.to_string()
            },
            version = self.version,
            names = serde_json::to_string(&self.names.names).unwrap_or(String::from("")),
            output = self.output,
            number = self.number,
            source = self.source,
            props = serde_json::value::Value::from(self.props),
            geom = geom
        )
    }


    ///
    /// Outputs Hecate Compatible GeoJSON feature,
    /// omitting PT2ITP specific properties
    ///
    pub fn to_geojson(mut self, action: hecate::Action) -> geojson::Feature {
        let mut members: serde_json::map::Map<String, serde_json::Value> = serde_json::map::Map::new();

        if action != hecate::Action::None {
            members.insert(String::from("version"), serde_json::value::Value::Number(serde_json::Number::from(self.version)));
        }

        match action {
            hecate::Action::Create => {
                members.insert(String::from("action"), serde_json::value::Value::String("create".to_string()));
            },
            hecate::Action::Modify => {
                members.insert(String::from("action"), serde_json::value::Value::String("modify".to_string()));
            },
            hecate::Action::Delete => {
                members.insert(String::from("action"), serde_json::value::Value::String("delete".to_string()));
            },
            hecate::Action::Restore => {
                members.insert(String::from("action"), serde_json::value::Value::String("restore".to_string()));
            },
            _ => ()
        };

        self.props.insert(String::from("source"), serde_json::value::Value::String(self.source));
        self.props.insert(String::from("names"), serde_json::to_value(self.names.names).unwrap());
        self.props.insert(String::from("number"), serde_json::value::Value::String(self.number));

        geojson::Feature {
            id: match self.id {
                None => None,
                Some(id) => Some(geojson::feature::Id::Number(serde_json::Number::from(id)))
            },
            bbox: None,
            geometry: Some(geojson::Geometry {
                bbox: None,
                value: geojson::Value::Point(self.geom),
                foreign_members: None
            }),
            properties: Some(self.props),
            foreign_members: Some(members)
        }
    }
}

fn get_id(map: &mut serde_json::Map<String, serde_json::Value>) -> Result<Option<i64>, String> {
    match map.remove(&String::from("id")) {
        Some(id) => match id.as_i64() {
            Some(id) => Ok(Some(id)),
            None => Err(String::from("ID must be numeric"))
        },
        None => Ok(None)
    }
}

fn get_number(map: &mut serde_json::Map<String, serde_json::Value>) -> Result<String, String> {
    match map.remove(&String::from("number")) {
        Some(number) => match number {
            serde_json::value::Value::Number(num) => {
                Ok(String::from(num.to_string()))
            },
            serde_json::value::Value::String(num) => {
                Ok(num)
            },
            _ => Err(String::from("Number property must be String or Numeric"))
        },
        None => Err(String::from("Number property required"))
    }
}

fn get_version(map: &mut serde_json::Map<String, serde_json::Value>) -> Result<i64, String> {
    match map.remove(&String::from("version")) {
        Some(version) => match version.as_i64() {
            Some(version) => Ok(version),
            _ => Err(String::from("Version must be numeric"))
        },
        None => Ok(0)
    }
}

fn get_source(map: &mut serde_json::Map<String, serde_json::Value>) -> Result<String, String> {
    match map.remove(&String::from("source")) {
        Some(source) => match source {
            serde_json::value::Value::String(source) => Ok(source),
            _ => Ok(String::from(""))
        },
        None => Ok(String::from(""))
    }
}

fn get_output(map: &mut serde_json::Map<String, serde_json::Value>) -> Result<bool, String> {
    match map.remove(&String::from("output")) {
        Some(output) => match output.as_bool() {
            None => Ok(true),
            Some(output) => Ok(output)
        },
        None => Ok(true)
    }
}

fn get_interpolate(map: &mut serde_json::Map<String, serde_json::Value>) -> Result<bool, String> {
    match map.remove(&String::from("interpolate")) {
        Some(itp) => match itp.as_bool() {
            None => Ok(true),
            Some(itp) => Ok(itp)
        },
        None => Ok(true)
    }
}

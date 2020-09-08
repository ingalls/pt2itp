use postgis::ewkb::AsEwkbPoint;
use postgis::ewkb::EwkbWrite;
use regex::{Regex, RegexSet};

use crate::{Context, Names, Name, Source, hecate, types::name::InputName};

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

        let street = match props.remove(&String::from("street")) {
            Some(street) => {
                props.insert(String::from("street"), street.clone());

                Some(street)
            },
            None => None
        };

        let names = Names::from_value(street, Some(Source::Address), &context)?;

        if names.names.len() == 0 {
            return Err(String::from("Feature has no valid non-whitespace name"));
        }

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
            _ => { return Err(String::from("Address::from_value value must be JSON Object")); }
        };

        let names: Names = match value.get(&String::from("names")) {
            Some(names) => {
                let names = names.clone();

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
                _ => { return Err(String::from("Address::from_value value must be JSON Object")); }
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
                r"^([nesw])(\d+)([nesw]\d+)?$",
                r"^\d+(к\d+)?(с\d+)?$"
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

        format!("{id}\t{version}\t{names}\t{number}\t{source}\t{output}\t{interpolate}\t{props}\t{geom}\n",
            id = match self.id {
                None => String::from(""),
                Some(id) => id.to_string()
            },
            version = self.version,
            names = serde_json::to_string(&self.names.names).unwrap_or(String::from("")),
            output = self.output,
            interpolate = self.interpolate,
            number = self.number,
            source = self.source,
            props = serde_json::value::Value::from(self.props),
            geom = geom
        )
    }

    ///
    ///Insert an address into a given database
    ///
    ///Only use this function for a small number or address
    ///features or if they are being infrequently written.
    ///to_tsv with a copy stream is far more efficient
    ///
    pub fn to_db(&self, conn: &impl postgres::GenericConnection, table: impl ToString) -> Result<(), postgres::error::Error> {
        conn.execute(format!("
            INSERT INTO {table} (
                id,
                version,
                names,
                number,
                source,
                output,
                props,
                geom
            ) VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                ST_SetSRID(ST_MakePoint($8, $9), 4326)
            )
        ",
            table = table.to_string()
        ).as_str(), &[
            &self.id,
            &self.version,
            &serde_json::to_value(&self.names.names).unwrap(),
            &self.number,
            &self.source,
            &self.output,
            &serde_json::value::Value::from(self.props.clone()),
            &self.geom[0],
            &self.geom[1]
        ])?;

        Ok(())
    }


    ///
    /// Outputs Hecate Compatible GeoJSON feature,
    /// omitting PT2ITP specific properties
    ///
    /// action: Hecate action to conditionally attach to output geojson feature
    /// generated: Should generated synonyms be output
    ///
    pub fn to_geojson(mut self, action: hecate::Action, generated: bool) -> geojson::Feature {
        let mut members: serde_json::map::Map<String, serde_json::Value> = serde_json::map::Map::new();

        if action != hecate::Action::None {
            members.insert(String::from("version"), serde_json::value::Value::Number(serde_json::Number::from(self.version)));
        }

        match action {
            hecate::Action::Create => {
                members.insert(String::from("action"), serde_json::value::Value::String("create".to_string()));
                members.remove(&String::from("version"));
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

        let names: Vec<InputName> = self.names.names.into_iter().filter(|name| {
            if !generated {
                name.source != Some(Source::Generated)
            } else {
                true
            }
        }).map(|name| {
            InputName::from(name)
        }).collect();

        self.props.insert(String::from("street"), serde_json::to_value(names).unwrap());

        if self.source != String::from("") {
            self.props.insert(String::from("source"), serde_json::value::Value::String(self.source));
        }

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
    match map.get(&String::from("number")) {
        Some(number) => match number.clone() {
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
    match map.get(&String::from("source")) {
        Some(source) => match source.clone() {
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

mod tests {
    use super::*;
    use crate::Tokens;

    #[test]
    fn test_address_simple_geom() {
        // street value is object
        {
            let feat: geojson::GeoJson = String::from(r#"{"id":80614173,"key":null,"type":"Feature","version":3,"geometry":{"type":"Point","coordinates":[-84.7395102,39.1618162]},"properties":{"type":"residential","number":"726","source":"hamilton","street":[{"display":"Rosewynne Ct","priority":0}],"accuracy":"rooftop","override:postcode":"45002"}}"#).parse().unwrap();

            let context = Context::new(
                String::from("us"),
                Some(String::from("mn")),
                Tokens::generate(vec![String::from("en")])
            );

            let addr = Address::new(feat, &context).unwrap();

            assert_eq!(addr.to_tsv(), "80614173\t3\t[{\"display\":\"Rosewynne Ct\",\"priority\":-1,\"source\":\"Address\",\"tokenized\":[{\"token\":\"rosewynne\",\"token_type\":null},{\"token\":\"ct\",\"token_type\":\"Way\"}],\"freq\":1}]\t726\thamilton\ttrue\ttrue\t{\"accuracy\":\"rooftop\",\"number\":\"726\",\"override:postcode\":\"45002\",\"source\":\"hamilton\",\"street\":[{\"display\":\"Rosewynne Ct\",\"priority\":0}],\"type\":\"residential\"}\t0101000020E6100000BD039722542F55C0437BAB64B6944340\n");
        }

        // street value is string
        {
            let feat: geojson::GeoJson = String::from(r#"{"type":"Feature","properties":{"street":"Hickory Hills Dr","number":1272,"source":"TIGER-2016","output":false},"interpolate":true, "geometry":{"type":"Point","coordinates":[-84.21414376368934,39.21812703085023]}}"#).parse().unwrap();

            let context = Context::new(
                String::from("us"),
                Some(String::from("mn")),
                Tokens::generate(vec![String::from("en")])
            );

            let addr = Address::new(feat, &context).unwrap();

            assert_eq!(addr.to_tsv(), "\t0\t[{\"display\":\"Hickory Hills Dr\",\"priority\":-1,\"source\":\"Address\",\"tokenized\":[{\"token\":\"hickory\",\"token_type\":null},{\"token\":\"hls\",\"token_type\":null},{\"token\":\"dr\",\"token_type\":\"Way\"}],\"freq\":1}]\t1272\tTIGER-2016\tfalse\ttrue\t{\"number\":1272,\"source\":\"TIGER-2016\",\"street\":\"Hickory Hills Dr\"}\t0101000020E6100000096C0B88B40D55C00BF02796EB9B4340\n");
        }
    }
}

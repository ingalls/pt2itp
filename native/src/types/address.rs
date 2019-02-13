use postgis::ewkb::AsEwkbPoint;
use postgis::ewkb::EwkbWrite;
use regex::{Regex, RegexSet};

use crate::Context;

/// A representation of a single Address
#[derive(Debug)]
pub struct Address {
    /// An optional identifier for the address
    pub id: Option<i64>,

    pub version: i64,

    /// The address number, can be numeric or semi-numeric (100 vs 100a)
    pub number: String,

    /// Vector of all street name synonyms
    pub names: super::Names,

    /// String source/provider/timestamp for the given data
    pub source: String,

    /// Should the feature be output
    pub output: bool,

    /// Should the address feature be used to generate interpolation
    pub interpolate: bool,

    /// JSON representation of properties
    pub props: serde_json::Map<String, serde_json::Value>,

    /// Simple representation of Lng/Lat geometry
    pub geom: (f64, f64)
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

        let version = match feat.foreign_members {
            Some(mut props) => match props.remove(&String::from("version")) {
                Some(version) => version.as_i64().unwrap(),
                None => 0
            },
            None => 0
        };

        let number = match props.remove(&String::from("number")) {
            Some(number) => {
                if number.is_string() {
                    String::from(number.as_str().unwrap())
                } else if number.is_i64() {
                    number.as_i64().unwrap().to_string()
                } else { return Err(String::from("Number property must be String or Numeric")); }
            },
            None => { return Err(String::from("Number property required")); }
        };

        let source = match props.remove(&String::from("source")) {
            Some(source) => {
                if source.is_string() {
                    String::from(source.as_str().unwrap())
                } else {
                    String::from("")
                }
            },
            None => String::from("")
        };

        let interpolate = match props.remove(&String::from("interpolate")) {
            Some(itp) => match itp.as_bool() {
                None => true,
                Some(itp) => itp
            },
            None => true
        };

        let output = match props.remove(&String::from("output")) {
            Some(itp) => match itp.as_bool() {
                None => true,
                Some(itp) => itp
            },
            None => true
        };

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

                    (pt[0], pt[1])
                },
                _ => { return Err(String::from("Addresses must have Point geometry")); }
            },
            None => { return Err(String::from("Addresses must have geometry")); }
        };

        let mut names = super::super::Names::from_value(props.remove(&String::from("street")), &context)?;

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

    ///Return a PG Copyable String of the feature
    ///
    ///name, number, source, props, geom
    pub fn to_tsv(self) -> String {
        let geom = postgis::ewkb::Point::new(self.geom.0, self.geom.1, Some(4326)).as_ewkb().to_hex_ewkb();

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
}

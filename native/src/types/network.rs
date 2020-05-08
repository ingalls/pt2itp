use postgis::ewkb::EwkbWrite;
use crate::{Context, text, Names, Source};

#[derive(Debug)]
///
/// A representation of a single network
///
pub struct Network {
    /// An optional identifier for the network
    pub id: Option<i64>,

    /// Vector of all street name synonyms
    pub names: super::Names,

    /// String source/provider/timestamp for the given data
    pub source: String,

    /// JSON representation of properties
    pub props: serde_json::Map<String, serde_json::Value>,

    /// Simple representation of MultiLineString
    pub geom: Vec<geojson::LineStringType>
}

impl Network {
    pub fn new(feat: geojson::GeoJson, context: &Context) -> Result<Self, String> {
        let feat = match feat {
            geojson::GeoJson::Feature(feat) => feat,
            _ => { return Err(String::from("Not a GeoJSON Feature")); }
        };

        let mut props = match feat.properties {
            Some(props) => props,
            None => { return Err(String::from("Feature has no properties")); }
        };

        let source = match props.get(&String::from("source")) {
            Some(source) => {
                let source = source.clone();
                if source.is_string() {
                    String::from(source.as_str().unwrap())
                } else {
                    String::from("")
                }
            },
            None => String::from("")
        };

        let geom = match feat.geometry {
            Some(geom) => match geom.value {
                geojson::Value::LineString(ln) => vec![ln],
                geojson::Value::MultiLineString(mln) => mln,
                _ => { return Err(String::from("Network must have (Multi)LineString geometry")); }
            },
            None => { return Err(String::from("Network must have geometry")); }
        };


        let street = match props.remove(&String::from("street")) {
            Some(street) => {
                props.insert(String::from("street"), street.clone());

                Some(street)
            },
            None => None
        };

        let names = Names::from_value(street, Some(Source::Network), &context)?;

        if names.names.is_empty() {
            return Err(String::from("Feature has no valid non-whitespace name"));
        }

        let mut net = Network {
            id: match feat.id {
                Some(geojson::feature::Id::Number(id)) => id.as_i64(),
                _ => None
            },
            names,
            source,
            props,
            geom
        };

        net.std(&context)?;

        Ok(net)
    }

    pub fn std(&mut self, context: &Context) -> Result<(), String> {
        for name in self.names.names.iter() {
            if text::is_drivethrough(&name.display, &context) {
                return Err(String::from("Network is drivethrough like"));
            }
        }

        Ok(())
    }

    ///
    /// Return a PG Copyable String of the feature
    /// names, source, props, geom
    ///
    pub fn to_tsv(self) -> String {
        let mut twkb = postgis::twkb::MultiLineString {
            lines: Vec::with_capacity(self.geom.len()),
            ids: None
        };

        for ln in self.geom {
            let mut line = postgis::twkb::LineString {
                points: Vec::with_capacity(ln.len())
            };

            for pt in ln {
                line.points.push(postgis::twkb::Point {
                    x: pt[0],
                    y: pt[1]
                });
            }

            twkb.lines.push(line);
        }

        let geom = postgis::ewkb::EwkbMultiLineString {
            geom: &twkb,
            srid: Some(4326),
            point_type: postgis::ewkb::PointType::Point
        }.to_hex_ewkb();

        format!("{names}\t{source}\t{props}\t{geom}\n",
            names = serde_json::to_string(&self.names.names).unwrap_or_default(),
            source = self.source,
            props = serde_json::value::Value::from(self.props),
            geom = geom
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Tokens, Context};
    use std::collections::HashMap;

    #[test]
    fn test_network_simple_geom() {
        let feat: geojson::GeoJson = String::from(r#"{
            "type":"Feature",
            "properties":{
                "id":6052094,
                "street":[{"display":"Poremba Court Southwest","priority":0}]},
            "geometry":{
                "type":"LineString",
                "coordinates":[[-77.008941,38.859243],[-77.008447,38.859],[-77.0081173,38.8588497]]
            }
        }"#).parse().unwrap();

        let context = Context::new(
            String::from("us"),
            Some(String::from("dc")),
            Tokens::new(HashMap::new())
        );

        let net = Network::new(feat, &context).unwrap();

        assert_eq!(net.to_tsv(), "[{\"display\":\"Poremba Court Southwest\",\"priority\":0,\"source\":\"Network\",\"tokenized\":[{\"token\":\"poremba\",\"token_type\":null},{\"token\":\"court\",\"token_type\":null},{\"token\":\"southwest\",\"token_type\":null}],\"freq\":1}]\t\t{\"id\":6052094,\"street\":[{\"display\":\"Poremba Court Southwest\",\"priority\":0}]}\t0105000020E610000001000000010200000003000000FCA5457D924053C09128B4ACFB6D4340F52F49658A4053C0CBA145B6F36D434009826CFE844053C0F7D676C9EE6D4340\n");
    }

    #[test]
    #[should_panic(expected = "1 network synonym must have greater priority: [InputName { display: \"Main St\", priority: -1 }, InputName { display: \"E Main St\", priority: -1 }]")]
    fn test_network_invalid_priority() {
        let context = Context::new(String::from("us"), None, Tokens::new(HashMap::new()));

        let feat: geojson::GeoJson = String::from(r#"{
            "type": "Feature",
            "properties": {
                "id": 4636927,
                "street": [{"display": "Main St","priority": -1}, {"display": "E Main St","priority": -1}]
            },
            "geometry": {
                "type": "LineString",
                "coordinates":[[-77.008941,38.859243],[-77.008447,38.859],[-77.0081173,38.8588497]]
            }
        }"#).parse().unwrap();
        let _net = Network::new(feat, &context).unwrap();
    }
}

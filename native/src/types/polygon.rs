use postgis::ewkb::EwkbWrite;

///
/// A representation of a single polygon
///
#[derive(Debug)]
pub struct Polygon {
    /// An optional identifier for the address
    pub id: Option<i64>,

    /// JSON representation of properties
    pub props: serde_json::Map<String, serde_json::Value>,

    /// Simple representation of Lng/Lat geometry
    pub geom: Vec<geojson::PolygonType>
}

impl Polygon {
    pub fn new(feat: geojson::GeoJson) -> Result<Self, String> {
        let feat = match feat {
            geojson::GeoJson::Feature(feat) => feat,
            _ => { return Err(String::from("Not a GeoJSON Feature")); }
        };

        let props = match feat.properties {
            Some(props) => props,
            None => { return Err(String::from("Feature has no properties")); }
        };

        let geom = match feat.geometry {
            Some(geom) => match geom.value {
                geojson::Value::Polygon(py) => vec![py],
                geojson::Value::MultiPolygon(mpy) => mpy,
                _ => { return Err(String::from("Polygon must have (Multi)Polygon geometry")); }
            },
            None => { return Err(String::from("Polygon must have geometry")); }
        };

        Ok(Polygon {
            id: match feat.id {
                Some(geojson::feature::Id::Number(id)) => id.as_i64(),
                _ => None
            },
            props,
            geom
        })
    }

    ///
    /// Return a PG Copyable String of the feature
    /// props, geom
    ///
    #[allow(clippy::wrong_self_convention)]
    pub fn to_tsv(self) -> String {
        let mut twkb = postgis::twkb::MultiPolygon {
            polygons: Vec::with_capacity(self.geom.len()),
            ids: None
        };

        for py in self.geom {
            let mut poly = postgis::twkb::Polygon {
                rings: Vec::with_capacity(py.len())
            };

            for py_ring in py {
                let mut ring = postgis::twkb::LineString {
                    points: Vec::with_capacity(py_ring.len())
                };

                for pt in py_ring {
                    ring.points.push(postgis::twkb::Point {
                        x: pt[0],
                        y: pt[1],
                    });
                }

                poly.rings.push(ring);
            }

            twkb.polygons.push(poly);
        }

        let geom = postgis::ewkb::EwkbMultiPolygon {
            geom: &twkb,
            srid: Some(4326),
            point_type: postgis::ewkb::PointType::Point
        }.to_hex_ewkb();

        format!("{props}\t{geom}\n",
            props = serde_json::value::Value::from(self.props),
            geom = geom
        )
    }
}

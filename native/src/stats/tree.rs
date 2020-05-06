use crate::stream::GeoStream;
use std::collections::HashMap;
use std::convert::TryInto;
use super::*;
use geo::algorithm::{
    bounding_rect::BoundingRect
};

pub struct Rect {
    pub geom: geo::MultiPolygon<f64>,
    pub name: String,
    pub rect: rstar::primitives::Rectangle<[f64; 2]>
}

impl Rect {
    pub fn new(geom: geo::MultiPolygon<f64>, name: impl ToString) -> Self {
        let bound = geom.bounding_rect().unwrap();

        Rect {
            geom,
            name: name.to_string(),
            rect: rstar::primitives::Rectangle::from_corners(
                [bound.min.x, bound.min.y],
                [bound.max.x, bound.max.y]
            )
        }
    }
}

impl rstar::RTreeObject for Rect {
    type Envelope = rstar::AABB<[f64; 2]>;

    fn envelope(&self) -> Self::Envelope {
        self.rect.envelope()
    }
}

impl rstar::PointDistance for Rect {
    fn distance_2(&self, point: &[f64; 2]) -> f64 {
        self.rect.distance_2(point)
    }
}

pub fn create(bound: Option<String>, boundmap: &mut HashMap<String, StatsBound>) -> rstar::RTree<Rect> {
    let bounds_stream = GeoStream::new(bound);

    let mut tree_contents = Vec::new();

    for bound in bounds_stream {
        let feat = match bound {
            geojson::GeoJson::Feature(feat) => feat,
            _ => panic!("Bounds must be (Multi)Polygon Features")
        };

        let name = match feat.properties.unwrap().get(&String::from("name")) {
            Some(name) => match name {
                serde_json::Value::String(string) => string.to_string(),
                _ => panic!("bounds features must have string .propeties.name value")
            },
            None => panic!("Add bounds features must have .properties.name string")
        };

        let geom: geo::Geometry<f64> = feat.geometry.unwrap().value.try_into().unwrap();

        let geom = match geom {
            geo::Geometry::Polygon(poly) => geo::MultiPolygon(vec![poly]),
            geo::Geometry::MultiPolygon(mpoly) => mpoly,
            _ => panic!("Bound must be (Multi)Polygon Features")
        };

        boundmap.insert(name.clone(), StatsBound::new());

        let rect = Rect::new(geom, name);

        tree_contents.push(rect);
    }

    println!("ok - {} bounds loaded into rtree", tree_contents.len());

    rstar::RTree::bulk_load(tree_contents)
}


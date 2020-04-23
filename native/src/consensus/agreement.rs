use std::collections::HashMap;
use kodama::{Method, linkage};

#[derive(Serialize, Deserialize, Debug)]
pub struct Results {
    agreement_count: u32,
    hit_count: u32
}

impl Results {
    pub fn new() -> Self {
        Results {
            agreement_count: 0,
            hit_count: 0
        }
    }
}

pub struct Agreement {
    results: HashMap<String, Results>,
    threshold: u32,
    sample_count: u32
}

impl Agreement {
    pub fn new(sources: Vec<String>, threshold: u32) -> Self {
        let mut results = HashMap::new();
        for source in sources {
            results.insert(source, Results::new());
        }
        Agreement {
            results,
            threshold,
            sample_count: 0
        }
    }

    pub fn process_points(&mut self, source_map: &HashMap<String, Option<(f64, f64)>>) {
        self.sample_count += 1;

        let mut source_hit_count = 0;
        let mut coordinates = vec![];
        let mut labels = vec![];
        for (source, coord) in source_map.iter() {
            if let Some(point) = coord {
                source_hit_count += 1;
                labels.push(source);
                coordinates.push(point);
                self.results.entry(String::from(source)).and_modify(|e| e.hit_count += 1);
            }
        }

        // Return early if we don't have enough hits to determine agreement
        if source_hit_count < 3 {
            return;
        }

        // Build our condensed matrix by computing the dissimilarity between all
        // possible coordinate pairs.
        let mut condensed = vec![];
        for row in 0..coordinates.len() - 1 {
            for col in row + 1..coordinates.len() {
                condensed.push(haversine(*coordinates[row], *coordinates[col]));
            }
        }
    
        let dend = linkage(&mut condensed, coordinates.len(), Method::Single);
    
        let mut modal_cluster = vec![];
        for step in dend.steps() {
            if step.dissimilarity < self.threshold as f64 {
                modal_cluster.push(step.cluster1);
                modal_cluster.push(step.cluster2);
            } else {
                break;
            }
        }
    
        let modal_cluster: Vec<&String> = modal_cluster
            .into_iter()
            .filter(|&x| x < dend.observations())
            .map(|x| labels[x])
            .collect();

        for source in modal_cluster {
            self.results.entry(String::from(source)).and_modify(|e| e.agreement_count += 1);
        }
    }

    pub fn get_results(&self) -> &HashMap<String, Results> {
        &self.results
    }
}

fn haversine((lat1, lon1): (f64, f64), (lat2, lon2): (f64, f64)) -> f64 {
    const EARTH_RADIUS: f64 = 3958.756;
    //6371.0;

    let (lat1, lon1) = (lat1.to_radians(), lon1.to_radians());
    let (lat2, lon2) = (lat2.to_radians(), lon2.to_radians());

    let delta_lat = lat2 - lat1;
    let delta_lon = lon2 - lon1;
    let x =
        (delta_lat / 2.0).sin().powi(2)
        + lat1.cos() * lat2.cos() * (delta_lon / 2.0).sin().powi(2);
    2.0 * EARTH_RADIUS * x.sqrt().atan() 
    //* 1000.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clustering() {
        let sources = vec![
            String::from("Fitchburg"),
            String::from("Framingham"),
            String::from("Marlborough"),
            String::from("Northbridge"),
            String::from("Southborough"),
            String::from("Westborough")
        ];

        let mut agreement = Agreement::new(sources, 10);

        let mut source_map = HashMap::new();
        source_map.insert(String::from("Fitchburg"), Some((42.5833333, -71.8027778)));
        source_map.insert(String::from("Framingham"), Some((42.2791667, -71.4166667)));
        source_map.insert(String::from("Marlborough"), Some((42.3458333, -71.5527778)));
        source_map.insert(String::from("Northbridge"), Some((42.1513889, -71.6500000)));
        source_map.insert(String::from("Southborough"), Some((42.3055556, -71.5250000)));
        source_map.insert(String::from("Westborough"), Some((42.2694444, -71.6166667)));

        agreement.process_points(&source_map);
        let results = agreement.get_results();
        println!("results: {:?}", results);
    }
}
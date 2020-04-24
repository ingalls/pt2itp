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

fn haversine((lon1, lat1): (f64, f64), (lon2, lat2): (f64, f64)) -> f64 {
    const EARTH_RADIUS: f64 = 6371.0; // meters

    let (lon1, lat1) = (lon1.to_radians(), lat1.to_radians());
    let (lon2, lat2) = (lon2.to_radians(), lat2.to_radians());

    let delta_lat = lat2 - lat1;
    let delta_lon = lon2 - lon1;
    let x =
        (delta_lat / 2.0).sin().powi(2)
        + lat1.cos() * lat2.cos() * (delta_lon / 2.0).sin().powi(2);
    2.0 * EARTH_RADIUS * x.sqrt().atan() * 1000.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agreement_towns() {
        let sources = vec![
            String::from("Fitchburg"),
            String::from("Framingham"),
            String::from("Marlborough"),
            String::from("Northbridge"),
            String::from("Southborough"),
            String::from("Westborough")
        ];

        let mut agreement = Agreement::new(sources, 16093); // 10 miles

        let mut source_map = HashMap::new();
        source_map.insert(String::from("Fitchburg"), Some((-71.8027778, 42.5833333)));
        source_map.insert(String::from("Framingham"), Some((-71.4166667, 42.2791667)));
        source_map.insert(String::from("Marlborough"), Some((-71.5527778, 42.3458333)));
        source_map.insert(String::from("Northbridge"), Some((-71.6500000, 42.1513889)));
        source_map.insert(String::from("Southborough"), Some((-71.5250000, 42.3055556)));
        source_map.insert(String::from("Westborough"), Some((-71.6166667, 42.2694444)));

        agreement.process_points(&source_map);

        let results = agreement.get_results();

        assert_eq!(results.get("Fitchburg").unwrap().agreement_count, 0);
        assert_eq!(results.get("Framingham").unwrap().agreement_count, 1);
        assert_eq!(results.get("Marlborough").unwrap().agreement_count, 1);
        assert_eq!(results.get("Northbridge").unwrap().agreement_count, 1);
        assert_eq!(results.get("Southborough").unwrap().agreement_count, 1);
        assert_eq!(results.get("Westborough").unwrap().agreement_count, 1);
    }

    #[test]
    fn test_agreement_bad_source() {
        let sources = vec![
            String::from("source1"),
            String::from("source2"),
            String::from("source3")
        ];

        let mut agreement = Agreement::new(sources, 25);

        let mut source_map = HashMap::new();
        source_map.insert(String::from("source1"), Some((-77.0013365,38.8959637)));
        source_map.insert(String::from("source2"), Some((-77.0013338,38.8959407)));
        source_map.insert(String::from("source3"), Some((-77.0013311,38.8955170)));

        agreement.process_points(&source_map);

        source_map.entry(String::from("source1")).and_modify(|e| *e = Some((-77.0033025,38.8971410)));
        source_map.entry(String::from("source2")).and_modify(|e| *e = Some((-77.0032677,38.8971390)));
        source_map.entry(String::from("source3")).and_modify(|e| *e = Some((-77.0038872,38.8970513)));

        agreement.process_points(&source_map);

        let results = agreement.get_results();

        assert_eq!(results.get("source1").unwrap().agreement_count, 2);
        assert_eq!(results.get("source2").unwrap().agreement_count, 2);
        assert_eq!(results.get("source3").unwrap().agreement_count, 0);
    }

    #[test]
    fn test_agreement_no_agreement() {
        let sources = vec![
            String::from("source1"),
            String::from("source2"),
            String::from("source3")
        ];

        let mut agreement = Agreement::new(sources, 25);

        let mut source_map = HashMap::new();
        source_map.insert(String::from("source1"), Some((-76.9732081,38.9168672)));
        source_map.insert(String::from("source2"), Some((-76.9733476,38.9163518)));
        source_map.insert(String::from("source3"), Some((-76.9731089,38.9175434)));

        agreement.process_points(&source_map);

        source_map.entry(String::from("source1")).and_modify(|e| *e = Some((-76.9717141,38.9309358)));
        source_map.entry(String::from("source2")).and_modify(|e| *e = Some((-76.9710302,38.9312738)));
        source_map.entry(String::from("source3")).and_modify(|e| *e = Some((-76.9720950,38.9308064)));

        agreement.process_points(&source_map);

        let results = agreement.get_results();

        assert_eq!(results.get("source1").unwrap().agreement_count, 0);
        assert_eq!(results.get("source2").unwrap().agreement_count, 0);
        assert_eq!(results.get("source3").unwrap().agreement_count, 0);
    }

    #[test]
    fn test_agreement_misses() {
        let sources = vec![
            String::from("source1"),
            String::from("source2"),
            String::from("source3")
        ];

        let mut agreement = Agreement::new(sources, 25);

        let mut source_map = HashMap::new();
        source_map.insert(String::from("source1"), Some((-76.9732081,38.9168672)));
        source_map.insert(String::from("source2"), Some((-76.9733476,38.9163518)));
        source_map.insert(String::from("source3"), None);

        agreement.process_points(&source_map);

        source_map.entry(String::from("source1")).and_modify(|e| *e = None);
        source_map.entry(String::from("source2")).and_modify(|e| *e = Some((-76.9710302,38.9312738)));
        source_map.entry(String::from("source3")).and_modify(|e| *e = Some((-76.9720950,38.9308064)));

        agreement.process_points(&source_map);

        let results = agreement.get_results();

        assert_eq!(results.get("source1").unwrap().agreement_count, 0);
        assert_eq!(results.get("source1").unwrap().hit_count, 1);

        assert_eq!(results.get("source2").unwrap().agreement_count, 0);
        assert_eq!(results.get("source2").unwrap().hit_count, 2);

        assert_eq!(results.get("source3").unwrap().agreement_count, 0);
        assert_eq!(results.get("source3").unwrap().hit_count, 1);
    }
}
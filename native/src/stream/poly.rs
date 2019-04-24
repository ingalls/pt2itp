use std::convert::From;
use std::iter::Iterator;
use std::io::Write;
use std::fs::OpenOptions;
use std::fs::File;

use crate::Polygon;

pub struct PolyStream<T: Iterator> {
    input: T,
    errors: Option<File>
}

impl<T: Iterator> PolyStream<T> {
    pub fn new(input: T, errors: Option<String>) -> Self {
        PolyStream {
            input: input,
            errors: match errors {
                None => None,
                Some(path) => Some(OpenOptions::new().create(true).append(true).open(path).unwrap())
            }
        }
    }
}

impl<T: Iterator> Iterator for PolyStream<T>
where
    T: Iterator<Item=geojson::GeoJson>
{
    type Item = Polygon;

    fn next(&mut self) -> Option<Self::Item> {
        let mut next: Result<Polygon, String> = Err(String::from(""));

        while next.is_err() {
            next = match self.input.next() {
                Some(potential) => match Polygon::new(potential) {
                    Ok(potential) => Ok(potential),
                    Err(err) => match self.errors {
                        None => Err(err),
                        Some(ref mut file) => {
                            file.write(format!("{}\n", err).as_bytes()).unwrap();

                            Err(err)
                        }
                    }
                },
                None => { return None; }
            };
        }

        Some(next.unwrap())
    }
}

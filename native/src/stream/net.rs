use std::convert::From;
use std::iter::Iterator;
use std::io::Write;
use std::fs::{File, OpenOptions};

use crate::{Network, Context};

pub struct NetStream<T: Iterator> {
    context: Context,
    input: T,
    errors: Option<File>
}

impl<T: Iterator> NetStream<T> {
    pub fn new(input: T, context: Context, errors: Option<String>) -> Self {
        NetStream {
            context: context,
            input: input,
            errors: match errors {
                None => None,
                Some(path) => Some(OpenOptions::new().create(true).append(true).open(path).unwrap())
            }
        }
    }
}

impl<T: Iterator> Iterator for NetStream<T>
where
    T: Iterator<Item=geojson::GeoJson>
{
    type Item = Network;

    fn next(&mut self) -> Option<Self::Item> {
        let mut next: Result<Network, String> = Err(String::from(""));
   
        while next.is_err() {
            next = match self.input.next() {
                Some(potential) => match Network::new(potential, &self.context) {
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
        while next.is_err() {
            next = match self.input.next() {
                Some(potential) => match Network::new(potential, &self.context) {
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

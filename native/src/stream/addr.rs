use std::convert::From;
use std::iter::Iterator;
use std::io::Write;
use std::fs::{File, OpenOptions};

use crate::{Address, Context};

///
/// An Address Stream consumes a GeoJSON Iterator stream,
/// producing an iterator of Address objects
///
pub struct AddrStream<T: Iterator> {
    context: Context,
    input: T,
    errors: Option<File>
}

impl<T: Iterator> AddrStream<T> {
    pub fn new(input: T, context: Context, errors: Option<String>) -> Self {
        AddrStream {
            context: context,
            input: input,
            errors: match errors {
                None => None,
                Some(path) => Some(OpenOptions::new().create(true).append(true).open(path).unwrap())
            }
        }
    }
}

impl<T: Iterator> Iterator for AddrStream<T>
where
    T: Iterator<Item=geojson::GeoJson>
{
    type Item = Address;

    fn next(&mut self) -> Option<Self::Item> {
        let mut next: Result<Address, String> = Err(String::from(""));

        while next.is_err() {
            next = match self.input.next() {
                Some(potential) => match Address::new(potential, &self.context) {
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

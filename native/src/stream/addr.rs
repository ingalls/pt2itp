use std::convert::From;
use std::iter::Iterator;
use std::io::{Write, BufWriter};
use std::fs::File;

use crate::{stream::geo::GeoStream, Address, Context};

pub struct AddrStream {
    context: Context,
    input: GeoStream,
    buffer: Option<Vec<u8>>, //Used by Read impl for storing partial features
    errors: Option<BufWriter<File>>
}

impl AddrStream {
    pub fn new(input: GeoStream, context: Context, errors: Option<String>) -> Self {
        AddrStream {
            context,
            input,
            buffer: None,
            errors: match errors {
                None => None,
                Some(path) => Some(BufWriter::new(File::create(path).unwrap()))
            }
        }
    }
}

impl std::io::Read for AddrStream {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        let buf_len = buf.len();
        let mut write: Vec<u8> = Vec::new();
        let mut end = false;

        while write.len() < buf_len && !end {
            if self.buffer.is_some() {
                write = self.buffer.take().unwrap();
            } else {
                let feat = match self.next() {
                    Some(feat) => feat.to_tsv(),
                    None => String::from("")
                };

                let mut bytes = feat.into_bytes();
                if bytes.is_empty() {
                    end = true;
                } else {
                    write.append(&mut bytes);
                }

                if write.is_empty() {
                    return Ok(0);
                }
            }
        }

        if write.len() > buf_len {
            self.buffer = Some(write.split_off(buf_len));
        }

        buf[..write.len()].clone_from_slice(&write[..]);

        Ok(write.len())
    }
}

impl Iterator for AddrStream {
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
                            file.write_all(format!("{}\n", err).as_bytes()).unwrap();

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

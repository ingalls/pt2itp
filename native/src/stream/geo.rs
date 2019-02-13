use std::fs::File;
use std::io::{self, BufRead, BufReader};
use std::convert::From;
use std::iter::Iterator;

pub struct GeoStream {
    input: Input
}

pub enum Input {
    File(std::io::Lines<BufReader<File>>),
    StdIn(std::io::Lines<std::io::StdinLock<'static>>),
}

impl GeoStream {
    pub fn new(input: Option<String>) -> Self {
        let stream = match input {
            Some(inpath) => match File::open(inpath) {
                Ok(file) => GeoStream {
                    input: Input::File(BufReader::new(file).lines())
                },
                Err(err) => { panic!("Unable to open input file: {}", err); }
            },
            None => {
                GeoStream {
                    input: Input::StdIn(Box::leak(Box::new(io::stdin())).lock().lines())
                }
            }
        };

        stream
    }

    fn line(input: &mut Input) -> Option<String> {
        match input {
            Input::File(ref mut file) => match file.next() {
                None => None,
                Some(file) => match file {
                    Ok(line) => Some(line),
                    Err(err) => panic!("{}", err)
                }
            },
            Input::StdIn(ref mut stdin) => match stdin.next() {
                None => None,
                Some(stdin) => match stdin {
                    Ok(line) => Some(line),
                    Err(err) => panic!("{}", err)
                }
            }
        }
    }
}

impl Iterator for GeoStream {
    type Item = geojson::GeoJson;

    fn next(&mut self) -> Option<Self::Item> {
        let mut line = Some(String::from(""));

        while line.is_some() && line.as_ref().unwrap().trim().len() == 0 {
            line = match GeoStream::line(&mut self.input) {
                None => None,
                Some(line) => Some(line)
            };
        }

        match line {
            None => {
                return None;
            },
            Some(mut line) => {
                //Remove Ascii Record Separators at beginning or end of line
                if line.ends_with("\u{001E}") {
                    line.pop();
                } else if line.starts_with("\u{001E}") {
                    line.replace_range(0..1, "");
                }

                match line.parse::<geojson::GeoJson>() {
                    Ok(geojson) => Some(geojson),
                    Err(err) => {
                        panic!("Invalid GeoJSON ({:?}): {}", err, line);
                    }
                }
            }
        }
    }
}

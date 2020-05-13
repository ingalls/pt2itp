use std::fs::File;
use std::io::{self, Write, BufWriter};
use std::convert::From;

use neon::prelude::*;

use super::stream::GeoStream;

#[derive(Serialize, Deserialize, Debug)]
struct ConvertArgs {
    input: Option<String>,
    output: Option<String>,
}

impl ConvertArgs {
    pub fn new() -> Self {
        ConvertArgs {
            input: None,
            output: None
        }
    }
}

pub fn convert(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let args: ConvertArgs = match cx.argument_opt(0) {
        None => ConvertArgs::new(),
        Some(arg) => {
            if arg.is_a::<JsUndefined>() || arg.is_a::<JsNull>() {
                ConvertArgs::new()
            } else {
                let arg_val = cx.argument::<JsValue>(0)?;
                neon_serde::from_value(&mut cx, arg_val)?
            }
        }
    };

    let stream = GeoStream::new(args.input);

    match args.output {
        Some(outpath) => {
            let outfile = match File::create(outpath) {
                Ok(outfile) => outfile,
                Err(err) => { panic!("Unable to write to output file: {}", err); }
            };

            convert_stream(stream, BufWriter::new(outfile))
        },
        None => convert_stream(stream, io::stdout().lock())
    }

    Ok(cx.boolean(true))
}

fn convert_stream(stream: GeoStream, mut sink: impl Write) {
    if sink.write(String::from("{ \"type\": \"FeatureCollection\", \"features\": [\n").as_bytes()).is_err() { panic!("Failed to write to output stream"); };
    let mut first = true;

    for geo in stream {
        let line = match geo {
            geojson::GeoJson::Geometry(geom) => {
                geojson::GeoJson::from(geojson::Feature {
                    id: None,
                    bbox: None,
                    geometry: Some(geom),
                    properties: None,
                    foreign_members: None
                }).to_string()
            },
            geojson::GeoJson::Feature(_) => geo.to_string(),
            geojson::GeoJson::FeatureCollection(fc) => {
                let mut line = String::new();
                let mut fcfirst = true;

                for feat in fc.features {
                    if fcfirst {
                        line = geojson::GeoJson::from(feat).to_string();
                        fcfirst = false;
                    } else {
                        line = format!("{},\n{}", line, geojson::GeoJson::from(feat).to_string());
                    }
                }
                line
            }
        };

        if first {
            if sink.write(line.as_bytes()).is_err() { panic!("Failed to write to output stream"); };
            first = false;
        } else if sink.write(format!("\n,{}", line).as_bytes()).is_err() {
            panic!("Failed to write to output stream");
        }
    }

    if sink.write(String::from("\n]}\n").as_bytes()).is_err() { panic!("Failed to write to output stream"); };

    if sink.flush().is_err() { panic!("Failed to flush output stream"); }
}

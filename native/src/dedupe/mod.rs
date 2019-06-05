use std::convert::From;
use postgres::{Connection, TlsMode};
use std::thread;
use std::fs::File;
use std::io::{BufWriter, Write};
use crate::Tokens;

use neon::prelude::*;

use crate::{
    Address,
    types::hecate,
    stream::{GeoStream, AddrStream, PolyStream}
};

use super::pg;
use super::pg::{Table, InputTable};

#[derive(Serialize, Deserialize, Debug)]
struct DedupeArgs {
    db: String,
    context: Option<super::types::InputContext>,
    buildings: Option<String>,
    input: Option<String>,
    output: Option<String>,
    hecate: Option<bool>
}

impl DedupeArgs {
    pub fn new() -> Self {
        DedupeArgs {
            db: String::from("dedupe"),
            context: None,
            buildings: None,
            input: None,
            output: None,
            hecate: None
        }
    }
}

pub fn dedupe(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let args: DedupeArgs = match cx.argument_opt(0) {
        None => DedupeArgs::new(),
        Some(arg) => {
            if arg.is_a::<JsUndefined>() || arg.is_a::<JsNull>() {
                DedupeArgs::new()
            } else {
                let arg_val = cx.argument::<JsValue>(0)?;
                neon_serde::from_value(&mut cx, arg_val)?
            }
        }
    };

    let is_hecate = args.hecate.unwrap_or(false);

    let conn = Connection::connect(format!("postgres://postgres@localhost:5432/{}", &args.db).as_str(), TlsMode::None).unwrap();

    let context = match args.context {
        Some(context) => crate::Context::from(context),
        None => crate::Context::new(String::from(""), None, Tokens::new(Vec::new()))
    };

    let address = pg::Address::new();
    address.create(&conn);
    address.input(&conn, AddrStream::new(GeoStream::new(args.input), context, None));

    if !is_hecate {
        // Hecate Addresses will already have ids present
        // If not hecate, create sequential ids for processing
        address.seq_id(&conn);
    }

    address.index(&conn);

    match args.buildings {
        Some(buildings) => {
            let polygon = pg::Polygon::new(String::from("buildings"));
            polygon.create(&conn);
            polygon.input(&conn, PolyStream::new(GeoStream::new(Some(buildings)), None));
            polygon.index(&conn);
        },
        None => ()
    };

    let count = address.count(&conn);
    let cpus = num_cpus::get() as i64;
    let mut web = Vec::new();

    let batch_extra = count % cpus;
    let batch = (count - batch_extra) / cpus;

    let (tx, rx) = crossbeam::channel::unbounded();

    for cpu in 0..cpus {
        let db_conn = args.db.clone();
        let tx_n = tx.clone();

        let strand = match thread::Builder::new().name(format!("Exact Dup #{}", &cpu)).spawn(move || {
            let mut min_id = batch * cpu;
            let max_id = batch * cpu + batch + batch_extra;

            if cpu != 0 {
                min_id = min_id + batch_extra + 1;
            }

            let conn = match Connection::connect(format!("postgres://postgres@localhost:5432/{}", &db_conn).as_str(), TlsMode::None) {
                Ok(conn) => conn,
                Err(err) => panic!("Connection Error: {}", err.to_string())
            };

            exact_batch(is_hecate, min_id, max_id, conn, tx_n);
        }) {
            Ok(strand) => strand,
            Err(err) => panic!("Thread Creation Error: {}", err.to_string())
        };

        web.push(strand);
    }

    drop(tx);

    match args.output {
        Some(outpath) => {
            let outfile = match File::create(outpath) {
                Ok(outfile) => outfile,
                Err(err) => { panic!("Unable to write to output file: {}", err); }
            };

            output(is_hecate, rx, BufWriter::new(outfile))
        },
        None => output(is_hecate, rx, std::io::stdout().lock())
    }

    for strand in web {
        strand.join().unwrap();
    }

    Ok(cx.boolean(true))
}

fn output(is_hecate: bool, receive: crossbeam::Receiver<Address>, mut sink: impl Write) {
    for result in receive.iter() {

        let result: String = match is_hecate {
            true => geojson::GeoJson::Feature(result.to_geojson(hecate::Action::Delete, false)).to_string(),
            false => geojson::GeoJson::Feature(result.to_geojson(hecate::Action::None, false)).to_string()
        };

        if sink.write(format!("{}\n", result).as_bytes()).is_err() {
            panic!("Failed to write to output stream");
        }
    }

    if sink.flush().is_err() {
        panic!("Failed to flush output stream");
    }
}

fn exact_batch(is_hecate: bool, min_id: i64, max_id: i64, conn: postgres::Connection, tx: crossbeam::Sender<Address>) {
    let exact_dups = match pg::Cursor::new(conn, format!(r#"
        SELECT
            JSON_Build_Object(
                'primary', JSON_Build_Object(
                    'id', a.id,
                    'version', a.version,
                    'names', a.names,
                    'number', a.number,
                    'source', a.source,
                    'output', a.output,
                    'props', a.props,
                    'geom', ST_AsGeoJSON(ST_Force2D(a.geom))::TEXT
                ),
                'proximal', (
                    SELECT
                        JSON_AGG(JSON_Build_Object(
                            'id', id,
                            'version', version,
                            'names', names,
                            'number', number,
                            'source', source,
                            'output', output,
                            'props', props,
                            'geom', ST_AsGeoJSON(ST_Force2D(geom))::TEXT
                        ))
                    FROM
                        address
                    WHERE
                        ST_DWithin(a.geom, geom, 0.00001)
                )
            )
        FROM
            address a
        WHERE
            a.id >= {min_id}
            AND a.id <= {max_id}
    "#,
        min_id = min_id,
        max_id = max_id
    )) {
        Ok(cursor) => cursor,
        Err(err) => panic!("ERR: {}", err.to_string())
    };

    for dup_feats in exact_dups {
        let mut dup_feats = match dup_feats {
            serde_json::value::Value::Object(object) => object,
            _ => panic!("result must be JSON Object")
        };

        let feat: Address = match Address::from_value(dup_feats.remove(&String::from("primary")).unwrap()) {
            Ok(feat) => feat,
            Err(err) => panic!("Address Error: {}", err.to_string())
        };

        let mut dup_feats: Vec<Address> = match dup_feats.remove(&String::from("proximal")).unwrap() {
            serde_json::value::Value::Array(feats) => {
                let mut addrfeats = Vec::with_capacity(feats.len());

                for feat in feats {
                    addrfeats.push(match Address::from_value(feat) {
                        Ok(feat) => feat,
                        Err(err) => panic!("Vec<Address> Error: {}", err.to_string())
                    });
                }

                addrfeats
            },
            _ => panic!("Duplicate Features should be Vec<Value>")
        };

        //
        // For now the dup logic is rather simple & strict
        // - Number must be the same - apt numbers included
        // - Text synonyms must match
        dup_feats = dup_feats.into_iter().filter(|dup_feat| {
            dup_feat.number == feat.number
            && dup_feat.names == feat.names
        }).collect();

        dup_feats.sort_by(|a, b| {
            if a.id.unwrap() < b.id.unwrap() {
                std::cmp::Ordering::Less
            } else if a.id.unwrap() > b.id.unwrap() {
                std::cmp::Ordering::Greater
            } else {
                std::cmp::Ordering::Equal
            }
        });

        //
        // Since this operation is performed in parallel - duplicates could be potentially
        // processed by multiple threads - resulting in duplicate output. To avoid this
        // the dup_feat will only be processed if the lowest ID in the match falls within
        // the min_id/max_id that the given thread is processing
        //
        if dup_feats[0].id.unwrap() < feat.id.unwrap() || dup_feats[0].id.unwrap() < min_id || dup_feats[0].id.unwrap() > max_id {
            continue;
        }

        if is_hecate {
            // If it is hecate output - delete all features
            // but the desired feature

            for dup_feat in dup_feats {
                if dup_feat.id.unwrap() != feat.id.unwrap() {
                    tx.send(dup_feat).unwrap();
                }
            }
        } else {
            // If not hecate, only print the desired feature

            tx.send(feat).unwrap();
        }
    }
}

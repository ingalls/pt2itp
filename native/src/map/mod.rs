use std::convert::From;
use postgres::{Connection, TlsMode};
use std::collections::HashMap;
use std::thread;

use crate::Context as CrateContext;
use crate::{Tokens, Name, Names};
use crate::util::linker;

use neon::prelude::*;

use super::stream::{
    GeoStream,
    AddrStream,
    NetStream
};

use super::pg;
use super::pg::{Table, InputTable};

pub fn pg_init(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let db = match cx.argument_opt(0) {
        Some(arg) => arg.downcast::<JsString>().or_throw(&mut cx)?.value(),
        None => String::from("pt_test")
    };

    let conn = match Connection::connect(format!("postgres://postgres@localhost:5432/{}", &db).as_str(), TlsMode::None) {
        Ok(conn) => conn,
        Err(err) => {
            println!("Connection Error: {}", err.to_string());
            panic!("Connection Error: {}", err.to_string());
        }
    };

    let address = pg::Address::new();
    let network = pg::Network::new();

    address.create(&conn);
    network.create(&conn);

    let networkcluster = pg::NetworkCluster::new(false);
    let addresscluster = pg::AddressCluster::new(false);

    networkcluster.create(&conn);
    addresscluster.create(&conn);

    let networkcluster = pg::NetworkCluster::new(true);
    let addresscluster = pg::AddressCluster::new(true);

    networkcluster.create(&conn);
    addresscluster.create(&conn);

    let intersections = pg::Intersections::new();
    intersections.create(&conn);

    Ok(cx.boolean(true))
}

pub fn pg_optimize(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let db = match cx.argument_opt(0) {
        Some(arg) => arg.downcast::<JsString>().or_throw(&mut cx)?.value(),
        None => String::from("pt_test")
    };

    let conn = match Connection::connect(format!("postgres://postgres@localhost:5432/{}", &db).as_str(), TlsMode::None) {
        Ok(conn) => conn,
        Err(err) => {
            println!("Connection Error: {}", err.to_string());
            panic!("Connection Error: {}", err.to_string());
        }
    };

    let address = pg::Address::new();
    let network = pg::Network::new();

    address.seq_id(&conn);
    network.seq_id(&conn);

    address.index(&conn);
    network.index(&conn);

    Ok(cx.boolean(true))
}

#[derive(Serialize, Deserialize, Debug)]
struct MapArgs {
    db: String,
    context: Option<super::types::InputContext>,
    seq: bool,
    input: Option<String>,
    errors: Option<String>
}

impl MapArgs {
    pub fn new() -> Self {
        MapArgs {
            db: String::from("map"),
            seq: true,
            context: None,
            input: None,
            errors: None
        }
    }
}

pub fn import_addr(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let args: MapArgs = match cx.argument_opt(0) {
        None => MapArgs::new(),
        Some(arg) => {
            if arg.is_a::<JsUndefined>() || arg.is_a::<JsNull>() {
                MapArgs::new()
            } else {
                let arg_val = cx.argument::<JsValue>(0)?;
                neon_serde::from_value(&mut cx, arg_val)?
            }
        }
    };

    let conn = match Connection::connect(format!("postgres://postgres@localhost:5432/{}", &args.db).as_str(), TlsMode::None) {
        Ok(conn) => conn,
        Err(err) => {
            println!("Connection Error: {}", err.to_string());
            panic!("Connection Error: {}", err.to_string());
        }
    };

    let context = match args.context {
        Some(context) => CrateContext::from(context),
        None => CrateContext::new(String::from(""), None, Tokens::new(HashMap::new()))
    };

    let address = pg::Address::new();
    address.create(&conn);
    address.input(&conn, AddrStream::new(GeoStream::new(args.input), context, args.errors));
    if args.seq {
        address.seq_id(&conn);
    }
    address.index(&conn);

    Ok(cx.boolean(true))
}

pub fn import_net(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let args: MapArgs = match cx.argument_opt(0) {
        None => MapArgs::new(),
        Some(arg) => {
            if arg.is_a::<JsUndefined>() || arg.is_a::<JsNull>() {
                MapArgs::new()
            } else {
                let arg_val = cx.argument::<JsValue>(0)?;
                neon_serde::from_value(&mut cx, arg_val)?
            }
        }
    };

    let conn = match Connection::connect(format!("postgres://postgres@localhost:5432/{}", &args.db).as_str(), TlsMode::None) {
        Ok(conn) => conn,
        Err(err) => {
            println!("Connection Error: {}", err.to_string());
            panic!("Connection Error: {}", err.to_string());
        }
    };

    let context = match args.context {
        Some(context) => CrateContext::from(context),
        None => CrateContext::new(String::from(""), None, Tokens::new(HashMap::new()))
    };

    let network = pg::Network::new();
    network.create(&conn);
    network.input(&conn, NetStream::new(GeoStream::new(args.input), context, args.errors));
    if args.seq {
        network.seq_id(&conn);
    }
    network.index(&conn);

    Ok(cx.boolean(true))
}

pub fn cluster_addr(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let db = match cx.argument_opt(0) {
        Some(arg) => arg.downcast::<JsString>().or_throw(&mut cx)?.value(),
        None => String::from("pt_test")
    };

    let orphan = match cx.argument_opt(1) {
        Some(arg) => arg.downcast::<JsBoolean>().or_throw(&mut cx)?.value(),
        None => false
    };

    let conn = match Connection::connect(format!("postgres://postgres@localhost:5432/{}", &db).as_str(), TlsMode::None) {
        Ok(conn) => conn,
        Err(err) => {
            println!("Connection Error: {}", err.to_string());
            panic!("Connection Error: {}", err.to_string());
        }
    };

    let cluster = pg::AddressCluster::new(orphan);
    cluster.create(&conn);
    cluster.generate(&conn);
    cluster.index(&conn);

    Ok(cx.boolean(true))
}

pub fn link_addr(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let db = match cx.argument_opt(0) {
        Some(arg) => arg.downcast::<JsString>().or_throw(&mut cx)?.value(),
        None => String::from("pt_test")
    };

    let conn = match Connection::connect(format!("postgres://postgres@localhost:5432/{}", &db).as_str(), TlsMode::None) {
        Ok(conn) => conn,
        Err(err) => {
            println!("Connection Error: {}", err.to_string());
            panic!("Connection Error: {}", err.to_string());
        }
    };

    let count = pg::Address::new().max(&conn);

    let cpus = num_cpus::get() as i64;
    let mut web = Vec::new();

    let batch_extra = count % cpus;
    let batch = (count  - batch_extra) / cpus;

    for cpu in 0..cpus {
        let db_conn = db.clone();

        let strand = match thread::Builder::new().name(format!("Linker #{}", &cpu)).spawn(move || {
            let mut min_id = batch * cpu;
            let max_id = batch * cpu + batch + batch_extra;

            if cpu != 0 {
                min_id = min_id + batch_extra + 1;
            }

            let conn = match Connection::connect(format!("postgres://postgres@localhost:5432/{}", &db_conn).as_str(), TlsMode::None) {
                Ok(conn) => conn,
                Err(err) => {
                    println!("Connection Error: {}", err.to_string());
                    panic!("Connection Error: {}", err.to_string());
                }
            };

            let mut it = min_id;
            while it < max_id {
                link_process(&conn, it, it + 5000);
                it += 5001;
            }
        }) {
            Ok(strand) => strand,
            Err(err) => {
                println!("Thread Creation Error: {}", err.to_string());
                panic!("Thread Creation Error: {}", err.to_string());
            }
        };

        web.push(strand);
    }

    for strand in web {
        match strand.join() {
            Err(err) => {
                if let Some(string) = err.downcast_ref::<String>() {
                    println!("Thread Error: {}", string);
                    panic!("Thread Error: {}", string);
                } else {
                    println!("Thread Error: {:?}", err);
                    panic!("Thread Error: {:?}", err);
                }
            },
            _ => ()
        };
    }

    Ok(cx.boolean(true))
}

#[derive(Serialize, Deserialize)]
pub struct DbSerial {
    id: i64,
    names: Vec<Name>
}

pub struct DbType {
    id: i64,
    names: Names
}

pub fn link_process(conn: &impl postgres::GenericConnection, min: i64, max: i64) {
    match conn.query("
        SELECT
            a.id AS id,
            a.names::JSON AS name,
            Array_To_Json((Array_Agg(
                JSON_Build_Object(
                    'id', nc.id,
                    'names', nc.names::JSON
                )
                ORDER BY ST_Distance(nc.geom, a.geom)
            ))[:10]) AS nets
        FROM
            address a
            INNER JOIN network_cluster nc
            ON ST_DWithin(a.geom, nc.geom, 0.02)
        WHERE a.id >= $1 AND a.id <= $2
        GROUP BY
            a.id,
            a.names,
            a.geom
    ", &[&min, &max]) {
        Ok(results) => {
            let trans = match conn.transaction() {
                Err(err) => {
                    println!("Transaction Create Error: {}", err.to_string());
                    panic!("Transaction Create Error: {}", err.to_string());
                },
                Ok(trans) => trans
            };

            for result in results.iter() {
                let id: i64 = result.get(0);
                let names: serde_json::Value = result.get(1);
                let names: Vec<Name> = match serde_json::from_value(names) {
                    Err(err) => {
                        println!("JSON Failure: {}", err.to_string());
                        panic!("JSON Failure: {}", err.to_string());
                    },
                    Ok(names) => names
                };

                let names = Names {
                    names: names
                };

                let dbpotentials: serde_json::Value = result.get(2);

                let dbpotentials: Vec<DbSerial> = match serde_json::from_value(dbpotentials) {
                    Err(err) => {
                        println!("JSON Failure: {}", err.to_string());
                        panic!("JSON Failure: {}", err.to_string());
                    },
                    Ok(names) => names
                };

                let mut potentials: Vec<DbType> = Vec::with_capacity(dbpotentials.len());
                for potential in dbpotentials {
                    potentials.push(DbType {
                        id: potential.id,
                        names: Names {
                            names: potential.names
                        }
                    });
                }

                let primary = linker::Link::new(id, &names);
                let potentials: Vec<linker::Link> = potentials.iter().map(|potential| {
                    linker::Link::new(potential.id, &potential.names)
                }).collect();

                match linker::linker(primary, potentials, false) {
                    Some(link_match) => {
                        match trans.execute(&*"
                            UPDATE address SET netid = $1 WHERE id = $2;
                        ", &[&link_match.id, &id]) {
                            Err(err) => {
                                println!("Transaction Statement Error: {}", err.to_string());
                                panic!("Transaction Statement Error: {}", err.to_string());
                            },
                            Ok(trans) => trans
                        };
                    },
                    None => ()
                };
            }

            match trans.commit() {
                Err(err) => {
                    println!("Transaction Commit Error: {}", err.to_string());
                    panic!("Transaction Commit Error: {}", err.to_string());
                },
                _ => ()
            };
        },
        Err(err) => {
            println!("{}", err.to_string());
            panic!("{}", err.to_string());
        }
    };
}

pub fn cluster_net(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let db = match cx.argument_opt(0) {
        Some(arg) => arg.downcast::<JsString>().or_throw(&mut cx)?.value(),
        None => String::from("pt_test")
    };

    let orphan = match cx.argument_opt(1) {
        Some(arg) => arg.downcast::<JsBoolean>().or_throw(&mut cx)?.value(),
        None => false
    };

    let conn = match Connection::connect(format!("postgres://postgres@localhost:5432/{}", &db).as_str(), TlsMode::None) {
        Ok(conn) => conn,
        Err(err) => {
            println!("Connection Error: {}", err.to_string());
            panic!("Connection Error: {}", err.to_string());
        }
    };

    let cluster = pg::NetworkCluster::new(orphan);
    cluster.create(&conn);
    cluster.generate(&conn);
    cluster.index(&conn);

    Ok(cx.boolean(true))
}

pub fn intersections(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let db = match cx.argument_opt(0) {
        Some(arg) => arg.downcast::<JsString>().or_throw(&mut cx)?.value(),
        None => String::from("pt_test")
    };

    let conn = match Connection::connect(format!("postgres://postgres@localhost:5432/{}", &db).as_str(), TlsMode::None) {
        Ok(conn) => conn,
        Err(err) => {
            println!("Connection Error: {}", err.to_string());
            panic!("Connection Error: {}", err.to_string());
        }
    };

    let intersections = pg::Intersections::new();
    intersections.create(&conn);
    intersections.generate(&conn);
    intersections.index(&conn);

    Ok(cx.boolean(true))
}

///
/// Dedupes names after address clusters and network clusters have been created and matched
/// before final geojson is output. Names have already been titlecased and synonyms generated.
///
pub fn dedupe_syn(mut cx: FunctionContext) -> JsResult<JsArray> {
    let names: Vec<Name> = match cx.argument_opt(0) {
        None => Vec::new(),
        Some(arg) => {
            if arg.is_a::<JsUndefined>() || arg.is_a::<JsNull>() {
                Vec::new()
            } else {
                let arg_val = cx.argument::<JsValue>(0)?;
                neon_serde::from_value(&mut cx, arg_val)?
            }
        }
    };

    if names.is_empty() { return Ok(cx.empty_array()); }

    // don't use Names::new() so we're not generating synonyms again
    let mut names = Names {
        names: names
    };

    names.empty();
    names.sort();
    names.dedupe();

    let display_names: Vec<String> = names.names.into_iter().map(|name| name.display).collect();

    let out = JsArray::new(&mut cx, display_names.len() as u32);

    for (i, name) in display_names.iter().enumerate() {
            let js_string = cx.string(name);
            out.set(&mut cx, i as u32, js_string).unwrap();
    }

    Ok(out)
}

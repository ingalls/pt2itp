use std::convert::From;
use postgres::{Connection, TlsMode};
use std::collections::HashMap;
use std::thread;
use std::fs::File;
use std::io::{BufWriter, Write};

use neon::prelude::*;

use crate::{
    Address,
    hecate,
    util::linker,
    stream::{GeoStream, AddrStream}
};

use super::pg;
use super::pg::{Table, InputTable};

#[derive(Serialize, Deserialize, Debug)]
struct ConflateArgs {
    db: String,
    context: Option<super::types::InputContext>,
    in_address: Option<String>,
    in_persistent: Option<String>,
    error_address: Option<String>,
    error_persistent: Option<String>,
    output: Option<String>
}

impl ConflateArgs {
    pub fn new() -> Self {
        ConflateArgs {
            db: String::from("dedupe"),
            context: None,
            in_address: None,
            in_persistent: None,
            error_address: None,
            error_persistent: None,
            output: None
        }
    }
}

pub fn conflate(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let args: ConflateArgs = match cx.argument_opt(0) {
        None => ConflateArgs::new(),
        Some(arg) => {
            if arg.is_a::<JsUndefined>() || arg.is_a::<JsNull>() {
                ConflateArgs::new()
            } else {
                let arg_val = cx.argument::<JsValue>(0)?;
                neon_serde::from_value(&mut cx, arg_val)?
            }
        }
    };

    if args.in_persistent.is_none() {
        panic!("in_persistent argument is required");
    } else if args.in_address.is_none() {
        panic!("in_address argument is required");
    }

    let conn = Connection::connect(format!("postgres://postgres@localhost:5432/{}", &args.db).as_str(), TlsMode::None).unwrap();

    let context = match args.context {
        Some(context) => crate::Context::from(context),
        None => crate::Context::new(String::from(""), None, crate::Tokens::new(HashMap::new()))
    };

    let pgaddress = pg::Address::new();
    pgaddress.create(&conn);
    pgaddress.input(&conn, AddrStream::new(GeoStream::new(args.in_persistent), context.clone(), args.error_persistent));
    pgaddress.index(&conn);

    for addr in AddrStream::new(GeoStream::new(args.in_address), context.clone(), args.error_address) {
        let rows = conn.query("
            SELECT
                ST_Distance(ST_SetSRID(ST_Point($2, $3), 4326), p.geom),
                json_build_object(
                    'id', p.id,
                    'number', p.number,
                    'version', p.version,
                    'names', p.names,
                    'output', p.output,
                    'source', p.source,
                    'props', p.props,
                    'geom', ST_AsGeoJSON(p.geom)::TEXT
                )
            FROM
                address p
            WHERE
                p.number = $1
                AND ST_DWithin(ST_SetSRID(ST_Point($2, $3), 4326), p.geom, 0.01);
        ", &[ &addr.number, &addr.geom[0], &addr.geom[1] ]).unwrap();

        let mut persistents: Vec<Address> = Vec::with_capacity(rows.len());

        for row in rows.iter() {
            let dist: f64 = row.get(0);
            if dist > 0.5 {
                continue
            }

            let paddr: serde_json::Value = row.get(1);
            let paddr = Address::from_value(paddr).unwrap();
            persistents.push(paddr);
        }

        match compare(&addr, &mut persistents) {
            Some(link) => {

            },
            None => {

            }
        };
    }

    Ok(cx.boolean(true))
}

///
/// Compare a given address against a list of proximal addresses
///
/// The function will return None if the address does not exist in the
/// proximal set and should be considered a new address
///
/// The function will return Some(i64) if the address matches an existing address
///
pub fn compare(potential: &Address, persistents: &mut Vec<Address>) -> Option<i64> {
    // The address does not exist in the database and should be created
    if persistents.len() == 0 {
        return None;
    }

    let potential_link = linker::Link::new(0, &potential.names);

    let persistent_links: Vec<linker::Link> = persistents.iter().map(|persistent| {
        linker::Link::new(persistent.id.unwrap(), &persistent.names)
    }).collect();

    match linker::linker(potential_link, persistent_links) {
        Some(link) => Some(link.id),
        None => None
    }
}

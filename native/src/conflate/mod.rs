use geojson::GeoJson;
use postgres::{Connection, TlsMode};
use std::collections::HashMap;
use std::convert::From;
use std::fs::File;
use std::io::{BufWriter, Write};

use neon::prelude::*;

use crate::{
    hecate,
    stream::{AddrStream, GeoStream},
    types::name::InputName,
    util::linker,
    Address, Names,
};

use super::pg;
use super::pg::{InputTable, Table};

#[derive(Serialize, Deserialize, Debug)]
struct ConflateArgs {
    db: String,
    context: Option<super::types::InputContext>,
    in_address: Option<String>,
    in_persistent: Option<String>,
    error_address: Option<String>,
    error_persistent: Option<String>,
    output: Option<String>,
}

impl ConflateArgs {
    pub fn new() -> Self {
        ConflateArgs {
            db: String::from("conflate"),
            context: None,
            in_address: None,
            in_persistent: None,
            error_address: None,
            error_persistent: None,
            output: None,
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
                let arg_obj = cx.argument::<JsObject>(0)?;

                let db = arg_obj.get(&mut cx, "db")?;
                if db.is_a::<JsUndefined>() || db.is_a::<JsNull>() {
                    let default = cx.string("conflate");
                    arg_obj.set(&mut cx, "db", default)?;
                }

                let arg_val = arg_obj.as_value(&mut cx);
                neon_serde::from_value(&mut cx, arg_val)?
            }
        }
    };
    if args.in_persistent.is_none() {
        panic!("in_persistent argument is required");
    } else if args.in_address.is_none() {
        panic!("in_address argument is required");
    }

    let mut output = match args.output {
        None => panic!("Output file required"),
        Some(output) => match File::create(output) {
            Ok(outfile) => BufWriter::new(outfile),
            Err(err) => panic!("Unable to write to output file: {}", err),
        },
    };

    let conn = Connection::connect(
        format!("postgres://postgres@localhost:5432/{}", &args.db).as_str(),
        TlsMode::None,
    )
    .unwrap();

    conn.execute(
        "
        DROP TABLE IF EXISTS modified;
    ",
        &[],
    )
    .unwrap();

    conn.execute(
        "
        CREATE UNLOGGED TABLE modified (
            id BIGINT,
            version BIGINT,
            netid BIGINT,
            names JSONB,
            number TEXT,
            source TEXT,
            output BOOLEAN,
            interpolate BOOLEAN,
            props JSONB,
            geom GEOMETRY(POINT, 4326)
        );
    ",
        &[],
    )
    .unwrap();

    let context = match args.context {
        Some(context) => crate::Context::from(context),
        None => crate::Context::new(
            String::from(""),
            None,
            crate::Tokens::new(HashMap::new(), HashMap::new(), HashMap::new()),
        ),
    };

    let pgaddress = pg::Address::new();
    pgaddress.create(&conn);
    pgaddress.input(
        &conn,
        AddrStream::new(
            GeoStream::new(args.in_persistent),
            context.clone(),
            args.error_persistent,
        ),
    );
    pgaddress.index(&conn);
    pg::address::pre_conflate(&conn);

    for addr in AddrStream::new(
        GeoStream::new(args.in_address),
        context.clone(),
        args.error_address,
    ) {
        // find all persistent addresses with the same address number
        // within 0.01 decimal degrees (~ 1 km) of the new address
        let rows = conn
            .query(
                "
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
        ",
                &[&addr.number, &addr.geom[0], &addr.geom[1]],
            )
            .unwrap();

        let mut persistents: Vec<Address> = Vec::with_capacity(rows.len());

        for row in rows.iter() {
            let paddr: serde_json::Value = row.get(1);
            let paddr = Address::from_value(paddr).unwrap();
            persistents.push(paddr);
        }

        match compare(&addr, &mut persistents) {
            // persistent address matches new address, consider modifying persistent address
            Some(link_id) => {
                let mut pmatches: Vec<&mut Address> = persistents
                    .iter_mut()
                    .filter(|persistent| {
                        // addresses with output set to false should not be modified
                        link_id == persistent.id.unwrap() && persistent.output
                    })
                    .collect();

                match pmatches.len() {
                    // if all matches have output set to false, don't modify
                    0 => continue,
                    1 => {
                        let paddr = pmatches.pop().unwrap();
                        // if the new address has names the persistent address does not, modify persistent
                        if paddr.names.has_diff(&addr.names) {
                            // preference new names over persistent names
                            let mut combined_names = addr.names;
                            combined_names.concat(paddr.names.clone());
                            combined_names.empty();
                            combined_names.sort();
                            combined_names.dedupe();

                            let mut new_names: Vec<InputName> =
                                Vec::with_capacity(combined_names.names.len());
                            for name in combined_names.names {
                                new_names.push(InputName::from(name));
                            }
                            let new_names = serde_json::to_value(new_names).unwrap();

                            // overwrite the persistent street property with the combined names
                            // retain all other persistent address properties
                            paddr.props.insert(String::from("street"), new_names);
                            paddr.to_db(&conn, "modified").unwrap();
                        }
                    }
                    _ => panic!("Duplicate IDs are not allowed in input data"),
                }
            }
            // no match in persistent addresses, write new address to output
            None => {
                output
                    .write(
                        format!(
                            "{}\n",
                            GeoJson::Feature(addr.to_geojson(hecate::Action::Create, false))
                                .to_string()
                        )
                        .as_bytes(),
                    )
                    .unwrap();
            }
        };
    }

    let modifieds = pg::Cursor::new(
        conn,
        format!(
            "
        SELECT
            json_build_object(
                'id', id,
                'type', 'Feature',
                'action', 'modify',
                'version', version,
                'properties', JSONB_AGG(props),
                'geometry', ST_AsGeoJSON(geom)::JSON
            )
        FROM
            modified
        GROUP BY
            id,
            version,
            geom
    "
        ),
    )
    .unwrap();

    for mut modified in modifieds {
        let modified_obj = modified.as_object_mut().unwrap();
        let mut props = modified_obj.remove(&String::from("properties")).unwrap();
        let props_arr = props.as_array_mut().unwrap();
        if props_arr.len() == 1 {
            let props = props_arr.pop().unwrap();

            modified_obj.insert(String::from("properties"), props);
        } else {
            // if a single persistent address matches multiple new addresses and should be updated

            // Future TODO: This currently just grabs the first property
            // and merges names together, it does not attempt to merge
            // other properties
            let mut props_base = props_arr.pop().unwrap();
            let props_base_obj = props_base.as_object_mut().unwrap();
            let names_base: Vec<InputName> =
                serde_json::from_value(props_base_obj.remove(&String::from("street")).unwrap())
                    .unwrap();

            let mut names_base = Names::from_input(names_base, &context);
            for prop in props_arr {
                let prop_obj = prop.as_object_mut().unwrap();

                let names_new: Vec<InputName> =
                    serde_json::from_value(prop_obj.remove(&String::from("street")).unwrap())
                        .unwrap();
                let names_new = Names::from_input(names_new, &context);

                names_base.concat(names_new);
            }
            names_base.empty();
            names_base.sort();
            names_base.dedupe();
            let mut names_final = Vec::with_capacity(names_base.names.len());
            for name in names_base.names {
                names_final.push(InputName::from(name));
            }

            props_base_obj.insert(
                String::from("street"),
                serde_json::to_value(names_final).unwrap(),
            );
            modified_obj.insert(String::from("properties"), props_base);
        }

        let modified = match modified {
            serde_json::Value::Object(modified) => modified,
            _ => panic!("Modified should always be an object"),
        };

        let modified: geojson::Feature = match geojson::Feature::from_json_object(modified) {
            Ok(m) => m,
            Err(e) => panic!(e),
        };

        output
            .write(format!("{}\n", modified.to_string()).as_bytes())
            .unwrap();
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
    let persistent_links: Vec<linker::Link> = persistents
        .iter()
        .map(|persistent| linker::Link::new(persistent.id.unwrap(), &persistent.names))
        .collect();

    match linker::linker(potential_link, persistent_links, true) {
        Some(link) => Some(link.id),
        None => None,
    }
}

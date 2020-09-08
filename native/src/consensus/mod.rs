use postgres::{Connection, TlsMode};
use std::collections::HashMap;
use std::convert::From;

mod agreement;

use neon::prelude::*;

use crate::{
    stream::{AddrStream, GeoStream},
    util::linker,
    Address,
};

use super::pg;
use super::pg::{InputTable, Table};

const SEARCH_RADIUS: f64 = 0.01;
const WGS84: i32 = 4326;

#[derive(Serialize, Deserialize, Debug)]
struct ConsensusArgs {
    db: String,
    context: Option<super::types::InputContext>,
    threshold: Option<u32>,
    sources: Vec<String>,
    query_points: String,
    error_sources: Option<String>,
    error_query_points: Option<String>,
}

impl ConsensusArgs {
    pub fn new() -> Self {
        ConsensusArgs {
            db: String::from("consensus"),
            context: None,
            threshold: None,
            sources: vec![String::from("")],
            query_points: String::from(""),
            error_sources: None,
            error_query_points: None,
        }
    }
}

//
// Calculate consensus agreement across multiple sets of address points
//
// This function will take in a multiple sets of address points and stream them into the database.
// It then loops through the set of query points and uses the linker to find a matching address
// from each source. It sends those points to the agreement module to continually update the agreement
// metrics, then returns those metrics as the final result after each query point is processed.
//
pub fn consensus(mut cx: FunctionContext) -> JsResult<JsValue> {
    let args: ConsensusArgs = match cx.argument_opt(0) {
        None => ConsensusArgs::new(),
        Some(arg) => {
            if arg.is_a::<JsUndefined>() || arg.is_a::<JsNull>() {
                ConsensusArgs::new()
            } else {
                let arg_obj = cx.argument::<JsObject>(0)?;

                let db = arg_obj.get(&mut cx, "db")?;
                if db.is_a::<JsUndefined>() || db.is_a::<JsNull>() {
                    let default = cx.string("consensus");
                    arg_obj.set(&mut cx, "db", default)?;
                }

                let arg_val = arg_obj.as_value(&mut cx);
                neon_serde::from_value(&mut cx, arg_val)?
            }
        }
    };

    let sources = args.sources;
    let query_points = args.query_points;

    let conn = Connection::connect(
        format!("postgres://postgres@localhost:5432/{}", &args.db).as_str(),
        TlsMode::None,
    )
    .unwrap();

    let context = match args.context {
        Some(context) => crate::Context::from(context),
        None => crate::Context::new(
            String::from(""),
            None,
            crate::Tokens::new(HashMap::new(), HashMap::new()),
        ),
    };

    let pgaddress = pg::Address::new();
    pgaddress.create(&conn);
    for source in sources {
        pgaddress.input(
            &conn,
            AddrStream::new(
                GeoStream::new(Some(source)),
                context.clone(),
                args.error_sources.clone(),
            ),
        );
    }
    pgaddress.index(&conn);

    let mut source_map: HashMap<String, Option<(f64, f64)>> = HashMap::new();
    let rows = conn
        .query("SELECT source FROM address GROUP BY source", &[])
        .unwrap();
    for row in rows.iter() {
        let source: String = row.get(0);
        source_map.insert(source, None);
    }

    let query = format!(
        "
        SELECT
            ST_Distance(ST_SetSRID(ST_Point($2, $3), {0}), p.geom),
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
            AND p.source = $4
            AND ST_DWithin(ST_SetSRID(ST_Point($2, $3), {0}), p.geom, {1});
    ",
        WGS84, SEARCH_RADIUS
    );

    let sources: Vec<String> = source_map.keys().cloned().collect();
    let threshold = args.threshold.unwrap_or(25);
    let mut agreement = agreement::Agreement::new(threshold);

    for addr in AddrStream::new(
        GeoStream::new(Some(query_points)),
        context.clone(),
        args.error_query_points,
    ) {
        for source in &sources {
            // pull the addresses matching this address number within 1 km
            let rows = conn
                .query(
                    &query,
                    &[&addr.number, &addr.geom[0], &addr.geom[1], &source],
                )
                .unwrap();

            // populate potential_matches with db response
            let mut potential_matches: Vec<Address> = Vec::with_capacity(rows.len());
            for row in rows.iter() {
                let paddr: serde_json::Value = row.get(1);
                let paddr = Address::from_value(paddr).unwrap();
                potential_matches.push(paddr);
            }

            // find a match using linker
            match compare(&addr, &mut potential_matches) {
                Some(link_id) => {
                    let mut pmatches: Vec<Address> = potential_matches
                        .into_iter()
                        .filter(|potential| link_id == potential.id.unwrap())
                        .collect();

                    match pmatches.len() {
                        0 => continue,
                        1 => {
                            let paddr = pmatches.pop();
                            let coords = paddr.map(|p| (p.geom[0], p.geom[1]));
                            // update source_map with current match for source
                            source_map
                                .entry(source.to_string())
                                .and_modify(|e| *e = coords);
                        }
                        _ => panic!(
                            "{} is a duplicate ID - this is not allowed in input data",
                            link_id
                        ),
                    }
                }
                None => (),
            };
        }

        // update agreement with current set of matched points
        agreement.process_points(&source_map);
    }

    Ok(neon_serde::to_value(&mut cx, &agreement)?)
}

///
/// Compare a given address against a list of proximal addresses
///
/// The function will return None if the address does not exist in the
/// proximal set and should be considered a new address
///
/// The function will return Some(i64) if the address matches an existing address
///
pub fn compare(addr: &Address, potentials: &mut Vec<Address>) -> Option<i64> {
    // No nearby addresses with this number
    if potentials.len() == 0 {
        return None;
    }
    let addr_link = linker::Link::new(0, &addr.names);
    let potential_links: Vec<linker::Link> = potentials
        .iter()
        .map(|potential| linker::Link::new(potential.id.unwrap(), &potential.names))
        .collect();

    linker::linker(addr_link, potential_links, true).map(|link| link.id)
}

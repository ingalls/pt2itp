#[macro_use]
extern crate neon;
#[macro_use]
extern crate serde_derive;
extern crate crossbeam;
extern crate geo;
extern crate geojson;
extern crate kodama;
extern crate neon_serde;
extern crate num_cpus;
extern crate postgres;
extern crate regex;
extern crate rstar;
extern crate serde_json;

extern crate pt2itp_lib;

// Internal Helper Libraries
pub mod stream;
pub use pt2itp_lib::text;
pub mod util;
pub use pt2itp_lib::pg;
pub use pt2itp_lib::types;

// Helper to current node fn
pub mod map;

// External PT2ITP Modes
pub mod classify;
pub mod conflate;
pub mod consensus;
pub mod convert;
pub mod dedupe;
pub mod stats;

pub use pt2itp_lib::types::Address;
pub use pt2itp_lib::types::Network;
pub use pt2itp_lib::types::Polygon;

pub use pt2itp_lib::text::Tokenized;
pub use pt2itp_lib::text::Tokens;
pub use pt2itp_lib::types::hecate;
pub use pt2itp_lib::types::Context;

pub use pt2itp_lib::types::Name;
pub use pt2itp_lib::types::Names;
pub use pt2itp_lib::types::Source;

use neon::prelude::*;

pub fn tokenize_name(mut cx: FunctionContext) -> JsResult<JsValue> {
    let name = cx.argument::<JsString>(0)?.value();
    let context = cx.argument::<JsValue>(1)?;
    let context: crate::types::InputContext = neon_serde::from_value(&mut cx, context)?;
    let context = crate::Context::from(context);
    let tokenized = context.tokens.process(&name, &context.country);

    Ok(neon_serde::to_value(&mut cx, &tokenized)?)
}

// Functions registered here will be made avaliable to be called from NodeJS
register_module!(mut m, {
    m.export_function("pg_init", map::pg_init)?;
    m.export_function("pg_optimize", map::pg_optimize)?;

    m.export_function("import_addr", map::import_addr)?;
    m.export_function("import_net", map::import_net)?;

    m.export_function("link_addr", map::link_addr)?;

    m.export_function("cluster_addr", map::cluster_addr)?;
    m.export_function("cluster_net", map::cluster_net)?;

    m.export_function("intersections", map::intersections)?;

    m.export_function("dedupe_syn", map::dedupe_syn)?;

    m.export_function("tokenize_name", tokenize_name)?;

    m.export_function("classify", classify::classify)?;
    m.export_function("conflate", conflate::conflate)?;
    m.export_function("consensus", consensus::consensus)?;
    m.export_function("convert", convert::convert)?;
    m.export_function("stats", stats::stats)?;
    m.export_function("dedupe", dedupe::dedupe)?;

    Ok(())
});

#[macro_use] extern crate neon;
#[macro_use] extern crate serde_derive;
#[macro_use] extern crate lazy_static;
extern crate serde_json;
extern crate neon_serde;
extern crate crossbeam;
extern crate num_cpus;
extern crate postgres;
extern crate geojson;
extern crate rstar;
extern crate regex;
extern crate geo;

// Internal Helper Libraries
pub mod util;
pub mod stream;
pub mod text;

pub mod types;
pub mod pg;

// Helper to current node fn
pub mod map;

// External PT2ITP Modes
pub mod convert;
pub mod stats;
pub mod dedupe;
pub mod classify;
pub mod conflate;

pub use self::types::Address;
pub use self::types::Network;
pub use self::types::Polygon;

pub use self::types::hecate;
pub use self::types::Context;
pub use self::text::Tokens;
pub use self::text::Tokenized;

pub use self::types::Names;
pub use self::types::Name;
pub use self::types::Source;

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

    m.export_function("tokenize_name", text::tokenize_name)?;

    m.export_function("classify", classify::classify)?;
    m.export_function("conflate", conflate::conflate)?;
    m.export_function("convert", convert::convert)?;
    m.export_function("stats", stats::stats)?;
    m.export_function("dedupe", dedupe::dedupe)?;

    Ok(())
});

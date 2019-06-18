use std::convert::From;
use postgres::{Connection, TlsMode};
use std::collections::HashMap;

use crate::Context as CrateContext;
use crate::Tokens;

use neon::prelude::*;

use super::stream::GeoStream;
use super::stream::AddrStream;
use super::stream::NetStream;

use super::pg;
use super::pg::{Table, InputTable};

pub fn pg_init(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let db = match cx.argument_opt(0) {
        Some(arg) => arg.downcast::<JsString>().or_throw(&mut cx)?.value(),
        None => String::from("pt_test")
    };

    let conn = Connection::connect(format!("postgres://postgres@localhost:5432/{}", &db).as_str(), TlsMode::None).unwrap();

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

    let conn = Connection::connect(format!("postgres://postgres@localhost:5432/{}", &db).as_str(), TlsMode::None).unwrap();

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

    let conn = Connection::connect(format!("postgres://postgres@localhost:5432/{}", &args.db).as_str(), TlsMode::None).unwrap();

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

    let conn = Connection::connect(format!("postgres://postgres@localhost:5432/{}", &args.db).as_str(), TlsMode::None).unwrap();

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

pub fn import_stats(mut cx: FunctionContext) -> JsResult<JsBoolean> {
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

    let conn = Connection::connect(format!("postgres://postgres@localhost:5432/{}", &args.db).as_str(), TlsMode::None).unwrap();

    let context = match args.context {
        Some(context) => CrateContext::from(context),
        None => CrateContext::new(String::from(""), None, Tokens::new(HashMap::new()))
    };

    let polygon = pg::Polygon::new("bounds");
    polygon.create(&conn);
    polygon.input(&conn, NetStream::new(GeoStream::new(args.input), context, args.errors));
    polygon.seq_id(&conn);
    polygon.index(&conn);

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

    let conn = Connection::connect(format!("postgres://postgres@localhost:5432/{}", &db).as_str(), TlsMode::None).unwrap();

    let cluster = pg::AddressCluster::new(orphan);
    cluster.create(&conn);
    cluster.generate(&conn);
    cluster.index(&conn);

    Ok(cx.boolean(true))
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

    let conn = Connection::connect(format!("postgres://postgres@localhost:5432/{}", &db).as_str(), TlsMode::None).unwrap();

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

    let conn = Connection::connect(format!("postgres://postgres@localhost:5432/{}", &db).as_str(), TlsMode::None).unwrap();

    let intersections = pg::Intersections::new();
    intersections.create(&conn);
    intersections.generate(&conn);
    intersections.index(&conn);

    Ok(cx.boolean(true))
}

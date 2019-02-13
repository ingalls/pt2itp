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
use super::pg::Table;

pub fn pg_init(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let db = match cx.argument_opt(0) {
        Some(arg) => arg.downcast::<JsString>().or_throw(&mut cx)?.value(),
        None => String::from("pt_test")
    };

    let conn = Connection::connect(format!("postgres://postgres@localhost:5432/{}", &db).as_str(), TlsMode::None).unwrap();

    pg::Address::create(&conn);
    pg::Network::create(&conn);

    Ok(cx.boolean(true))
}

pub fn pg_optimize(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let db = match cx.argument_opt(0) {
        Some(arg) => arg.downcast::<JsString>().or_throw(&mut cx)?.value(),
        None => String::from("pt_test")
    };

    let conn = Connection::connect(format!("postgres://postgres@localhost:5432/{}", &db).as_str(), TlsMode::None).unwrap();

    pg::Address::seq_id(&conn);
    pg::Network::seq_id(&conn);

    pg::Address::index(&conn);
    pg::Network::index(&conn);

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

    pg::Address::create(&conn);
    pg::Address::input(&conn, AddrStream::new(GeoStream::new(args.input), context, args.errors));
    if args.seq {
        pg::Address::seq_id(&conn);
    }
    pg::Address::index(&conn);

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

    pg::Network::create(&conn);
    pg::Network::input(&conn, NetStream::new(GeoStream::new(args.input), context, args.errors));
    if args.seq {
        pg::Network::seq_id(&conn);
    }
    pg::Network::index(&conn);

    Ok(cx.boolean(true))
}

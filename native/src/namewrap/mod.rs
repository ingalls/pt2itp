use std::collections::HashMap;
use crate::{Names, Tokens};
use neon_serde;
use neon::prelude::*;
use neon::{class_definition, declare_types, impl_managed};

declare_types! {
  pub class JsNames for Names {
    init(mut cx) {
      let json: Handle<JsString> = cx.argument::<JsString>(0)?;
      let context = crate::Context::new(String::from("us"), None, Tokens::new(HashMap::new()));

      let json: serde_json::Value = serde_json::from_str(&json.value()).unwrap();

      Ok(Names::from_value(Some(json), None, &context).unwrap())
    }

    method names(mut cx) {
      let this = cx.this();
      let names = {
        let guard = cx.lock();
        let names = this.borrow(&guard);
        names.names.clone()
      };

      Ok(neon_serde::to_value(&mut cx, &names)?)
    }
  }
}

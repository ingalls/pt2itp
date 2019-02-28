use std::iter::Iterator;
use postgres::{Connection};
use std::io::Read;
use std::mem;
use serde_json::Value;

pub mod address;
pub mod network;
pub mod polygon;

pub use self::address::Address;
pub use self::network::Network;
pub use self::polygon::Polygon;

pub trait Table {
    fn create(&self, conn: &Connection);
    fn count(&self, conn: &Connection) -> i64;
    fn input(&self, conn: &Connection, data: impl Read);
    fn seq_id(&self, conn: &Connection);
    fn index(&self, conn: &Connection);
}

///
/// Relatively limited cursor wrapper that will allow a cursor to be
/// created that returns a single Serde_Json::Value field
///
pub struct Cursor {
    pub fetch: i64,
    pub query: String,
    trans: postgres::transaction::Transaction<'static>,
    #[allow(dead_code)]
    conn: Box<postgres::Connection>,
    cache: Vec<Value>
}

impl Cursor {
    pub fn new(conn: Connection, query: String) -> Result<Self, String> {
        let fetch = 1000;

        let pg_conn = Box::new(conn);

        let trans: postgres::transaction::Transaction = unsafe {
            mem::transmute(match pg_conn.transaction() {
                Ok(trans) => trans,
                Err(err) => {
                    return Err(err.to_string());
                }
            })
        };

        match trans.execute(format!(r#"
            DECLARE next_cursor CURSOR FOR {}
        "#, &query).as_str(), &[]) {
            Err(err) => {
                return Err(err.to_string());
            },
            _ => ()
        };

        Ok(Cursor {
            fetch: fetch,
            conn: pg_conn,
            trans: trans,
            query: query,
            cache: Vec::with_capacity(fetch as usize)
        })
    }
}

impl Iterator for Cursor {
    type Item = Value;

    fn next(&mut self) -> Option<Self::Item> {
        if !self.cache.is_empty() {
            return self.cache.pop()
        }

        let rows = match self.trans.query(format!(r#"
            FETCH {} FROM next_cursor
        "#, &self.fetch).as_str(), &[]) {
            Ok(rows) => rows,
            Err(err) => panic!("Fetch Error: {}", err.to_string())
        };

        // Cursor is finished
        if rows.is_empty() {
            return None;
        } else {
            self.cache = rows.iter().map(|row| {
                let json: Value = row.get(0);
                json
            }).collect();

            return self.cache.pop();
        }
    }
}


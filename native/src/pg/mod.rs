use std::iter::Iterator;
use postgres::{Connection};
use std::io::Read;
use std::mem;
use serde_json::Value;

pub mod address;
pub mod addresscluster;
pub mod network;
pub mod networkcluster;
pub mod polygon;
pub mod intersections;

pub use self::address::Address;
pub use self::addresscluster::AddressCluster;

pub use self::network::Network;
pub use self::networkcluster::NetworkCluster;

pub use self::polygon::Polygon;
pub use self::intersections::Intersections;

pub trait Table {
    fn create(&self, conn: &Connection);
    fn count(&self, conn: &Connection) -> i64;
    fn index(&self, conn: &Connection);
}

///
/// Tables which are designed to accecpt tabular input via a Read trait
/// will implement the InputTable Property
///
pub trait InputTable {
    fn input(&self, conn: &Connection, data: impl Read);
    fn seq_id(&self, conn: &Connection);
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

        if let Err(err) = trans.execute(format!(r#"
            DECLARE next_cursor CURSOR FOR {}
        "#, &query).as_str(), &[]) {
            return Err(err.to_string());
        };

        Ok(Cursor {
            fetch,
            conn: pg_conn,
            trans,
            query,
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
            None
        } else {
            self.cache = rows.iter().map(|row| {
                let json: Value = row.get(0);
                json
            }).collect();

            self.cache.pop()
        }
    }
}


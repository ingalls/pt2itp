use postgres::{Connection};
use std::io::Read;
use super::Table;

///
/// Polygon table are special in that they don't make assumptions about the underlying
/// data. They can be any one of a number of types - building polys, parcels, places
///
pub struct Polygon {
    name: String
}

impl Polygon {
    pub fn new(name: String) -> Self {
        Polygon {
            name: name
        }
    }
}

impl Table for Polygon {
    fn create(&self, conn: &Connection) {
        conn.execute(r#"
             CREATE EXTENSION IF NOT EXISTS POSTGIS
        "#, &[]).unwrap();

        conn.execute(format!(r#"
            DROP TABLE IF EXISTS {};
        "#, &self.name).as_str(), &[]).unwrap();

        conn.execute(format!(r#"
            CREATE UNLOGGED TABLE {} (
                id BIGINT,
                props JSONB,
                geom GEOMETRY(MultiPolygon, 4326)
            )
        "#, &self.name).as_str(), &[]).unwrap();
    }

    fn count(&self, conn: &Connection) -> i64 {
        match conn.query(format!(r#"
            SELECT count(*) FROM {}
        "#, &self.name).as_str(), &[]) {
            Ok(res) => {
                let cnt: i64 = res.get(0).get(0);
                cnt
            },
            _ => 0
        }
    }

    fn input(&self, conn: &Connection, mut data: impl Read) {
        let stmt = conn.prepare(format!(r#"
            COPY {} (
                props,
                geom
            )
            FROM STDIN
            WITH
                NULL AS ''
        "#, &self.name).as_str()).unwrap();

        stmt.copy_in(&[], &mut data).unwrap();
    }

    fn seq_id(&self, conn: &Connection) {
        conn.execute(format!(r#"
            DROP SEQUENCE IF EXISTS {}_seq;
        "#, &self.name).as_str(), &[]).unwrap();

        conn.execute(format!(r#"
            CREATE SEQUENCE {}_seq;
        "#, &self.name).as_str(), &[]).unwrap();

        conn.execute(format!(r#"
            UPDATE {name}
                SET id = nextval('{name}_seq');
        "#, name = &self.name).as_str(), &[]).unwrap();
    }

    fn index(&self, conn: &Connection) {
        conn.execute(format!(r#"
            CREATE INDEX {name}_idx ON {name} (id);
        "#, name = &self.name).as_str(), &[]).unwrap();

        conn.execute(format!(r#"
            CREATE INDEX {name}_gix ON {name} USING GIST (geom);
        "#, name = &self.name).as_str(), &[]).unwrap();
    }
}

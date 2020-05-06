use postgres::{Connection};
use std::io::Read;
use super::{Table, InputTable};

pub struct Network ();

impl Network {
    pub fn new() -> Self {
        Network()
    }
}

impl Table for Network {
    fn create(&self, conn: &Connection) {
        conn.execute(r#"
             CREATE EXTENSION IF NOT EXISTS POSTGIS
        "#, &[]).unwrap();

        conn.execute(r#"
            DROP TABLE IF EXISTS network;
        "#, &[]).unwrap();

        conn.execute(r#"
            CREATE UNLOGGED TABLE network (
                id BIGINT,
                names JSONB,
                source TEXT,
                props JSONB,
                geom GEOMETRY(MultiLineString, 4326)
            )
        "#, &[]).unwrap();
    }

    fn count(&self, conn: &Connection) -> i64 {
        match conn.query(r#"
            SELECT count(*) FROM network
        "#, &[]) {
            Ok(res) => {
                let cnt: i64 = res.get(0).get(0);
                cnt
            },
            _ => 0
        }
    }


    fn index(&self, conn: &Connection) {
        conn.execute(r#"
            ALTER TABLE network
                ALTER COLUMN geom
                TYPE GEOMETRY(MULTILINESTRINGZ, 4326)
                USING ST_GEomFromEWKT(Regexp_Replace(ST_AsEWKT(geom)::TEXT, '(?<=\d)(?=[,)])', ' '||id, 'g'))
        "#, &[]).unwrap();

        conn.execute(r#"
            CREATE INDEX network_idx ON network (id);
        "#, &[]).unwrap();

        conn.execute(r#"
            CREATE INDEX network_gix ON network USING GIST (geom);
        "#, &[]).unwrap();

        conn.execute(r#"
            CLUSTER network USING network_idx;
        "#, &[]).unwrap();

        conn.execute(r#"
            ANALYZE network;
        "#, &[]).unwrap();
    }
}

impl InputTable for Network {
    fn input(&self, conn: &Connection, mut data: impl Read) {
        let stmt = conn.prepare(r#"
            COPY network (
                names,
                source,
                props,
                geom
            )
            FROM STDIN
            WITH (
                FORMAT CSV,
                NULL '',
                DELIMITER E'\t',
                QUOTE E'\b'
            )
        "#).unwrap();

        stmt.copy_in(&[], &mut data).unwrap();
    }

    fn seq_id(&self, conn: &Connection) {
        conn.execute(r#"
            DROP SEQUENCE IF EXISTS network_seq;
        "#, &[]).unwrap();

        conn.execute(r#"
            CREATE SEQUENCE network_seq;
        "#, &[]).unwrap();

        conn.execute(r#"
            UPDATE network
                SET id = nextval('network_seq');
        "#, &[]).unwrap();
    }

}

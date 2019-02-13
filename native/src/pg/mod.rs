use postgres::{Connection};
use std::io::Read;

pub trait Table {
    fn create(conn: &Connection);
    fn count(conn: &Connection) -> i64;
    fn input(conn: &Connection, data: impl Read);
    fn seq_id(conn: &Connection);
    fn index(conn: &Connection);
}

pub struct Address ();

impl Table for Address {
    fn create(conn: &Connection) {
        conn.execute(r#"
             CREATE EXTENSION IF NOT EXISTS POSTGIS
        "#, &[]).unwrap();

        conn.execute(r#"
            DROP TABLE IF EXISTS address;
        "#, &[]).unwrap();

        conn.execute(r#"
            CREATE UNLOGGED TABLE address (
                id BIGINT,
                version BIGINT,
                netid BIGINT,
                names JSONB,
                number TEXT,
                source TEXT,
                output BOOLEAN,
                props JSONB,
                geom GEOMETRY(POINT, 4326)
            )
        "#, &[]).unwrap();
    }

    fn count(conn: &Connection) -> i64 {
        match conn.query(r#"
            SELECT count(*) FROM address
        "#, &[]) {
            Ok(res) => {
                let cnt: i64 = res.get(0).get(0);
                cnt
            },
            _ => 0
        }
    }

    fn input(conn: &Connection, mut data: impl Read) {
        let stmt = conn.prepare(format!(r#"
            COPY address (
                id,
                version,
                names,
                number,
                source,
                output,
                props,
                geom
            )
            FROM STDIN
            WITH
                NULL AS ''
        "#).as_str()).unwrap();

        stmt.copy_in(&[], &mut data).unwrap();
    }

    fn seq_id(conn: &Connection) {
        conn.execute(r#"
            DROP SEQUENCE IF EXISTS address_seq;
        "#, &[]).unwrap();

        conn.execute(r#"
            CREATE SEQUENCE address_seq;
        "#, &[]).unwrap();

        conn.execute(r#"
            UPDATE address
                SET id = nextval('address_seq');
        "#, &[]).unwrap();
    }

    fn index(conn: &Connection) {
        conn.execute(r#"
            ALTER TABLE address
                ALTER COLUMN geom
                TYPE GEOMETRY(POINTZ, 4326)
                USING ST_SetSRID(ST_MakePoint(ST_X(geom), ST_Y(geom), id::FLOAT), 4326);
        "#, &[]).unwrap();

        conn.execute(r#"
            CREATE INDEX address_idx ON address (id);
        "#, &[]).unwrap();

        conn.execute(r#"
            CREATE INDEX address_gix ON address USING GIST (geom);
        "#, &[]).unwrap();

        conn.execute(r#"
            CLUSTER address USING address_idx;
        "#, &[]).unwrap();

        conn.execute(r#"
            ANALYZE address;
        "#, &[]).unwrap();
    }
}

pub struct Network ();

impl Table for Network {
    fn create(conn: &Connection) {
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

    fn count(conn: &Connection) -> i64 {
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

    fn input(conn: &Connection, mut data: impl Read) {
        let stmt = conn.prepare(format!("COPY network (names, source, props, geom) FROM STDIN").as_str()).unwrap();

        stmt.copy_in(&[], &mut data).unwrap();
    }

    fn seq_id(conn: &Connection) {
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

    fn index(conn: &Connection) {
        conn.execute(r#"
            ALTER TABLE network
                ALTER COLUMN geom
                TYPE GEOMETRY(MULTILINESTRINGZ, 4326)
                USING ST_GEomFromEWKT(Regexp_Replace(ST_AsEWKT(geom)::TEXT, '\d(?=[,)])', ' '||id, 'g'))
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

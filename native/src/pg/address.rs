use postgres::{Connection};
use std::io::Read;
use super::{Table, InputTable};

#[derive(Default)]
pub struct Address ();

impl Address {
    pub fn new() -> Self {
        Address()
    }

    pub fn max(&self, conn: &Connection) -> i64 {
        match conn.query(r#"
            SELECT max(id) FROM address
        "#, &[]) {
            Ok(res) => {
                let max: i64 = res.get(0).get(0);
                max
            },
            _ => 0
        }
    }
}

impl Table for Address {
    fn create(&self, conn: &Connection) {
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

    fn count(&self, conn: &Connection) -> i64 {
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

    fn index(&self, conn: &Connection) {
        conn.execute(r#"
            ALTER TABLE address
                ALTER COLUMN geom
                TYPE GEOMETRY(POINTZ, 4326)
                USING ST_SetSRID(ST_MakePoint(ST_X(geom), ST_Y(geom), COALESCE(id::FLOAT, 0)), 4326);
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

impl InputTable for Address {
    fn input(&self, conn: &Connection, mut data: impl Read) {
        let stmt = conn.prepare(r#"
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
}

// Prepare address to be run through conflate by setting output=false and id to its inverse
// for all past versions of a feature.
// This ensures that past features are not modified but will match addresses being conflated.
pub fn pre_conflate(conn: &Connection) {
    conn.execute(r#"
        DROP TABLE IF EXISTS address_id_to_version;
    "#, &[]).unwrap();

    conn.execute(r#"
        CREATE TABLE IF NOT EXISTS address_id_to_version as
            SELECT
                id,
                MAX(version) AS max_version
            FROM
                address
            GROUP BY
                id
    "#, &[]).unwrap();

    conn.execute(r#"
        UPDATE address
        SET
            output = false,
            id = address.id * -1
        FROM
            address_id_to_version
        WHERE
            address.id = address_id_to_version.id
            AND address.version != address_id_to_version.max_version
    "#, &[]).unwrap();
}

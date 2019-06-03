use postgres::{Connection, TlsMode};
use super::Table;
use std::thread;

pub struct Intersections ();

impl Intersections {
    pub fn new() -> Self {
        Intersections()
    }

    ///
    /// Create intersections from network data
    ///
    pub fn generate(&self, conn: &postgres::Connection, table: impl ToString) {
        let count = conn.query("
            SELECT count(*) FROM network_cluster;
        ", &[]).unwrap();
        let count: i64 = count.get(0).get(0);

        let cpus = num_cpus::get() as i64;
        let mut web = Vec::new();

        let batch_extra = count % cpus;
        let batch = (count - batch_extra) / cpus;

        for cpu in 0..cpus {
            let db_conn = table.to_string();

            let strand = thread::Builder::new().name(format!("Intersection #{}", &cpu)).spawn(move || {
                let mut min_id = batch * cpu;
                let max_id = batch * cpu + batch + batch_extra;

                if cpu != 0 {
                    min_id = min_id + batch_extra + 1;
                }

                let conn = match Connection::connect(format!("postgres://postgres@localhost:5432/{}", &db_conn).as_str(), TlsMode::None) {
                    Ok(conn) => conn,
                    Err(err) => panic!("Connection Error: {}", err.to_string())
                };

                conn.execute(format!("
                    INSERT INTO intersections (a_id, b_id, a_street, b_street, geom) (
                        SELECT
                            a.id,
                            b.id,
                            a.names AS a_street,
                            b.names AS b_street,
                            ST_PointOnSurface(ST_Intersection(a.geom, b.geom)) AS geom
                        FROM
                            network_cluster AS a
                            INNER JOIN network_cluster AS b
                            ON
                                a.id != b.id
                                AND ST_Intersects(a.geom, b.geom)
                        WHERE
                            a.id >= {min_id}
                            AND a.id <= {max_id}
                    )
                ", min_id = min_id, max_id = max_id).as_str(), &[]).unwrap();
            }).unwrap();

            web.push(strand);
        }

        for strand in web {
            strand.join().unwrap();
        }
    }
}

impl Table for Intersections {
    fn create(&self, conn: &Connection) {
        conn.execute(r#"
             CREATE EXTENSION IF NOT EXISTS POSTGIS
        "#, &[]).unwrap();

        conn.execute(r#"
            DROP TABLE IF EXISTS intersections;
        "#, &[]).unwrap();

        conn.execute(r#"
            CREATE UNLOGGED TABLE intersections (
                id SERIAL,
                a_id BIGINT,
                b_id BIGINT,
                a_street JSONB,
                b_street JSONB,
                geom GEOMETRY(POINT, 4326)
            )
        "#, &[]).unwrap();
    }

    fn count(&self, conn: &postgres::Connection) -> i64 {
        match conn.query("
            SELECT count(*) FROM intersections
        ", &[]) {
            Ok(res) => {
                let cnt: i64 = res.get(0).get(0);
                cnt
            },
            _ => 0
        }
    }

    fn index(&self, conn: &Connection) {
        conn.execute("
            CREATE INDEX IF NOT EXISTS intersections_idx ON intersections (id);
        ", &[]).unwrap();

        conn.execute("
            CREATE INDEX IF NOT EXISTS intersections_gix ON intersections USING GIST (geom);
        ", &[]).unwrap();
    }
}

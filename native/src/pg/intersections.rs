use postgres::Connection;
use super::Table;

pub struct Intersections ();

impl Intersections {
    pub fn new() -> Self {
        Intersections()
    }

    ///
    /// Create intersections from network data
    ///
    pub fn generate(&self, conn: &Connection) {
        conn.execute("
            INSERT INTO intersections (a_id, b_id, geom) (
                SELECT
                    a.id,
                    b.id,
                    ST_PointOnSurface(ST_Intersection(a.geom, b.geom)) AS geom
                FROM
                    network_cluster AS a
                    INNER JOIN network_cluster AS b
                    ON
                        a.id != b.id
                        AND ST_Intersects(a.geom, b.geom)
            )
        ", &[]).unwrap();

        conn.execute("
            UPDATE intersections
                SET b_street = network_cluster.names
                FROM network_cluster
                WHERE intersections.b_id = network_cluster.id
        ", &[]).unwrap();

        conn.execute("
            UPDATE intersections
                SET a_street = network_cluster.names
                FROM network_cluster
                WHERE intersections.a_id = network_cluster.id
        ", &[]).unwrap();
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

    fn count(&self, conn: &Connection) -> i64 {
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
            CREATE INDEX IF NOT EXISTS intersections_gix ON intersections USING GIST (geom);
        ", &[]).unwrap();
    }
}

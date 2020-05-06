use postgres::{Connection};
use super::Table;

pub struct AddressCluster {
    orphan: bool
}

impl AddressCluster {
    pub fn new(orphan: bool) -> Self {
        AddressCluster { orphan }
    }

    ///
    /// Cluster address points
    ///
    pub fn generate(&self, conn: &postgres::Connection) {
        if self.orphan {
            conn.execute(r#"
                INSERT INTO address_orphan_cluster (names, geom)
                    SELECT
                        addr.names,
                        ST_Multi(ST_CollectionExtract(addr.geom, 1)) AS geom
                    FROM (
                        SELECT
                            names,
                            unnest(ST_ClusterWithin(geom, 0.005)) AS geom
                        FROM address
                        WHERE netid IS NULL
                        GROUP BY names
                    ) addr;
            "#, &[]).unwrap();
        } else {
            conn.execute(r#"
                INSERT INTO address_cluster (names, geom, netid)
                    SELECT
                        JSON_Agg(a.names||('{ "freq": '::TEXT||ST_NPoints(geom)||'}')::JSONB ORDER BY ST_NPoints(geom) DESC),
                        ST_Multi(ST_CollectionExtract(ST_Collect(a.geom), 1)) AS geom,
                        a.netid
                    FROM (
                        SELECT
                            jsonb_array_elements(names) AS names,
                            netid,
                            ST_Multi(ST_CollectionExtract(ST_Collect(geom), 1)) AS geom
                        FROM
                            address
                        WHERE
                            netid IS NOT NULL
                        GROUP BY
                            netid,
                            names
                    ) a
                    GROUP BY
                        netid;
            "#, &[]).unwrap();

            conn.execute(r#"
                UPDATE network_cluster n
                    SET address = a.id
                    FROM address_cluster a
                    WHERE n.id = a.netid;
            "#, &[]).unwrap();
        }
    }
}

impl Table for AddressCluster {
    fn create(&self, conn: &Connection) {
        conn.execute(r#"
             CREATE EXTENSION IF NOT EXISTS POSTGIS
        "#, &[]).unwrap();

        if self.orphan {
            conn.execute(r#"
                DROP TABLE IF EXISTS address_orphan_cluster;
            "#, &[]).unwrap();

            conn.execute(r#"
                CREATE UNLOGGED TABLE address_orphan_cluster (
                    ID SERIAL,
                    names JSONB,
                    geom GEOMETRY(MULTIPOINTZ, 4326),
                    props JSONB
                )
            "#, &[]).unwrap();
        } else {
            conn.execute(r#"
                DROP TABLE IF EXISTS address_cluster;
            "#, &[]).unwrap();

            conn.execute(r#"
                CREATE UNLOGGED TABLE address_cluster (
                    ID SERIAL,
                    netid BIGINT,
                    names JSONB,
                    geom GEOMETRY(MULTIPOINTZ, 4326),
                    props JSONB
                )
            "#, &[]).unwrap();

        }
    }

    fn count(&self, conn: &Connection) -> i64 {
        let table = match self.orphan {
            true => String::from("address_orphan_cluster"),
            false => String::from("address_cluster")
        };

        match conn.query(format!("
            SELECT count(*) FROM {}
        ", table).as_str(), &[]) {
            Ok(res) => {
                let cnt: i64 = res.get(0).get(0);
                cnt
            },
            _ => 0
        }
    }

    fn index(&self, conn: &Connection) {
        let table = match self.orphan {
            true => String::from("address_orphan_cluster"),
            false => String::from("address_cluster")
        };

        conn.execute(format!("
            CREATE INDEX IF NOT EXISTS {table}_idx ON {table} (id);
        ", table = &table).as_str(), &[]).unwrap();

        conn.execute(format!("
            CREATE INDEX IF NOT EXISTS {table}_gix ON {table} USING GIST (geom);
        ", table = table).as_str(), &[]).unwrap();

        conn.execute(format!("
            CLUSTER {table} USING {table}_gix;
        ", table = table).as_str(), &[]).unwrap();

        conn.execute(format!("
            ANALYZE {table};
        ", table = table).as_str(), &[]).unwrap();
    }
}

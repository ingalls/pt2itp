use postgres::{Connection};
use super::Table;

pub struct NetworkCluster {
    orphan: bool
}

impl NetworkCluster {
    pub fn new(orphan: bool) -> Self {
        NetworkCluster { orphan }
    }

    ///
    /// Cluster network linestrings
    ///
    pub fn generate(&self, conn: &postgres::Connection) {
        if self.orphan {
            conn.execute(r#"
                // TODO
            "#, &[]).unwrap();
        } else {
            conn.execute(r#"
                INSERT INTO network_cluster(geom)
                    SELECT
                        geom
                    FROM (
                        SELECT
                            names,
                            ST_Multi(ST_CollectionExtract(netw.geom, 2)) AS geom
                        FROM (
                            SELECT
                                json_array_elements(json_array_elements(JSON_AGG(names)))::JSONB AS names,
                                unnest(ST_ClusterWithin(geom, 0.005)) AS geom
                            FROM network
                            WHERE names->0->>'tokenized' != ''
                            GROUP BY names->0
                        ) netw
                        GROUP BY
                            geom,
                            names
                        ORDER BY
                            names->>'priority'
                    ) final
                    WHERE geom IS NOT NULL
                    GROUP BY geom;
            "#, &[]).unwrap();

            conn.execute(r#"
                -- extracts distinct Z coordinates from a multilinestring
                CREATE OR REPLACE FUNCTION get_source_ids(geometry(MultiLineStringZ))
                RETURNS BIGINT[]
                AS
                $$
                DECLARE
                    mls ALIAS FOR $1;
                    ls geometry(LineStringZ);
                    retVal BIGINT[];
                    j BIGINT;
                BEGIN
                    j := 1;
                    FOR ls IN SELECT (ST_Dump(mls)).geom LOOP
                        FOR i IN 1..ST_NPoints(ls) LOOP
                            retVal[j] := ST_Z(ST_PointN(ls, i));
                            j := j + 1;
                        END LOOP;
                    END LOOP;
                    retVal := ARRAY(SELECT DISTINCT UNNEST(retVal) ORDER BY 1);
                RETURN retVal;
                END;
                $$
                LANGUAGE plpgsql
                   STABLE
                RETURNS NULL ON NULL INPUT;
            "#, &[]).unwrap();

            conn.execute(r#"
                UPDATE network_cluster
                    SET source_ids = get_source_ids(geom);
            "#, &[]).unwrap();

            conn.execute(r#"
            UPDATE network_cluster
                SET names = final.names
                FROM (
                    SELECT
                        joined.id,
                        json_agg(joined.names) AS names
                    FROM (
                        SELECT DISTINCT
                            nc.id,
                            jsonb_array_elements(n.names) AS names
                        FROM
                            (
                                SELECT
                                    id,
                                    unnest(source_ids) AS sources
                                FROM
                                    network_cluster
                            ) nc,
                            network n
                        WHERE n.id = sources
                    ) joined
                    GROUP BY joined.id
                ) final
                WHERE
                    final.id = network_cluster.id;
            "#, &[]).unwrap();

            conn.execute(r#"
                ALTER TABLE network_cluster
                    ADD COLUMN geom_flat geometry(geometry, 4326);
            "#, &[]).unwrap();

            conn.execute(r#"
                UPDATE network_cluster
                    SET geom_flat = ST_SetSRID(ST_Force2D(geom), 4326);
            "#, &[]).unwrap();

            conn.execute(r#"
                ALTER TABLE network_cluster
                    DROP COLUMN geom;
            "#, &[]).unwrap();

            conn.execute(r#"
                ALTER TABLE network_cluster
                    RENAME geom_flat TO geom;
            "#, &[]).unwrap();
        }
    }
}

impl Table for NetworkCluster {
    fn create(&self, conn: &Connection) {
        conn.execute(r#"
             CREATE EXTENSION IF NOT EXISTS POSTGIS
        "#, &[]).unwrap();

        if self.orphan {
            conn.execute(r#"
                DROP TABLE IF EXISTS network_orphan_cluster;
            "#, &[]).unwrap();

            conn.execute(r#"
                CREATE UNLOGGED TABLE network_orphan_cluster (
                    ID SERIAL,
                    names JSONB,
                    geom GEOMETRY(MULTILINESTRINGZ, 4326),
                    props JSONB
                )
            "#, &[]).unwrap();
        } else {
            conn.execute(r#"
                DROP TABLE IF EXISTS network_cluster;
            "#, &[]).unwrap();

            conn.execute(r#"
                CREATE UNLOGGED TABLE network_cluster (
                    id SERIAL,
                    names JSONB,
                    geom GEOMETRY(GEOMETRYZ, 4326),
                    address BIGINT,
                    source_ids BIGINT[]
                )
            "#, &[]).unwrap();
        }
    }

    fn count(&self, conn: &Connection) -> i64 {
        let table = match self.orphan {
            true => String::from("network_orphan_cluster"),
            false => String::from("network_cluster")
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
            true => String::from("network_orphan_cluster"),
            false => String::from("network_cluster")
        };

        conn.execute(format!("
            CREATE INDEX IF NOT EXISTS {table}_idx ON {table} (id);
        ", table = &table).as_str(), &[]).unwrap();

        conn.execute(format!("
            CREATE INDEX IF NOT EXISTS {table}_gix ON {table} USING GIST (geom);
        ", table = table).as_str(), &[]).unwrap();

        if !self.orphan {
            conn.execute(format!("
                CREATE INDEX network_cluster_source_ids_idx ON network_cluster USING GIN (source_ids);
            ").as_str(), &[]).unwrap();
        }

        conn.execute(format!("
            CLUSTER {table} USING {table}_gix;
        ", table = table).as_str(), &[]).unwrap();

        conn.execute(format!("
            ANALYZE {table};
        ", table = table).as_str(), &[]).unwrap();
    }
}

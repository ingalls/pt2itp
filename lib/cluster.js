const buffer = require('./buffer');
const linker = require('./linker');

const turf = require('@turf/turf');
const _ = require('lodash');
const wk = require('wellknown');

class Cluster {
    constructor(pool) {
        this.pool = pool;
    }

    /**
     * This clusters address points
     */
    address(cb) {
        this.pool.query(`
            BEGIN;

            DROP TABLE IF EXISTS address_cluster;
            DROP SEQUENCE IF EXISTS address_cluster_seq;

            CREATE TABLE address_cluster AS SELECT
                addr.text,
                addr._text,
                addr.text_tokenless,
                ST_Multi(ST_CollectionExtract(addr.geom, 1)) AS geom
            FROM (
                SELECT
                    text,
                    MAX(_text) AS _text,
                    MAX(text_tokenless) AS text_tokenless,
                    unnest(ST_ClusterWithin(geom, 0.01)) AS geom
                FROM address
                GROUP BY text
            ) addr;

            CREATE SEQUENCE address_cluster_seq;
            ALTER TABLE address_cluster ADD COLUMN id INTEGER DEFAULT nextval('address_cluster_seq');

            COMMIT;
        `, (err, res) => {
            console.error('ok - clustered addresses');

            return cb(err);
        });
    }

    /**
     * This clusters linestrings
     */
    network(cb) {
        this.pool.query(`
            BEGIN;

            DROP TABLE IF EXISTS network_cluster;
            DROP SEQUENCE IF EXISTS network_cluster_seq;

            CREATE TABLE network_cluster AS SELECT
                netw.text,
                netw._text,
                netw.text_tokenless,
                ST_Multi(ST_CollectionExtract(netw.geom, 2)) AS geom
            FROM (
                SELECT
                    text,
                    MAX(_text) AS _text,
                    MAX(text_tokenless) AS text_tokenless,
                    unnest(ST_ClusterWithin(geom, 0.01)) AS geom
                FROM network
                GROUP BY text
            ) netw;

            CREATE SEQUENCE network_cluster_seq;
            ALTER TABLE network_cluster ADD COLUMN id INTEGER DEFAULT nextval('network_cluster_seq');
            ALTER TABLE network_cluster ADD COLUMN address INTEGER;

            ALTER TABLE network_cluster ADD COLUMN buffer GEOMETRY(POLYGON, 4326);
            UPDATE network_cluster SET buffer = ST_Buffer(ST_Envelope(geom), 0.01);
            CREATE INDEX network_cluster_buffer_gix ON network_cluster USING GIST (buffer);

            COMMIT;
        `, (err, res) => {
            console.error('ok - clustered network');

            return cb(err);
        });
    }

    optimize(cb) {
        this.pool.query(`
            BEGIN;
            CREATE INDEX address_cluster_gix ON address_cluster USING GIST (geom);
            CREATE INDEX network_cluster_gix ON network_cluster USING GIST (geom);
            CLUSTER address_cluster USING address_cluster_gix;
            CLUSTER network_cluster USING network_cluster_gix;
            ANALYZE address_cluster;
            ANALYZE network_cluster;
            COMMIT;
        `, (err, res) => {
            return cb(err);
        });
    }

    match(id, cb) {
        this.pool.query(`
            SELECT
                network.text AS network,
                network.text_tokenless AS network_text_tokenless,
                addr.id,
                addr.text,
                addr.text_tokenless AS text_tokenless
            FROM
                address_cluster addr,
                network_cluster AS network
            WHERE
                network.id = ${id} AND
                ST_Intersects(network.buffer, addr.geom);
        `, (err, res) => {
            if (err) return cb(err);

            if (!res.rows.length) return cb();

            let address = linker({
                id: id,
                text: res.rows[0].network,
                text_tokenless: res.rows[0].network_text_tokenless
            }, res.rows)

            if (!address) return cb();

            this.pool.query(`
                UPDATE network_cluster
                SET address = ${address.id}
                WHERE network_cluster.id = ${id};
            `, (err, res) => {
                return cb(err);
            });
        });
    }

    name(id, cb) {
        this.pool.query(`SELECT ST_AsGeoJSON(geom) AS geom FROM network WHERE id = ${id}`, (err, res) => {
            if (err) return cb(err);

            let str = JSON.parse(res.rows[0].geom);

            let buff = buffer(str, 0.1).geometry;

            let names = {};

            this.pool.query(`SELECT text, text_tokenless, _text FROM address WHERE ST_Within(geom, ST_SetSRID(ST_GeomFromGeoJSON('${JSON.stringify(buff)}'), 4326))`, (err, res) => {
                if (err) return cb(err);

                for (let res_it = 0; res_it < res.rows.length; res_it++) {
                    let text = JSON.stringify([
                        res.rows[res_it].text,
                        res.rows[res_it].text_tokenless,
                        res.rows[res_it]._text
                    ]);

                    if (!names[text]) names[text] = 1;
                    else names[text]++;
                }

                let str = Object.keys(names);

                str.sort((a, b) => {
                    return names[b] - names[a];
                });

                if (!str.length) return cb();

                let text = JSON.parse(str[0]);

                this.pool.query(`
                    UPDATE
                        network
                    SET
                        text = '${text[0]}',
                        text_tokenless = '${text[1]}',
                        _text = '${text[2]}',
                        named = TRUE
                    WHERE
                        id = ${id}
                `, (err, res) => {
                    return cb(err);
                });
            });
        });
    }
}

module.exports = Cluster;

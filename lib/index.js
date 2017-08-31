const os = require('os');
const fs = require('fs');
const turf = require('@turf/turf');
const path = require('path');
const readline = require('readline');
const CP = require('child_process');
const Queue = require('d3-queue').queue;
const _ = require('lodash');

const CPUS  = os.cpus().length;

const diacritics = require('diacritics').remove;
const tokenize = require('./tokenize');
const tokens = require('@mapbox/geocoder-abbreviations');

/**
 * @class Index
 */
class Index {
    constructor(pool) {
        this.pool = pool;
    }

    /**
     * Initialize an empty database with required tables
     * @param {Function} cb Callback in (err, res)
     * @return {Function} cb
     */
    init(cb) {
        this.pool.connect((err, client, release) => {
            if (err) return cb(err);

            client.query(`
                ABORT;
                BEGIN;
                DROP TABLE IF EXISTS meta;
                DROP TABLE IF EXISTS address;
                DROP TABLE IF EXISTS network;

                DROP TABLE IF EXISTS segment;

                DROP TABLE IF EXISTS address_cluster;
                DROP TABLE IF EXISTS network_cluster;

                CREATE EXTENSION IF NOT EXISTS POSTGIS;

                CREATE TABLE address (id SERIAL, segment BIGINT, text TEXT, text_tokenless TEXT, _text TEXT, number NUMERIC, lon TEXT, lat TEXT, source TEXT, geom GEOMETRY(POINTZ, 4326));
                CREATE TABLE network (id SERIAL, segment BIGINT, text TEXT, text_tokenless TEXT, _text TEXT, named BOOLEAN, geomtext TEXT, geom GEOMETRY(LINESTRING, 4326));
                CREATE TABLE segment (id SERIAL, blob JSONB, geom GEOMETRY(MULTIPOLYGON, 4326));

                CREATE INDEX ON address (id);
                CREATE INDEX ON network (id);
                CREATE INDEX ON segment (id);

                CREATE TABLE address_cluster(ID SERIAL, text TEXT, _text TEXT, text_tokenless TEXT, geom GEOMETRY(GEOMETRYZ, 4326));
                CREATE TABLE network_cluster(ID SERIAL, text TEXT, _text TEXT, text_tokenless TEXT, geom GEOMETRY(GEOMETRY, 4326), buffer GEOMETRY(Polygon,4326), address INTEGER);

                CREATE INDEX network_cluster_buffer_gix ON network_cluster USING GIST (buffer);
                CREATE INDEX ON network_cluster (id);
                CREATE INDEX ON address_cluster (id);

                CREATE TABLE meta (k TEXT UNIQUE, v TEXT);
                COMMIT;
            `, (err, res) => {
                client.release();
                return cb(err);
            });
        });
    }

    /**
     * Import a stream of 'map' module generated ITP Features into a given database
     * (Currently used to bring map geojson back into database for debug mode
     *
     * @param {string}      path    to itp geojson file
     * @param {Object}      opts    optional args
     * @param {Function}    cb      Callback
     * @return {Function}           in form fxn(err)
     */
    itp(path, opts = {}, cb) {
        this.pool.query(`
            BEGIN;

            CREATE EXTENSION IF NOT EXISTS POSTGIS;

            DROP TABLE IF EXISTS itp;

            CREATE TABLE itp (id BIGINT, blob JSONB, geom GEOMETRY(GEOMETRY, 4326) );

            COPY itp (blob) FROM '${path}' WITH CSV DELIMITER '|' QUOTE E'\b' NULL AS '';

            UPDATE itp
                SET
                    geom = ST_Envelope(ST_SetSRID(ST_GeomFromGeoJSON(blob->>'geometry'), 4326)),
                    id = (blob->>'id')::BIGINT;

            CREATE INDEX itp_gix ON itp USING GIST (geom);

            COMMIT;
        `, (err) => {
            return cb(err);
        });
    }

    /**
     * Import a stream of GeoJSON (Multi)Polygon Features to use to split the clusering operation by
     *
     * @param {string}      path    to itp geojson file
     * @param {Object}      opts    optional args
     * @param {Function}    cb      Callback
     * @return {Function}           in form fxn(err)
     */
    segment(path, opts = {}, cb) {
        if (!path) {
            const segQ = Queue();

            segQ.defer((done) => {
                this.pool.query(`
                    UPDATE network SET segment = 1;
                `, done)
            });

            segQ.defer((done) => {
                this.pool.query(`
                    UPDATE address SET segment = 1;
                `, done)
            });

            segQ.awaitAll((err) => {
                return cb(err, [1]);
            });
        } else {
            this.pool.query(`
                BEGIN;

                DELETE FROM segment;
                COPY segment (blob) FROM '${path}' WITH CSV DELIMITER '|' QUOTE E'\b' NULL AS '';

                UPDATE segment
                    SET
                        geom = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(blob->>'geometry'), 4326));

                CREATE INDEX IF NOT EXISTS segment_gidx ON segment USING GIST (geom);

                COMMIT;
            `, (err, res) => {
                const segQ = Queue();

                segQ.defer((done) => {
                    this.pool.query(`
                        BEGIN;

                        UPDATE network
                            SET segment = segment.id
                            FROM segment
                            WHERE
                                ST_Intersects(segment.geom, network.geom)
                                AND network.segment IS NULL;

                        UPDATE address
                            SET segment = 0
                            WHERE segment IS NULL;

                        COMMIT;
                    `, done);
                });

                segQ.defer((done) => {
                    this.pool.query(`
                        BEGIN;

                        UPDATE address
                            SET segment = segment.id
                            FROM segment
                            WHERE
                                ST_Intersects(segment.geom, address.geom)
                                AND address.segment IS NULL;

                        UPDATE network
                            SET segment = 0
                            WHERE segment IS NULL;

                        COMMIT;
                    `, done);
                });

                segQ.awaitAll((err, res) => {
                    if (err) return cb(err);

                    this.pool.query(`
                        SELECT
                            segment
                        FROM (
                            SELECTsegment FROM network GROUP BY segment
                            UNION
                            SELECT segment FROM address GROUP BY segment
                        ) AS seg
                        GROUP BY segment;
                    `, (err, res) => {
                        if (err) return cb(err);

                        let segs = res.rows.map((row) => {
                            return row.segment;
                        });

                        return cb(null, segs);
                    });
                });
            });
        }
    }

    /**
     * Index/bucket a stream of geojson features into groups of similiarly named features
     *
     * @param {string} file     of geojson Features to be indexed by `street` property
     * @param {string} type     type of geojson feature - either `address` or `network`
     * @param {Object} opts     optional arguments
     *                          opts.tokens - JSON Object in the form of a token replacement file. See ./lib/tokens/ for examples
     *                          opts.map    - JS module to filter/convert input into pt2itp accepted format
     *                          opts.error  - File to write invalid features to
     * @param {Function} cb     callback funtion
     * @return {Function}       in the form fxn(err)
    */
    copy(file, type, opts = {}, cb) {
        if (!type) return cb(new Error('Type must be address or network'));
        let self = this;

        let cpu_spawn = Math.floor(CPUS / 2);
        let nursery = [];

        let ready = 0;

        while (cpu_spawn--) {
            let child = CP.fork(path.resolve(__dirname, './copy'), {
                stdio: ['pipe', 'pipe', 'pipe', 'ipc']
            });

            let psv = `${os.tmpdir()}/${type}-${nursery.length}-${(new Date).getTime()}.psv`;

            let id = nursery.push({
                active: true,
                output: psv,
                child: child
            }) - 1;

            if (opts.error) child.stderr.pipe(opts.error);

            child.stdin.on('error', epipe);
            child.stdout.on('error', epipe);
            child.stderr.on('error', epipe);

            child.send({
                id: id,
                read: path.resolve(__dirname, '..',  file),
                type: type,
                tokens: opts.tokens,
                output: psv,
                total: Math.floor(CPUS / 2),
                error: opts.error ? true : false,
                map: opts.map
            });

            child.on('error', (err) => {
                return cb(err);
            });

            child.on('message', (message) => {
                ready++;

                console.error(`ok - ${type} child finished`);

                if (ready >= Math.floor(CPUS / 2)) {
                    copyRes();
                }
            });
        }

        /**
         * Handle pipe errors in a standard format
         * @param {Error} err
         * @return {Function} Parent level callback
         */
        function epipe(err) {
            console.error('not ok - epipe error');
            return cb(err);
        }

        /**
         * Copy PSV file generated by child processes into database
         */
        function copyRes() {
            console.error(`ok - standardized ${type} input data`)
            console.error(`ok - importing ${type} data`);

            if (type === 'address') {
                const addrQ = new Queue();

                for (let child of nursery) {
                    addrQ.defer((output, done) => {
                        self.pool.query(`
                            COPY address (text, text_tokenless, _text, lon, lat, number, source)
                            FROM '${output}' WITH CSV DELIMITER '|' QUOTE E'\b' NULL AS '';
                        `, (err) => {
                            if (err) return done(err);
                            fs.unlink(output, (err) => {
                                return done(err);
                            });
                        });
                    }, child.output);
                }

                addrQ.awaitAll((err, res) => {
                    if (err) return cb(err);
                    return kll();
                });
            } else {
                const netQ = new Queue();

                for (let child of nursery) {
                    netQ.defer((output, done) => {
                        self.pool.query(`
                            COPY network (text, text_tokenless, _text, geomtext)
                            FROM '${output}' WITH CSV DELIMITER '|' QUOTE E'\b' NULL AS '';
                        `, (err) => {
                            if (err) return done(err);

                            fs.unlink(output, (err) => {
                                return done(err);
                            });
                        });
                    }, child.output);
                }
                netQ.awaitAll((err, res) => {
                    if (err) return cb(err);
                    return kll();
                });
            }
        }

        /**
         * Kill children once all jobs have completed
         * @param {Error} err Error from chained parent
         * @return {Function} Return parent callback
         */
        function kll(err) {
            if (err) return cb(err);

            for (let child of nursery) {
                child.child.kill();
            }

            return cb();
        }
    }

    /**
     * Asynconous Key/Value meta storage in database
     * @param {string} key
     * @param {Object|string} value JSON objects with be stringified
     * @param {Function} cb Callback in (err, res)
     * @return {Function} cb
     */
    setMeta(key, value, cb) {
        if (typeof value === 'object') value = JSON.stringify(value);

        this.pool.query(`
            INSERT INTO meta (k, v)
                VALUES ('${key}', '${value}')
                ON CONFLICT (k) DO
                    UPDATE SET v = '${value}';
        `, (err, res) => {
            if (cb) return cb(err);
            else if (err) throw err;
        });
    }

    /**
     * Asynconous Key/Value retrieval
     * @param {string} key (optional - if omitted all K/V will be returned)
     * @param {Function} cb Callback in (err, res)
     * @return {Function} cb
     */
    getMeta(key, cb) {
        if (key === true || !key) { //Return all meta
            this.pool.query(`
                SELECT * FROM meta;
            `, (err, res) => {
                if (err) return cb(err);
                if (!res.rows.length) return cb(null, {});

                let meta = {};

                for (let r of res.rows) {
                    try {
                        meta[r.k] = JSON.parse(r.v);
                    } catch (err) {
                        meta[r.k] = r.v;
                    }
                }

                return cb(null, meta);
            });
        } else {
            this.pool.query(`
                SELECT v
                    FROM
                        meta
                    WHERE
                        k = '${key}';
            `, (err, res) => {
                if (!res.rows.length) return cb(new Error('Key not found'));

                let val;
                try {
                    val = JSON.parse(res.rows[0].v);
                } catch (err) {
                    val = res.rows[0].v;
                }

                return cb(err, val);
            });
        }
    }

    /**
     * Encode addresses into Z coordinate of Point Geometry to ensure they are retained through clustering operation
     * @param {Function} cb Callback in (err, res)
     * @return {Function} cb
     */
    optimize(cb) {
        //This is so beautifully hacky it makes me want to cry.
        //ST_ClusterWithin is lossy and individual ids can't be tracked through
        //But it's not calculated in 3D space, but retains 3D coord
        //Set number as 3D coord to track through :') tears of painful happiness

        const self = this;

        const optimizeQ = Queue();

        optimizeQ.defer((done) => {
            this.pool.query(`
                BEGIN;

                DELETE FROM address WHERE length(number::TEXT) > 10;

                UPDATE address SET geom = ST_SetSRID(ST_MakePoint(substring(lon from 1 for 10)::NUMERIC, substring(lat from 1 for 10)::NUMERIC, number), 4326);

                CREATE INDEX address_idx ON address (text);
                CREATE INDEX address_gix ON address USING GIST (geom);
                CLUSTER address USING address_idx;
                ANALYZE address;

                COMMIT;
            `, done);
        });

        optimizeQ.defer((done) => {
            this.pool.query(`
                BEGIN;

                UPDATE network SET geom = ST_SetSRID(ST_GeomFromGeoJSON(geomtext), 4326);

                CREATE INDEX network_idx ON network (text);
                CREATE INDEX network_gix ON network USING GIST (geom);

                CLUSTER network USING network_idx;
                ANALYZE network;

                COMMIT;
            `, done);
        });

        optimizeQ.awaitAll((err) => {
            return cb(err);
        });
    }
}

module.exports = Index;

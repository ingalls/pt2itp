const os = require('os');
const fs = require('fs');
const turf = require('@turf/turf');
const path = require('path');
const readline = require('readline');
const CP = require('child_process');
const Queue = require('d3-queue').queue;
const _ = require('lodash');
const pgcopy = require('pg-copy-streams').from;

const CPUS = os.cpus().length;

const tokenize = require('../util/tokenize');
const tokens = require('@mapbox/geocoder-abbreviations');

/**
 * @class Index
 */
class Index {
    constructor(pool) {
        this.pool = pool;
    }

    /**
     * Initialize an empty map database with required tables
     * @param {Function} cb Callback in (err, res)
     * @return {Function} cb
     */
    init(cb) {
        this.pool.connect((err, client, release) => {
            if (err) return cb(err);

            client.query(`
                ABORT;
                BEGIN;

                CREATE EXTENSION IF NOT EXISTS POSTGIS;

                DROP TABLE IF EXISTS intersections;
                CREATE TABLE intersections (
                    id SERIAL,
                    a_id BIGINT,
                    b_id BIGINT,
                    a_street JSONB,
                    b_street JSONB,
                    geom GEOMETRY(POINT, 4326)
                );
                CREATE INDEX ON intersections (id);

                DROP TABLE IF EXISTS address_cluster;
                CREATE TABLE address_cluster(ID SERIAL, name JSONB, geom GEOMETRY(MULTIPOINTZ, 4326), netid BIGINT, props JSONB);
                CREATE INDEX ON address_cluster (id);

                DROP TABLE IF EXISTS address_orphan_cluster;
                CREATE TABLE address_orphan_cluster(ID SERIAL, name JSONB, geom GEOMETRY(MULTIPOINTZ, 4326));

                DROP TABLE IF EXISTS network_cluster;
                CREATE TABLE network_cluster(ID SERIAL, name JSONB, geom GEOMETRY(GEOMETRYZ, 4326), address BIGINT, source_ids BIGINT[]);

                CREATE INDEX network_cluster_source_ids_idx ON network_cluster USING GIN (source_ids);
                CREATE INDEX ON network_cluster (id);
                CREATE INDEX ON address_orphan_cluster (id);

                DROP TABLE IF EXISTS meta;
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

            \copy itp (blob) FROM '${path}' WITH CSV DELIMITER '|' QUOTE E'\b' NULL AS '';

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
                read: path.resolve(__dirname, '..', file),
                type: type,
                tokens: opts.tokens,
                output: psv,
                total: Math.floor(CPUS / 2),
                error: opts.error ? true : false,
                map: opts.map,
                context: opts.context
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
                        self.pool.connect((err, client, pgdone) => {
                            if (err) return done(err);

                            const cpStream = client.query(pgcopy(`
                                COPY address (name, lon, lat, number, source, output, props)
                                    FROM STDIN
                                    WITH
                                        CSV
                                        DELIMITER '|'
                                        QUOTE E'\b'
                                        NULL AS ''
                            `));
                            const fsStream = fs.createReadStream(output);

                            fsStream.on('error', done);
                            cpStream.on('error', done);
                            cpStream.on('end', (err, res) => {
                                if (err) return done(err);

                                pgdone();

                                fs.unlink(output, (err) => {
                                    return done(err);
                                });
                            });

                            fsStream.pipe(cpStream);
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
                        self.pool.connect((err, client, pgdone) => {
                            if (err) return done(err);

                            const cpStream = client.query(pgcopy(`
                                COPY network (id, name, geomtext, network_length)
                                    FROM STDIN
                                    WITH
                                        CSV
                                        DELIMITER '|'
                                        QUOTE E'\b'
                                        NULL AS ''
                            `));
                            const fsStream = fs.createReadStream(output);

                            fsStream.on('error', done);
                            cpStream.on('error', done);
                            cpStream.on('end', (err, res) => {
                                if (err) return done(err);

                                pgdone();

                                fs.unlink(output, (err) => {
                                    return done(err);
                                });
                            });

                            fsStream.pipe(cpStream);
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
     * Index/bucket a stream of persistent addresses
     *
     * @param {string} file     of geojson Features to be indexed by `street` property
     * @param {Object} opts     optional arguments
     *                          opts.tokens - JSON Object in the form of a token replacement file. See ./lib/tokens/ for examples
     *                          opts.map    - JS module to filter/convert input into pt2itp accepted format
     *                          opts.error  - File to write invalid features to
     * @param {Function} cb     callback funtion
     * @return {Function}       in the form fxn(err)
    */
    copy_conflate(file, opts = {}, cb) {
        let self = this;

        let cpu_spawn = Math.floor(CPUS / 2);
        let nursery = [];

        let ready = 0;

        while (cpu_spawn--) {
            let child = CP.fork(path.resolve(__dirname, './copy'), {
                stdio: ['pipe', 'pipe', 'pipe', 'ipc']
            });

            let psv = `${os.tmpdir()}/persistent-${nursery.length}-${(new Date).getTime()}.psv`;

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
                read: path.resolve(__dirname, '..', file),
                type: 'persistent',
                tokens: opts.tokens,
                output: psv,
                total: Math.floor(CPUS / 2),
                error: opts.error ? true : false,
                map: opts.map,
                context: opts.context
            });

            child.on('error', cb);

            child.on('message', (message) => {
                ready++;

                console.error(`ok - persistent child finished`);

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
            console.error(`ok - standardized address input data`)
            console.error(`ok - importing address data`);

            const addrQ = new Queue();

            for (let child of nursery) {
                addrQ.defer((output, done) => {
                    self.pool.connect((err, client, pgdone) => {
                        if (err) return done(err);

                        const cpStream = client.query(pgcopy(`
                            COPY persistent (id, name, number, props, lon, lat)
                                FROM STDIN
                                WITH
                                    CSV
                                    DELIMITER '|'
                                    QUOTE E'\b'
                                    NULL AS ''
                        `));
                        const fsStream = fs.createReadStream(output);

                        fsStream.on('error', done);
                        cpStream.on('error', done);
                        cpStream.on('end', (err, res) => {
                            if (err) return done(err);

                            pgdone();

                            fs.unlink(output, (err) => {
                                return done(err);
                            });
                        });

                        fsStream.pipe(cpStream);
                    });
                }, child.output);
            }

            addrQ.awaitAll((err, res) => {
                if (err) return cb(err);

                for (let child of nursery) {
                    child.child.kill();
                }

                return cb();
            });
        }
    }
}

module.exports = Index;

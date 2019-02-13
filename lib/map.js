const Queue = require('d3-queue').queue;
const CP = require('child_process');
const Prog = require('progress');
const path = require('path');
const turf = require('@turf/turf');
const pg = require('pg');
const fs = require('fs');
const os = require('os');

const import_addr = require('../native/index.node').import_addr;
const import_net = require('../native/index.node').import_net;

const CPUS = process.env.CI ? 10 : Math.min(16, os.cpus().length);

const Cluster = require('./map/cluster');
const Orphan = require('./map/orphan');
const Index = require('./map/index');
const split = require('./map/split');

const linesplit = require('split');
const tokenize = require('./util/tokenize');

/**
 * Main entrance to map module which combines address points and linestrings into clustered PT&ITP features in a carmen compatible spec
 * @param {Object} argv Argument Object - See argv parser or help module in code for a complete list
 * @param {Function} cb Callback in (err, res)
 * @return {Funtion} cb
 */
function main(argv, cb) {
    if (!cb || typeof cb !== 'function') throw new Error('lib/map.js requires a callback parameter');

    if (Array.isArray(argv)) {
        argv = require('minimist')(argv, {
            string: [
                'props',
                'post',
                'output',
                'in-network',
                'in-address',
                'label',
                'map-network',
                'map-address',
                'error-network',
                'error-address',
                'tokens',
                'country',
                'region',
                'db'
            ],
            boolean: [
                'name',
                'debug',
                'skip-import',
                'intersections'
            ],
            alias: {
                'intersections': 'intersection',
                'in-address': 'in-addresses',
                'map-address': 'map-addresses',
                'database': 'db',
                'label': 'l',
                'output': 'o',
                'tokens': 'token',
                'prop': 'props'
            }
        });
    }

    if (!argv['in-address'] && !argv['skip-import']) {
        return cb(new Error('--in-address=<FILE.geojson> argument required'));
    } else if (!argv['in-network'] && !argv['skip-import']) {
        return cb(new Error('--in-network=<FILE.geojson> argument required'));
    } else if (!argv.output) {
        return cb(new Error('--output=<FILE.geojson> argument required'));
    } else if (!argv.db) {
        return cb(new Error('--db=<DATABASE> argument required'));
    }

    let post;
    if (argv.post) {
        argv.post = argv.post.split(',');
        for (let p of argv.post) {
            if (['cardinality'].indexOf(p) === -1) return cb(new Error(`unknown parameter '${p}' in --post flag`));
        }
    }

    if (argv.prop) argv.prop = argv.prop.split(',');

    let tokens;
    if (argv.tokens) {
        argv.tokens = argv.tokens.split(',')
        tokens = tokenize.createReplacer(argv.tokens);
    } else {
        argv.tokens = [];
    }

    const output = fs.createWriteStream(path.resolve(__dirname, '..', argv.output));

    const poolConf = {
        max: CPUS,
        user: 'postgres',
        database: argv.db,
        idleTimeoutMillis: 30000
    }

    const pool = new pg.Pool(poolConf);

    let opts = { pool: pool };
    const cluster = new Cluster(opts);
    const index = new Index(pool);
    const orphan = new Orphan(pool, argv, output, post);

    if (argv['skip-import']) {
        createIndex();

    } else {
        const context = {
            country: argv.country ? argv.country : '',
            region: argv.region ? argv.region : '',
            tokens: tokenize.getTokens(argv.tokens).map((tokens) => {
                return tokens.filter((token) => {
                    return typeof token == 'string'
                });
            })
        };

        console.error('ok - importing address data');
        import_addr({
            db: argv.db,
            seq: true,
            input: argv['in-address'],
            context: context,
            errors: argv['error-address']
        });

        console.error('ok - importing network data');
        import_net({
            db: argv.db,
            seq: true,
            input: argv['in-network'],
            context: context,
            errors: argv['error-network']
        });

        createIndex();
    }

    /**
     * Create Tables, Import, & Optimize by generating indexes
     */
    function createIndex() {
        index.init((err) => {
            if (err) return cb(err);

            //Set Some Args to metatable only if they're not null and have been declared by the user- Don't wait for callback as we won't actually use those in this module - they are useful for debug/test/etc modes
            if (tokens !== undefined && tokens !== null) {
                index.setMeta('tokens', tokens);
            }
            if (argv.country !== undefined && argv.country !== null) {
                index.setMeta('country', argv.country);
            }

            console.error('ok - imported data');

            clusterGeom();
        });
    }

    /**
     * Cluster individual LineString/Point geometries into MultiPoint/MultiLineString geometries based on geometric proximity
     */
    function clusterGeom(err, segs) {
        if (err) return cb(err);

        cluster.network((err) => {
            if (err) return cb(err);

            console.error('ok - network geometries clustered');

            cluster.optimize((err) => {
                if (err) return cb(err);

                console.error('ok - created cluster indexes');

                return matcher();
            });
        });
    }

    /**
     * Match network clusters with a proximal and textually similiar address cluster
     */
    function matcher() {
        pool.query(`SELECT MAX(id) AS max FROM address`, (err, res) => {
            if (err) return cb(err);

            if (!res.rows.length || res.rows[0].max <= 0) return cb(new Error('address has no addresses to match!'));

            const addrNum = parseInt(res.rows[0].max);
            const bar = new Prog('ok - Cross Matching Data [:bar] :percent :etas', {
                complete: '=',
                incomplete: ' ',
                width: 20,
                total: addrNum + 1
            });
            bar.tick(1); //Show progress bar

            let cpu_spawn = Math.min(Math.ceil(addrNum / 5000), CPUS); //number of 5000 groups or # of CPUs, whichever is smaller
            let nursery = [];

            let addrNum_it = 1; //Postgis SERIAL begins at 1

            while (cpu_spawn--) {
                let child = CP.fork(path.resolve(__dirname, './map/match'), {
                    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
                });

                child.stdin.on('error', epipe);
                child.stdout.on('error', epipe);
                child.stderr.on('error', epipe);
                child.stderr.pipe(process.stderr);

                child.on('message', (message) => {
                    if (message.error) return cb(message.error);

                    if (message.jobs) bar.tick(message.jobs);

                    if (addrNum_it >= addrNum) {
                        nursery[message.id].kill();

                        let active = nursery.some((instance) => {
                            return (!instance.killed)
                        });

                        if (!active) {
                            console.error('ok - addresses assigned to linestring');
                            return cluster.address(intersection);
                        }
                    } else {
                        let max = addrNum_it = addrNum_it + 5000;
                        let min = max - 5000;

                        nursery[message.id].send({
                            min: min,
                            max: max
                        });
                    }
                });

                let id = nursery.push(child) - 1;

                child.send({
                    id: id,
                    pool: poolConf
                });
            }
        });
    }

    /**
     * Manage intersection generation
     */
    async function intersection() {
        console.error('ok - orphans output');

        try {
            const intsec = new (require('./map/intersections'))({
                pool: poolConf
            });

            await intsec.generate();

            console.error('ok - generated intersections');

            return splitter();

        } catch (err) {
            return cb(err);
        }
    }

    /**
     * Find closest Segment in network for each address point in matched cluster and generate ITP output
     */
    function splitter() {
        pool.query(`SELECT id FROM network_cluster WHERE address IS NOT NULL;`, (err, res) => {
            if (err) return cb(err);

            if (!res.rows.length || res.rows[0].count === 0) return cb(new Error('Network Cluster has no geometries to Split!'));

            const bar = new Prog('ok - Splitting Data [:bar] :percent :etas', {
                complete: '=',
                incomplete: ' ',
                width: 20,
                total: res.rows.length + 1
            });

            bar.tick(1); //Show progress bar

            let cpu_spawn = Math.min(Math.ceil(res.rows.length / 1000), CPUS); //number of 1000 groups or # of CPUs, whichever is smaller
            let nursery = [];

            let ids = res.rows.map((row) => {
                return row.id
            });

            while (cpu_spawn--) {
                let child = CP.fork(path.resolve(__dirname, './map/split'), {
                    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
                });

                child.stdin.on('error', epipe);
                child.stdout.on('error', epipe);
                child.stderr.on('error', epipe);

                child.stdout.pipe(linesplit()).on('data', (line) => {
                    if (line) output.write(line + '\n');
                });
                child.stderr.pipe(process.stderr);

                child.on('message', (message) => {
                    if (message.error) {
                        return cb(new Error(`splitter child process error (${message.id}, jobs ${message.jobs}: ${message.error})`));
                    }

                    if (message.jobs) bar.tick(message.jobs);

                    if (!ids.length) {
                        if (message.type === 'end') {
                            // type == end means we have received the all-clear from a process that acted on a kill signal
                            // nursery[message.id].active = false;
                            nursery[message.id].kill();

                            let active = nursery.some((instance) => {
                                return (!instance.killed)
                            });

                            if (!active) {
                                return orphans();
                            }
                        } else {
                            // send kill signal so the pgpool can be shut down properly
                            nursery[message.id].send({ id: message.id, type: 'end' });
                        }
                    } else {
                        nursery[message.id].send(ids.splice(0, 1000));
                    }
                });

                let id = nursery.push(child) - 1;

                opts = {
                    id: id,
                    props: argv.props,
                    post: argv.post,
                    label: argv.label,
                    country: argv.country,
                    debug: argv.debug,
                    tokens: argv.tokens,
                    intersections: argv.intersections,
                    pool: poolConf
                };

                child.send(opts);
            }
        });
    }

    /**
     * Output all address_clusters which were not matched to a network_cluster to retain the data
     * and also output all network_clusters not matched to an address_cluster to at least
     * allow searching for the street name
     */
    function orphans() {
        orphanQ = new Queue();

        orphanQ.defer((done) => {
            orphan.address(done)
        });

        orphanQ.defer((done) => {
            orphan.network(done)
        });

        orphanQ.awaitAll(finalize);
    }


    /**
     * Close all used resources and prepare for termination
     */
    function finalize(err) {
        if (err) return cb(err);

        console.error('ok - Doing a bit of housecleaning');

        output.end();
        pool.end();

        console.error('ok - You\'re all set!');

        return cb();
    }

    /**
     * Standard pipe error handler
     * @param {Error} err
     * @return {Function} Call parent cb
     */
    function epipe(err) {
        console.error('not ok - epipe error');
        return cb(err);
    }
}

module.exports = main;

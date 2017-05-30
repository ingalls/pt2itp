const tokens = require('@mapbox/geocoder-abbreviations')
const Queue = require('d3-queue').queue;
const Cursor = require('pg-cursor');
const prog = require('progress');
const path = require('path');
const turf = require('@turf/turf');
const pg = require('pg');
const fs = require('fs');

const Cluster = require('./cluster');
const Index = require('./index');
const Feat = require('./feat');

const buffer = require('./buffer');
const split = require('./split');

module.exports = function(argv, cb) {
    if (!cb || typeof cb !== 'function') throw new Error('lib/map.js requires a callback parameter');

    if (Array.isArray(argv)) {
        argv = require('minimist')(argv, {
            string: [
                'error',
                'output',
                'in-network',
                'in-address',
                'map-network',
                'map-address',
                'segment',
                'tokens',
                'country',
                'db'
            ],
            boolean: [
                'name',
                'debug',
                'skip-import'
            ],
            alias: {
                'in-address': 'in-addresses',
                'map-address': 'map-addresses',
                'database': 'db',
                'output': 'o',
                'error': 'e',
                'tokens': 'token'
            }
        });
    }

    if (!argv['in-address'] && !argv['skip-import']) {
        return cb(new Error('--in-address=<FILE.geojson> argument required'));
    } else if (!argv['in-network'] && !argv['skip-import']) {
        return cb(new Error('--in-network=<FILE.geojson> argument required'));
    } else if (!argv['output']) {
        return cb(new Error('--output=<FILE.geojson> argument required'));
    } else if (!argv.db) {
        return cb(new Error('--db=<DATABASE> argument required'));
    }

    if (argv['map-network']) argv['map-network'] = path.resolve(__dirname, './map/', argv['map-network'] + '.js');
    if (argv['map-address']) argv['map-address'] = path.resolve(__dirname, './map/', argv['map-address'] + '.js');

    if (argv.error) argv.error = fs.createWriteStream(path.resolve(__dirname, '..', argv.error))

    if (argv.segment) argv.segment = path.resolve(__dirname, '..',  argv.segment);

    if (argv.tokens) {
        argv.tokens = argv.tokens.split(',');

        let parsed = [];
        argv.tokens.forEach((token) => {
            parsed = parsed.concat(tokens(token, true)); // pull singletons in, too -- ie tokens that are common but have no abbreviation
        });

        let parsedTokens = {};
        parsed.forEach((parse) => {
            parse.sort((a, b) => {
                return a.length > b.length
            });

            // we intentionally mark the smallest token as a replacement for itself
            // this seems silly but it lets us exclude it from text_tokenless in cases where it's pre-abbreviated
            for (let pi = 0; pi < parse.length; pi++)
                parsedTokens[parse[pi].toLowerCase()] = parse[0].toLowerCase();

            argv.tokens = parsedTokens;
        });
    }

    const output = fs.createWriteStream(path.resolve(__dirname, '..', argv.output));

    /*
     * Addresses lose their ID during clustering so the number is encoded as the Z coord to keep it linked to the correct geom
     * Since unit numbers can't be encoded - encode the number as a float ie 1.1 and use the .## as a lookup for the proper unit
     */
    const unitMap = {};
    argv.unitMap = unitMap;

    const pool = new pg.Pool({
        max: 10,
        user: 'postgres',
        database: argv.db,
        idleTimeoutMillis: 30000
    });

    const cluster = new Cluster(pool);
    const index = new Index(pool);
    const feat = new Feat({
        country: argv.country
    });

    if (argv['skip-import']) {
        nameNetwork();
    } else {
        //Get Size of input files to pass to progress bar
        fsQ = Queue();

        fsQ.defer(fs.stat, path.resolve(__dirname, '..',  argv['in-address']));
        fsQ.defer(fs.stat, path.resolve(__dirname, '..',  argv['in-network']));

        fsQ.awaitAll((err, res) => {
            if (err) return cb(err);

            createIndex(res[0].size + res[1].size);
        });
    }

    //Create Tables, Import, & Optimize by generating indexes
    function createIndex(total) {
        const bar = new prog('ok - Importing Data [:bar] :percent :etas', {
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: total
        });

        index.init((err) => {
            if (err) return cb(err);

            //Set Some Args to metatable - Don't wait for callback as we won't actually use those in this module - they are useful for debug/test/etc modes
            index.setMeta('tokens', argv.tokens);
            index.setMeta('country', argv.country);

            indexQ = Queue();

            if (argv.segment) {
                indexQ.defer((done) => {
                    index.segment(argv.segment, null, done);
                });
            }

            indexQ.defer((done) => {
                index.copy(fs.createReadStream(path.resolve(__dirname, '..',  argv['in-address'])), 'address', {
                    tokens: argv.tokens,
                    map: argv['map-address'],
                    error: argv.error,
                    unitMap: unitMap,
                    bar: bar
                }, done);
            });

            indexQ.defer((done) => {
                index.copy(fs.createReadStream(path.resolve(__dirname, '..',  argv['in-network'])), 'network', {
                    tokens: argv['tokens'],
                    error: argv.error,
                    map: argv['map-network'],
                    bar: bar
                }, done);
            });

            indexQ.awaitAll((err) => {
                if (err) return cb(err);

                console.error('\nok - imported data');

                feat.units = unitMap;

                index.setMeta('units', unitMap, (err) => {
                    if (err) return cb(err);

                    console.error('ok - saved units metadata');

                    index.optimize(nameNetwork)
                });
            });
        });
    }

    //Attempt to add names to any unanmed streets
    function nameNetwork(err) {
        if (err) throw err;
        console.error('ok - optimized data')

        pool.connect((err, client, pg_done) => {
            if (err) return cb(err);

            client.query('SELECT count(*) FROM network WHERE text = \'\';', (err, res) => {
                if (err) return cb(err);

                const bar = new prog('ok - Interpolating Missing Names [:bar] :percent :etas', {
                    complete: '=',
                    incomplete: ' ',
                    width: 20,
                    total: res.rows[0].count++
                });
                bar.tick(1);

                const cursor = client.query(new Cursor(`SELECT id FROM network WHERE text = '';`));

                let batch = 0;

                return iterate();

                function iterate() {
                    cursor.read(100, (err, rows) => {
                        if (!rows.length) {
                            pg_done();
                            return clusterGeom();
                        }

                        const nameQ = Queue();

                        for (let row_it = 0; row_it < rows.length; row_it++) {
                            nameQ.defer(cluster.name, rows[row_it].id);
                        }

                        nameQ.await((err) => {
                            if (err) return cb(err);

                            console.error('ok - named unnamed streets ' + batch);
                            batch++;

                            bar.tick(rows.length);
                            return iterate();
                        });
                    });
                }
            });
        });
    }

    function clusterGeom(names) {
        const clusterQ = Queue();

        clusterQ.defer((done) => {
            cluster.address(done);
        });
        clusterQ.defer((done) => {
            cluster.network(done);
        });

        clusterQ.await((err) => {
            if (err) return cb(err);

            console.error('ok - geometries clustered');

            cluster.optimize((err) => {
                if (err) return cb(err);

                console.error('ok - created cluster indexes');

                return matcher();
            });
        });
    }

    function matcher() {
        pool.connect((err, client, pg_done) => {
            if (err) return cb(err);

            client.query(`SELECT count(*) FROM network_cluster WHERE text != '' AND TEXT IS NOT NULL`, (err, res) => {
                if (err) return cb(err);

                const bar = new prog('ok - Cross Matching Data [:bar] :percent :etas', {
                    complete: '=',
                    incomplete: ' ',
                    width: 20,
                    total: res.rows[0].count++
                });

                bar.tick(1);

                const cursor = client.query(new Cursor(`SELECT id FROM network_cluster WHERE text != '' AND TEXT IS NOT NULL;`));
                let batch = 0;

                return iterate();

                function iterate() {
                    cursor.read(100, (err, rows) => {
                        if (err) return cb(err);

                        if (!rows.length) {
                            pg_done();
                            return splitter();
                        }

                        const matchQ = Queue();

                        for (let row_it = 0; row_it < rows.length; row_it++) {
                            matchQ.defer((done) => {
                                cluster.match(rows[row_it].id, done);
                            });
                        }

                        matchQ.await((err) => {
                            if (err) return cb(err);

                            bar.tick(rows.length);
                            batch++;

                            return iterate();
                        });
                    });
                }
            });
        });
    }

    function splitter() {
        pool.connect((err, client, pg_done) => {
            if (err) return cb(err);

            client.query(`SELECT count(*) FROM network_cluster WHERE text != '' AND address IS NOT NULL;`, (err, res) => {
                if (err) return cb(err);

                const bar = new prog('ok - Splitting Data [:bar] :percent :etas', {
                    complete: '=',
                    incomplete: ' ',
                    width: 20,
                    total: parseInt(res.rows[0].count)
                });


                //If we want all streets and not just clusters that have an address cluster match we need to write addresses
                //  to file that are WHERE text != '' AND address IS NULL;
                const cursor = client.query(new Cursor(`SELECT id FROM network_cluster WHERE text != '' AND address IS NOT NULL;`));

                return iterate();

                function iterate() {
                    cursor.read(100, (err, rows) => {
                        if (err) return cb(err);

                        if (!rows.length) {
                            pg_done();
                            return orphanAddr();
                        }

                        const splitQ = Queue();

                        for (let row_it = 0; row_it < rows.length; row_it++) {
                            splitQ.defer(split, argv, rows[row_it].id, pool, output, feat);
                        }

                        splitQ.await((err) => {
                            if (err) return cb(err);

                            bar.tick(100);

                            return iterate();
                        });
                    });
                }
            });
        });
    }

    function orphanAddr() {
        pool.connect((err, client, pg_done) => {
            if (err) return cb(err);

            client.query(`SELECT count(*) FROM address_cluster a LEFT JOIN network_cluster n ON a.id = n.address WHERE n.address IS NULL;`, (err, res) => {
                if (err) return cb(err);

                const bar = new prog('ok - Formatting Unmached Addresses [:bar] :percent :etas', {
                    complete: '=',
                    incomplete: ' ',
                    width: 20,
                    total: parseInt(res.rows[0].count)
                });

                const cursor = client.query(new Cursor(`SELECT a._text, ST_AsGeoJSON(a.geom) AS geom FROM address_cluster a LEFT JOIN network_cluster n ON a.id = n.address WHERE n.address IS NULL;`));

                return iterate();

                function iterate() {
                    cursor.read(100, (err, rows) => {
                        if (err) return cb(err);

                        if (!rows.length) {
                            pg_done();
                            return finalize();
                        }

                        rows.forEach((row) => {
                            let f = feat.create({
                                text: row._text,
                                addr: JSON.parse(row.geom)
                            });

                            output.write(JSON.stringify(f) + '\n');
                        });

                        bar.tick(100);
                        return iterate();
                    });
                }
            });
        });
    }


    function finalize() {
        console.error('ok - addresses assigned to linestring');

        if (argv.error) argv.error.close();
        output.end();
        pool.end();

        return cb();
    }
}

const Queue = require('d3-queue').queue;
const Cursor = require('pg-cursor');
const prog = require('progress');
const path = require('path');
const turf = require('@turf/turf');
const pg = require('pg');
const fs = require('fs');

const cluster = require('./cluster');
const buffer = require('./buffer');
const split = require('./split');
const index = require('./index');
const freq = require('./freq');

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

    if (argv.tokens) {
        argv.tokens = argv.tokens.split(',');

        let parsed = [];
        argv.tokens.forEach((token) => {
            parsed = parsed.concat(JSON.parse(fs.readFileSync(path.resolve(__dirname, './tokens/', token + '.json'), 'utf8')));
        });

        let tokens = {};
        parsed.forEach((parse) => {
            parse.sort((a, b) => {
                return a.length > b.length
            });
            if (parse.length === 1) {
                throw new Error('tokens must be in a min group of two');
            } else if (parse.length > 2) {
                parse.forEach((token, it) => {
                    if (it === 0) return;

                    tokens[token.toLowerCase()] = parse[0].toLowerCase();
                });
            } else {
                tokens[parse[1].toLowerCase()] = parse[0].toLowerCase();
            }

            argv.tokens = tokens;
        });
    }

    let output = fs.createWriteStream(path.resolve(__dirname, '..', argv.output));

    /*
     * Addresses lose their ID during clustering so the number is encoded as the Z coord to keep it linked to the correct geom
     * Since unit numbers can't be encoded - encode the number as a float ie 1.1 and use the .## as a lookup for the proper unit
     */
    let unitMap = new Map();
    argv.unitMap = unitMap;

    let pool = new pg.Pool({
        max: 10,
        user: 'postgres',
        database: argv.db,
        idleTimeoutMillis: 30000
    });

    if (argv['skip-import']) {
        nameNetwork();
    } else {
        //Get Size of input files to pass to progress bar
        fsQ = Queue();

        fsQ.defer(fs.stat, path.resolve(__dirname, '..',  argv['in-address']));
        fsQ.defer(fs.stat, path.resolve(__dirname, '..',  argv['in-network']));

        fsQ.awaitAll((err, res) => {
            if (err) throw err;

            createIndex(res[0].size + res[1].size);
        });
    }

    //Create Tables, Import, & Optimize by generating indexes
    function createIndex(total) {
        let bar = new prog('ok - Importing Data [:bar] :percent :etas', {
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: total
        });

        index.init(pool, (err) => {
            indexQ = Queue();

            indexQ.defer(index.copy, pool, fs.createReadStream(path.resolve(__dirname, '..',  argv['in-address'])), 'address', {
                tokens: argv.tokens,
                map: argv['map-address'],
                error: argv.error,
                unitMap: unitMap,
                bar: bar
            })

            indexQ.defer(index.copy, pool, fs.createReadStream(path.resolve(__dirname, '..',  argv['in-network'])), 'network', {
                tokens: argv['tokens'],
                error: argv.error,
                map: argv['map-network'],
                bar: bar
            })

            indexQ.awaitAll((err) => {
                if (err) throw err;
                console.error('\nok - imported data');

                index.optimize(pool, nameNetwork)
            });
        });
    }

    function nameNetwork(err) {
        if (err) throw err;
        console.error('ok - optimized data')

        pool.connect((err, client, pg_done) => {
            if (err) return cb(err);

            client.query('SELECT count(*) FROM network WHERE text = \'\';', (err, res) => {
                if (err) return cb(err);

                let bar = new prog('ok - Interpolating Missing Names [:bar] :percent :etas', {
                    complete: '=',
                    incomplete: ' ',
                    width: 20,
                    total: res.rows[0].count++
                });
                bar.tick(1);

                let cursor = client.query(new Cursor(`SELECT id FROM network WHERE text = '';`));

                let batch = 0;

                return iterate();

                function iterate() {
                    cursor.read(100, (err, rows) => {
                        if (!rows.length) {
                            pg_done();
                            return getNames();
                        }

                        let nameQ = Queue();

                        for (let row_it = 0; row_it < rows.length; row_it++) {
                            nameQ.defer(cluster.name, rows[row_it].id, pool);
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

    function getNames() {
        pool.query(`
            SELECT text FROM address WHERE text IS NOT NULL GROUP BY text
            UNION
            SELECT text FROM network WHERE text IS NOT NULL GROUP BY text;
        `, (err, res) => {
            if (err) return done(err);

            res = res.rows.map((a) => {
                return a.text;
            });

            console.error('ok - clustered names');
            return mergeNames(res);
        });
    }

    function mergeNames(names) {
        let mergeQ = Queue();

        mergeQ.defer(cluster.address, pool);
        mergeQ.defer(cluster.network, pool);

        mergeQ.await((err) => {
            if (err) return cb(err);

            console.error('ok - geometries clustered');

            cluster.optimize(pool, (err) => {
                if (err) return cb(err);

                console.error('ok - created cluster indexes');

                let calcFreq = freq(names);

                console.error('ok - calculated frequency');

                matcher(calcFreq);
            });
        });
    }

    function matcher(calcFreq) {
        pool.connect((err, client, pg_done) => {
            if (err) return cb(err);

            client.query(`SELECT count(*) FROM network_cluster WHERE text != '' AND TEXT IS NOT NULL`, (err, res) => {
                if (err) return cb(err);

                let bar = new prog('ok - Cross Matching Data [:bar] :percent :etas', {
                    complete: '=',
                    incomplete: ' ',
                    width: 20,
                    total: res.rows[0].count++
                });

                bar.tick(1);

                let cursor = client.query(new Cursor(`SELECT id FROM network_cluster WHERE text != '' AND TEXT IS NOT NULL;`));
                let batch = 0;

                return iterate();

                function iterate() {
                    cursor.read(100, (err, rows) => {
                        if (err) return cb(err);

                        if (!rows.length) {
                            pg_done();
                            return splitter();
                        }

                        let matchQ = Queue();

                        for (let row_it = 0; row_it < rows.length; row_it++) {
                            matchQ.defer(cluster.match, rows[row_it].id, calcFreq, pool);
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

                let bar = new prog('ok - Splitting Data [:bar] :percent :etas', {
                    complete: '=',
                    incomplete: ' ',
                    width: 20,
                    total: parseInt(res.rows[0].count)
                });


                //If we want all streets and not just clusters that have an address cluster match we need to write addresses
                //  to file that are WHERE text != '' AND address IS NULL;
                let cursor = client.query(new Cursor(`SELECT id FROM network_cluster WHERE text != '' AND address IS NOT NULL;`));

                return iterate();

                function iterate() {
                    cursor.read(100, (err, rows) => {
                        if (err) return cb(err);

                        if (!rows.length) {
                            pg_done();
                            return orphanAddr();
                        }

                        let splitQ = Queue();

                        for (let row_it = 0; row_it < rows.length; row_it++) {
                            splitQ.defer(split, argv, rows[row_it].id, pool, output);
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

                let bar = new prog('ok - Formatting Unmached Addresses [:bar] :percent :etas', {
                    complete: '=',
                    incomplete: ' ',
                    width: 20,
                    total: parseInt(res.rows[0].count)
                });

                let cursor = client.query(new Cursor(`SELECT a._text, ST_AsGeoJSON(a.geom) AS geom FROM address_cluster a LEFT JOIN network_cluster n ON a.id = n.address WHERE n.address IS NULL;`));

                return iterate();

                function iterate() {
                    cursor.read(100, (err, rows) => {
                        if (err) return cb(err);

                        if (!rows.length) {
                            pg_done();
                            return finalize();
                        }

                        rows.forEach((row) => {
                            let feat = {
                                id: parseInt(new Date() / 1 + '' + Math.floor(Math.random() * 100)),
                                type: 'Feature',
                                properties: {
                                    'carmen:text': row._text,
                                    'carmen:center': false,
                                    'carmen:addressnumber': []
                                },
                                geometry: {
                                    type: 'GeometryCollection',
                                    geometries: [{
                                        type: 'MultiPoint',
                                        coordinates: []
                                    }]
                                }
                            };

                            let geom = JSON.parse(row.geom);
                            geom.coordinates.forEach((coord) => {
                                if (coord[2] % 1 != 0 && argv.unitMap) {
                                    let unit = parseInt(String(coord[2]).split('.')[1]);
                                    let num = String(coord[2]).split('.')[0];

                                    coord[2] = `${num}${argv.unitMap.get(unit)}`;
                                }

                                feat.properties['carmen:addressnumber'].push(coord.pop());
                                feat.geometry.geometries[0].coordinates.push(coord);
                            });

                            feat.properties['carmen:center'] = turf.pointOnSurface(feat.geometry.geometries[0]).geometry.coordinates;
                            feat.properties['carmen:addressnumber'] = [ feat.properties['carmen:addressnumber'] ];

                            if (argv.country) feat.properties['carmen:geocoder_stack'] = argv.country;

                            output.write(JSON.stringify(feat) + '\n');
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

module.exports = test;

const pg = require('pg');
const fs = require('fs');
const path = require('path');
const prog = require('progress');
const turf = require('@turf/turf');
const Cursor = require('pg-cursor');
const Queue = require('d3-queue').queue;
const diacritics = require('diacritics').remove;
const geocode = require('./geocode');
const tokens = require('@mapbox/geocoder-abbreviations');

const Index = require('./index');
const tokenize = require('./tokenize').main;

//Use raw addresses to query generated ITP output to check for completeness
function test(argv, cb) {
    if (Array.isArray(argv)) {
        argv = require('minimist')(argv, {
            string: [
                'database',
                'index',
                'output',
                'config',
                'limit'
            ],
            alias: {
                database: 'db',
                output: 'o',
                limit: 'l'
            }
        });
    }

    if (!argv.database) {
        console.error('--database=<DB>');
        process.exit(1);
    } else if (!argv.output) {
        console.error('--output=<output.errors> argument required');
        process.exit(1);
    } else if (!argv.index) {
        console.error('--index=<INDEX.mbtiles> argument required');
        process.exit(1);
    } else if (!argv.config) {
        console.error('--config=<CONFIG.json> argument required');
        process.exit(1);
    }
    if (argv.limit) argv.limit = parseInt(argv.limit);

    const pool = new pg.Pool({
        max: 10,
        user: 'postgres',
        database: argv.db,
        idleTimeoutMillis: 30000
    });

    const index = new Index(pool);

    const opts = {
        getInfo: require(path.resolve(argv.config)),
        index: argv.index
    };
    const c = geocode(opts);

    const stats = {
        fail: 0,
        total: 0
    };

    const cursor_it = 5; //Number of rows to grab at a time from postgres;

    const errOut = fs.createWriteStream(path.resolve(process.cwd(), argv.output));

    errOut.write('Fail reason|Query|Coords\n');

    pool.connect((err, client, pg_done) => {
        index.getMeta(true, (err, meta) => {
            if (err) return cb(err);

            matched();

            function matched() {
                console.error('ok - beginning match');
                client.query('SELECT count(*) FROM address_cluster a LEFT JOIN network_cluster n ON a.id = n.address WHERE n.address IS NOT NULL;', (err, res) => {
                    if (err) return cb(err);

                    const cursor = client.query(new Cursor('SELECT a._text, ST_AsGeoJSON(a.geom) AS geom FROM address_cluster a LEFT JOIN network_cluster n ON a.id = n.address WHERE n.address IS NOT NULL' + (argv.limit ? ' LIMIT ' + argv.limit : '') + ';'));

                    const bar = new prog('ok - Testing Network Matched Addresses [:bar] :percent :etas', {
                        complete: '=',
                        incomplete: ' ',
                        width: 20,
                        total: argv.limit || res.rows[0].count++
                    });
                    bar.tick(1);

                    return iterate();

                    function iterate() {
                        cursor.read(cursor_it, (err, rows) => {
                            if (err) return cb(err);

                            if (!rows.length) {
                                return unmatched();
                            }

                            let addrQ = Queue(25);

                            for (let row of rows) {
                                row.geom = JSON.parse(row.geom);

                                for (let addr of row.geom.coordinates) {
                                    if (addr[2] % 1 != 0 && meta.units) {
                                        let unit = parseInt(String(addr[2]).split('.')[1]);
                                        let num = String(addr[2]).split('.')[0];

                                        addr[2] = `${num}${meta.units[unit]}`;
                                    }

                                    addrQ.defer((query, opts, done) => {
                                        stats.total++;
                                        c.geocode(query, opts, (err, res) => {
                                            if (err) return done(err.toString());

                                            if (!res.features.length) {
                                                stats.fail++;
                                                return done(null, `NO RESULTS|${query}|${opts.proximity.join(',')}`);
                                            }

                                            let matched = diacritics(tokenize.main(res.features[0].place_name, meta.tokens).join(' '));
                                            let cleanQuery = diacritics(tokenize.main(query, meta.tokens).join(' '));

                                            let dist = false;
                                            if (res.features[0].geometry.type === 'Point') {
                                                dist = turf.distance(res.features[0].geometry.coordinates, opts.proximity, 'kilometers');
                                            }

                                            if (matched !== cleanQuery) {
                                                stats.fail++;
                                                return done(null, `TEXT FAIL => ${res.features[0].place_name}|${query}|${opts.proximity.join(',')}`);
                                            } else if (dist && dist > 1) {
                                                stats.fail++;
                                                return done(null, `DIST FAIL - ${dist.toFixed(2)}km - returned: ${res.features[0].geometry.coordinates}|${query}|${opts.proximity.join(',')}`);
                                            } else if (dist === false) { //Usually a street level result
                                                stats.fail++;
                                                return done(null, `DIST FAIL|${query}|${opts.proximity.join(',')}`);
                                            }

                                            return done(null, true);

                                        });
                                    }, `${addr[2]} ${row._text}`, {
                                        proximity: [ addr[0], addr[1] ]
                                    });
                                }
                            }

                            addrQ.awaitAll((err, res) => {
                                if (err) return cb(err);

                                for (let r of res) {
                                    if (r === true) continue;

                                    errOut.write(`${r}\n`);
                                }

                                bar.tick(cursor_it);
                                setImmediate(iterate);
                            });
                        });
                    }

                });
            }

            function unmatched() {
                console.error('ok - beginning unmatch');
                client.query('SELECT count(*) FROM address_cluster a LEFT JOIN network_cluster n ON a.id = n.address WHERE n.address IS NULL;', (err, res) => {
                    if (err) return cb(err);

                    const cursor = client.query(new Cursor('SELECT a._text, ST_AsGeoJSON(a.geom) AS geom FROM address_cluster a LEFT JOIN network_cluster n ON a.id = n.address WHERE n.address IS NULL' + (argv.limit ? ' LIMIT ' + argv.limit : '') + ';'));

                    const bar = new prog('ok - Unmatched Addresses [:bar] :percent :etas', {
                        complete: '=',
                        incomplete: ' ',
                        width: 20,
                        total: argv.limit || res.rows[0].count++
                    });
                    bar.tick(1);

                    return iterate();

                    function iterate() {
                        cursor.read(cursor_it, (err, rows) => {
                            if (err) return cb(err);

                            if (!rows.length) {
                                return diffName();
                            }

                            for (let row of rows) {
                                row.geom = JSON.parse(row.geom);

                                for (let addr of row.geom.coordinates) {
                                    if (addr[2] % 1 != 0 && meta.units) {
                                        let unit = parseInt(String(addr[2]).split('.')[1]);
                                        let num = String(addr[2]).split('.')[0];

                                        addr[2] = `${num}${meta.units[unit]}`;
                                    }

                                    stats.total++;
                                    stats.fail++;
                                    errOut.write(`NOT MATCHED TO NETWORK|${addr[2]} ${row._text}|${addr[0]},${addr[1]}\n`);
                                }
                            }

                            bar.tick(cursor_it);
                            setImmediate(iterate);
                        });
                    }

                });
            }

            function diffName() {
                console.error('ok - beginning diff name');
                client.query('SELECT count(*) FROM address_cluster a LEFT JOIN network_cluster n ON a.id = n.address WHERE n.address IS NOT NULL AND n._text != a._text;', (err, res) => {
                    if (err) return cb(err);

                    const cursor = client.query(new Cursor('SELECT a._text AS atext, n._text AS ntext, ST_AsGeoJSON(a.geom) AS geom FROM address_cluster a LEFT JOIN network_cluster n ON a.id = n.address WHERE n.address IS NOT NULL AND n._text != a._text' + (argv.limit ? ' LIMIT ' + argv.limit : '') + ';'));

                    const bar = new prog('ok - Name Mismatch [:bar] :percent :etas', {
                        complete: '=',
                        incomplete: ' ',
                        width: 20,
                        total: argv.limit || res.rows[0].count++
                    });
                    bar.tick(1);

                    return iterate();

                    function iterate() {
                        cursor.read(cursor_it, (err, rows) => {
                            if (err) return cb(err);

                            if (!rows.length) {
                                pg_done();
                                console.error(`ok - ${stats.fail}/${stats.total} failed to geocode`);
                                return cb();
                            }

                            for (let row of rows) {
                                row.geom = JSON.parse(row.geom);

                                for (let addr of row.geom.coordinates) {
                                    if (addr[2] % 1 != 0 && meta.units) {
                                        let unit = parseInt(String(addr[2]).split('.')[1]);
                                        let num = String(addr[2]).split('.')[0];

                                        addr[2] = `${num}${meta.units[unit]}`;
                                    }

                                    stats.total++;
                                    stats.fail++;
                                    errOut.write(`NAME MISMATCH: Network: ${row.ntext} vs: |${addr[2]} ${row.atext}|${addr[0]},${addr[1]}\n`);
                                }
                            }

                            bar.tick(cursor_it);
                            setImmediate(iterate);
                        });
                    }

                });
            }
        });
    });
}

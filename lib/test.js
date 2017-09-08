module.exports = test;

const pg = require('pg');
const fs = require('fs');
const path = require('path');
const prog = require('progress');
const turf = require('@turf/turf');
const csv = require('fast-csv');
const Cursor = require('pg-cursor');
const Queue = require('d3-queue').queue;
const diacritics = require('diacritics').remove;
const geocode = require('./geocode');
const tokens = require('@mapbox/geocoder-abbreviations');
const Units = require('./units');
const singularize = require('pluralize').singular;
const metaphone = require('talisman/phonetics/metaphone');

const Index = require('./index');
const tokenize = require('./tokenize').main;

const resultTypeTotals = {};
const units = new Units();

/**
 * Log result of test run to file and update totals
 * @param {Stream} out Output stream to write CSV Line to
 * @param {string} resultType Class of result
 * @param {Object} result Result object to write to file
 */
var logResult = (out, resultType, result) => {
    resultTypeTotals[resultType] = (resultTypeTotals[resultType] || 0) + 1;
    out.write([resultType, result.query||'', result.queryPoint||'', result.networkText||'', result.addressText||'', result.returnedPoint||'', result.distance||'']);
};

/**
 * Use raw addresses to query generated ITP output to check for completeness
 * @param {Object} argv Arguments Param - See help or parsing code for a full list
 * @param {Function} cb Callback in (err, res)
 * @return {Function} cb
 */
function test(argv, cb) {
    if (Array.isArray(argv)) {
        argv = require('minimist')(argv, {
            string: [
                'database',
                'index',
                'output',
                'config',
                'limit',
                'name',
                'dupes'
            ],
            alias: {
                database: 'db',
                output: 'o',
                limit: 'l',
                name: 'n'
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
    if (argv.name) {
        argv.name = argv.name.toLowerCase();
        if (['default', 'strict', 'token', 'off'].indexOf(argv.name) === -1) {
            console.error('--name=(default|strict|token|off)');
            console.error('     default: remove tokens before comparison');
            console.error('     strict : no tokenization');
            console.error('     token  : tokenize before comparison');
            console.error('     off    : do not compare response text');
            process.exit(1);
        }
    } else {
        argv.name = 'default';
    }

    if (argv.limit) argv.limit = parseInt(argv.limit);
    argv.dupes = !!argv.dupes;
    let dupeCount = { ungeocodable: 0, duplicative: 0 };

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

    const errOut = fs.createWriteStream(path.resolve(process.cwd(), argv.output), { encoding: 'utf8' });
    const csvOut = csv.createWriteStream({ headers: false });
    csvOut.pipe(errOut);
    logResult = logResult.bind(null, csvOut);

    errOut.write('error,query,query pt,net text,addr text,returned pt,dist (km)\n');

    pool.connect((err, client, pg_done) => {
        index.getMeta(true, (err, meta) => {
            if (err) return cb(err);

            matched();

            /**
             * Iterate over addresses that were successfully matched with a network_cluster
             */
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

                    /**
                     * Use PG Cursor to avoid memory overutilization
                     */
                    function iterate() {
                        cursor.read(cursor_it, (err, rows) => {
                            if (err) return cb(err);

                            if (!rows.length) {
                                return unmatched();
                            }

                            let addrQ = Queue(25);


                            for (let row of rows) {
                                row.geom = JSON.parse(row.geom);

                                // by default, avoid making pointless queries to identical house numbers along the same street
                                // street. these sets of identical house numbers come in two flavors:
                                // - ungeocodable: ones w/ separation >1km. these are not geocoded at all.
                                // - duplicative: sets that are more closely grouped. from these, one is geocoded.
                                // tallies of each type are maintained
                                let coords = row.geom.coordinates;
                                if (!argv.dupes) {
                                    let binnedCoords = row.geom.coordinates.reduce((prev, cur) => {
                                        if (!prev[cur[2]]) prev[cur[2]] = [];
                                        prev[cur[2]].push(cur);
                                        return prev;
                                    }, {});
                                    coords = [];
                                    for (let zCoord in binnedCoords) {
                                        let bin = binnedCoords[zCoord];
                                        if (bin.length === 1) {
                                            coords.push(bin[0]);
                                        }
                                        else {
                                            let allClose = true;
                                            for (let bi = 1; bi < bin.length; bi++) {
                                                if (turf.distance(bin[0], bin[bi]) > 1) {
                                                    allClose = false;
                                                    break;
                                                }
                                            }
                                            if (allClose) {
                                                coords.push(bin[0]);
                                                dupeCount.duplicative += (bin.length - 1);
                                            }
                                            else {
                                                dupeCount.ungeocodable += bin.length;
                                            }
                                        }
                                    }

                                }

                                for (let addr of coords) {
                                    addrQ.defer((query, opts, done) => {
                                        stats.total++;
                                        c.geocode(query, opts, (err, res) => {
                                            if (err) return done(err.toString());

                                            let cleanQuery = diacritics(tokenize(query, meta.tokens).join(' '));

                                            if (!res.features.length) {
                                                stats.fail++;
                                                return done(null, ['NO RESULTS', { query: cleanQuery, queryPoint: opts.proximity.join(',')}]);
                                            }

                                            let matched = diacritics(tokenize(res.features[0].place_name, meta.tokens).join(' '));

                                            let dist = false;
                                            if (res.features[0].geometry.type === 'Point') {
                                                dist = turf.distance(res.features[0].geometry.coordinates, opts.proximity, 'kilometers');
                                            }

                                            if (matched !== cleanQuery) {
                                                stats.fail++;
                                                return done(null, ['TEXT', { query: cleanQuery, queryPoint: opts.proximity.join(','), addressText: matched }]);
                                            } else if (dist && dist > 1) {
                                                stats.fail++;
                                                return done(null, ['DIST', { distance: dist.toFixed(2), returnedPoint: res.features[0].geometry.coordinates.join(','), query: query, queryPoint: opts.proximity.join(',') }]);
                                            } else if (dist === false) { //Usually a street level result
                                                stats.fail++;
                                                return done(null, ['DIST', { distance: 'false', queryPoint: opts.proximity.join(',') } ]);
                                            }

                                            return done(null, true);

                                        });
                                    }, `${units.decode(addr[2])} ${row._text}`, {
                                        proximity: [ addr[0], addr[1] ]
                                    });
                                }
                            }

                            addrQ.awaitAll((err, res) => {
                                if (err) return cb(err);

                                for (let r of res) {
                                    if (r === true) continue;
                                    logResult(r[0], r[1]);
                                }

                                bar.tick(cursor_it);
                                setImmediate(iterate);
                            });
                        });
                    }

                });
            }

            /**
             * Iterate over error classes that are present in addresses/networks that were not matched
             */
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

                    /**
                     * Use a PG Cursor to iterate to avoid memory overutilization
                     */
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
                                    logResult('NOT MATCHED TO NETWORK', { addressText: `${addr[2]} ${row._text}`, queryPoint: addr.join(',') });
                                }
                            }

                            bar.tick(cursor_it);
                            setImmediate(iterate);
                        });
                    }

                });
            }

            /**
             * Log all network/address matches that don't share the exact same name
             */
            function diffName() {
                if (argv.name === 'off') {
                    console.error('ok - skipping name comparison');
                    pg_done();
                    return cb();
                }

                console.error('ok - beginning diff name');
                client.query('SELECT count(*) FROM address_cluster a LEFT JOIN network_cluster n ON a.id = n.address WHERE n.address IS NOT NULL AND n._text != a._text;', (err, res) => {
                    if (err) return cb(err);

                    const cursor = client.query(new Cursor('SELECT a._text AS atext, n._text AS ntext, ST_ASGeoJSON(ST_Centroid(a.geom)) AS center FROM address_cluster a LEFT JOIN network_cluster n ON a.id = n.address WHERE n.address IS NOT NULL AND n._text != a._text' + (argv.limit ? ' LIMIT ' + argv.limit : '') + ';'));

                    const bar = new prog('ok - Name Mismatch [:bar] :percent :etas', {
                        complete: '=',
                        incomplete: ' ',
                        width: 20,
                        total: argv.limit || res.rows[0].count++
                    });
                    bar.tick(1);

                    return iterate();

                    /**
                     * Iterate over diffNamed address/network features using PG Cursor to avoid memory issues
                     */
                    function iterate() {
                        cursor.read(cursor_it, (err, rows) => {
                            if (err) return cb(err);

                            if (!rows.length) {
                                pg_done();
                                csvOut.end();
                                let totalCount = Object.keys(resultTypeTotals).reduce((prev, cur) => { return prev + resultTypeTotals[cur]; }, 0);
                                console.error();
                                console.error('ERROR TYPE                   COUNT');
                                console.error('------------------------------------------');
                                let errTypes = Object.keys(resultTypeTotals);
                                errTypes.sort();
                                for (let errType of errTypes) {
                                    process.stderr.write(errType);
                                    for (let i=0; i < 34 - (errType.length + resultTypeTotals[errType].toString().length); i++)
                                        process.stderr.write(' ');
                                    process.stderr.write(resultTypeTotals[errType].toString());
                                    let pct = (100 * resultTypeTotals[errType] / totalCount).toFixed(1).toString();
                                    console.error(` (${pct}%)`);
                                }
                                console.error();
                                console.error(`ok - ${stats.fail}/${stats.total} failed to geocode`);
                                if (!argv.dupes) {
                                    console.error(`ok - skipped ${dupeCount.duplicative} duplicative & proximate house numbers as redundant (these are fine)`);
                                    console.error(`ok - skipped ${dupeCount.ungeocodable} duplicative & distant house numbers as impossible to geocode (these are less fine)`);
                                }
                                return cb();
                            }

                            for (let row of rows) {
                                let ntext = row.ntext;
                                let atext = row.atext;
                                if (['default', 'token'].indexOf(argv.name) !== -1) {
                                    const tokenKey = argv.name === 'default' ? 'tokenless' : 'tokens';
                                    ntext = diacritics(tokenize(ntext, meta.tokens, true)[tokenKey].join(' '));
                                    atext = diacritics(tokenize(atext, meta.tokens, true)[tokenKey].join(' '));

                                    if (ntext === atext) continue;
                                }

                                let normalizedNtext = ntext.split(/\s+/).map(singularize).map(metaphone).join(' ');
                                let normalizedAtext = atext.split(/\s+/).map(singularize).map(metaphone).join(' ');
                                let softMatch = (normalizedNtext === normalizedAtext);

                                stats.total++;
                                stats.fail++;
                                logResult('NAME MISMATCH ' + (softMatch ? '(SOFT)' : '(HARD)'), { networkText: ntext, addressText: `${atext}`, queryPoint: JSON.parse(row.center).coordinates });
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

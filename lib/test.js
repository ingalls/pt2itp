'use strict';

module.exports = test;

const pg = require('pg');
const fs = require('fs');
const path = require('path');
const Prog = require('progress');
const csv = require('fast-csv');
const Cursor = require('pg-cursor');
const queue = require('d3-queue').queue;
const geocode = require('./util/geocode');
const tokens = require('@mapbox/geocoder-abbreviations');
const singularize = require('pluralize').singular;
const metaphone = require('talisman/phonetics/metaphone');

const tokenize = require('./util/tokenize');

const resultTypeTotals = {};

const tokenRegex = tokenize.createGlobalReplacer(tokens().global);

/**
 * Log result of test run to file and update totals
 * @param {Stream} out Output stream to write CSV Line to
 * @param {string} resultType Class of result
 * @param {Object} result Result object to write to file
 */

let logResult = (out, resultType, result) => {
    resultTypeTotals[resultType] = (resultTypeTotals[resultType] || 0) + 1;
    out.write([resultType, result.query || '', result.queryPoint || '', result.networkText || '', result.addressText || '', result.returnedPoint || '', result.distance || '']);
};

/**
 * Throw whatever you want into a debug file!
 * @param {Stream} outStream Output stream to write to
 * @param {string} debugTag Class of debug message for easy grepping
 * @param {Object} debugObject Any object, which will be JSON.stringify'd
 */
let debug = (outStream, debugTag, debugObject) => {
    const debugMessage = `#${debugTag}\n${JSON.stringify(debugObject, null, ' ')}`;
    outStream.write(debugMessage);
};

/**
 * Use raw addresses to query generated ITP output to check for completeness
 * @param {Object} argv Arguments Param - See help or parsing code for a full list
 * @param {Function} cb Callback in (err, res)
 */
function test(argv, cb) {
    if (Array.isArray(argv)) {
        argv = require('minimist')(argv, {
            string: [
                'database',
                'languages',
                'index',
                'output',
                'config',
                'limit',
                'name',
                'skip',
                'debug'
            ],
            boolean: [
                'test-ephermal'
            ],
            alias: {
                database: 'db',
                output: 'o',
                limit: 'l',
                name: 'n',
                languages: 'language'
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

    if (!argv.languages) {
        argv.languages = [];
    } else if (typeof argv.languages === 'string') {
        argv.languages = argv.languages.split(',');
    }
    const tokens = tokenize.createReplacer(argv.languages);

    let debugPath = '/dev/null';

    if (argv.debug) {
        debugPath = path.resolve(process.cwd(), argv.debug);
    }

    const debugOut = fs.createWriteStream(debugPath, { encoding: 'utf8' });
    debug = debug.bind(null, debugOut);

    if (argv.skip) {
        argv.skip = argv.skip.split(',');
    } else {
        argv.skip = [];
    }

    if (argv.limit) argv.limit = parseInt(argv.limit);
    const limitClause = (argv.limit ? ' LIMIT ' + argv.limit : '');

    const pool = new pg.Pool({
        max: 10,
        user: 'postgres',
        database: argv.db,
        idleTimeoutMillis: 30000
    });

    const opts = {
        getInfo: require(path.resolve(argv.config)),
        index: argv.index
    };

    const c = geocode(opts);

    const stats = {
        fail: 0,
        total: 0,
        itp: {
            fail: 0,
            total: 0
        },
        dists: {}
    };

    const cursor_it = 5; // Number of rows to grab at a time from postgres;

    const errOut = fs.createWriteStream(path.resolve(process.cwd(), argv.output), { encoding: 'utf8' });

    const csvOut = csv.format({ headers: false });
    csvOut.pipe(errOut);
    logResult = logResult.bind(null, csvOut);

    errOut.write('error,query,query pt,net text,addr text,returned pt,dist (km)\n');

    pool.connect((err, client, pg_done) => {
        matched();

        /**
         * Iterate over addresses that were successfully matched with a network_cluster
         * @return {undefined}
         */
        function matched() {
            if (argv.skip.indexOf('matched') !== -1) {
                console.error('ok - skipping match');
                return unmatched();
            }
            console.error('ok - beginning match');
            client.query(`SELECT count(*) FROM address WHERE netid IS NOT NULL ${limitClause}`, (err, res) => {
                if (err) return cb(err);

                const cursor = client.query(new Cursor(`SELECT a.names AS name, ST_AsGeoJSON(a.geom) AS geom, a.number FROM address a WHERE netid IS NOT NULL ${limitClause} ;`));

                const bar = new Prog('ok - Testing Network Matched Addresses [:bar] :percent :etas', {
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
                    cursor.read(cursor_it * 100, (err, rows) => {
                        if (err) return cb(err);

                        if (!rows.length) {
                            return unmatched();
                        }

                        const addrQ = queue(25);


                        for (const row of rows) {
                            row.geom = JSON.parse(row.geom);

                            const coords = row.geom.coordinates;

                            if (!argv['test-ephemeral']) {
                                if (coords[2] < 0) continue;
                            }

                            addrQ.defer((query, opts, done) => {
                                stats.total++;
                                c.geocode(query, opts, (err, res) => {
                                    if (err) return done(err.toString());

                                    geocode.isPass(query, opts.proximity, res, {
                                        tokens: tokens,
                                        stats: stats
                                    }, done);
                                });
                            }, `${row.number} ${row.name[0].display}`, {
                                proximity: [coords[0], coords[1]],
                                autocomplete: false
                            });
                        }

                        addrQ.awaitAll((err, res) => {
                            if (err) return cb(err);

                            for (const r of res) {
                                if (r === true || r === undefined) continue;
                                logResult(r[0], r[1]);
                            }

                            bar.tick(cursor_it * 100);
                            setImmediate(iterate);
                        });
                    });
                }

            });
        }

        /**
         * Iterate over error classes that are present in addresses/networks that were not matched
         * @return {undefined}
         */
        function unmatched() {
            if (argv.skip.indexOf('unmatched') !== -1) {
                console.error('ok - skipping unmatch');
                return diffName();
            }
            console.error('ok - beginning unmatch');
            client.query(`SELECT count(*) FROM address_orphan_cluster a ${limitClause}`, (err, res) => {
                if (err) return cb(err);

                const cursor = client.query(new Cursor(`SELECT a.names AS name, ST_AsGeoJSON(ST_PointOnSurface(a.geom)) AS geom FROM address_orphan_cluster a ${limitClause} ;`));

                const bar = new Prog('ok - Unmatched Addresses [:bar] :percent :etas', {
                    complete: '=',
                    incomplete: ' ',
                    width: 20,
                    total: argv.limit || res.rows[0].count++
                });
                bar.tick(1);

                return iterate();

                /**
                 * Use a PG Cursor to iterate to avoid memory overutilization
                 * @return {undefined}
                 */
                function iterate() {
                    cursor.read(cursor_it, (err, rows) => {
                        if (err) return cb(err);

                        if (!rows.length) return diffName();

                        for (const row of rows) {
                            stats.total++;
                            logResult('NOT MATCHED TO NETWORK', { addressText: row.name[0].display, queryPoint: JSON.parse(row.geom).coordinates });
                        }

                        bar.tick(cursor_it);
                        setImmediate(iterate);
                    });
                }

            });
        }

        /**
         * Log all network/address matches that don't share the exact same name
         * @return {undefined}
         */
        function diffName() {
            if (argv.name === 'off' || argv.skip.indexOf('diffName') !== -1) {
                console.error('ok - skipping name comparison');
                pg_done();
                return cb();
            }

            console.error('ok - beginning diff name');
            client.query(`
                SELECT count(*) FROM address;
            `, (err, res) => {
                if (err) return cb(err);

                const totalAddresses = argv.limit || parseInt(res.rows[0].count);

                const cursor = client.query(new Cursor(`
                    SELECT
                        r.id,
                        r.a_name AS a_name,
                        r.n_name AS n_name,
                        r.center
                    FROM (
                        SELECT
                            id,
                            ARRAY_AGG(a_name) AS a_name,
                            ARRAY_AGG(n_name) AS n_name,
                            MAX(center) AS center
                        FROM (
                            SELECT
                                a.id AS id,
                                jsonb_array_elements(a.names) ->> 'display' AS a_name,
                                jsonb_array_elements(n.names) ->> 'display' AS n_name,
                                ST_ASGeoJSON(ST_Centroid(a.geom)) AS center
                            FROM
                                address a
                                LEFT JOIN network_cluster n
                                    ON a.netid = n.id
                            WHERE
                                a.netid IS NOT NULL
                        ) j
                        GROUP BY id
                    ) r
                    WHERE
                        NOT n_name && a_name
                    ${limitClause};`)
                );

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

                            const totalErrors = Object.keys(resultTypeTotals).reduce((prev, cur) => { return prev + resultTypeTotals[cur]; }, 0);

                            console.error();
                            console.error('ERROR TYPE                   COUNT');
                            console.error('-----------------------------------------------------------------------------------');

                            const errTypes = Object.keys(resultTypeTotals);
                            errTypes.sort();

                            for (const errType of errTypes) {
                                process.stderr.write(errType);

                                for (let i = 0; i < 34 - (errType.length + resultTypeTotals[errType].toString().length); i++) process.stderr.write(' ');

                                process.stderr.write(resultTypeTotals[errType].toString());

                                const pctOfErrors = (100 * resultTypeTotals[errType] / totalErrors).toFixed(1).toString();
                                const pctOfTotal = (100 * resultTypeTotals[errType] / totalAddresses).toFixed(1).toString();

                                console.error(` (${Array(4 - pctOfErrors.length + 1).join(' ')} ${pctOfErrors}% of errors |${Array(4 - pctOfTotal.length + 1).join(' ')} ${pctOfTotal}% of total addresses)`);
                            }

                            console.error();
                            console.error(`ok - ${stats.fail}/${totalAddresses} (${(100 * stats.fail / totalAddresses).toFixed(1).toString()}%) failed to geocode`);
                            console.error(`ok - ${stats.itp.fail}/${stats.itp.total} (${(100 * stats.itp.fail / stats.itp.total).toFixed(1).toString()}%) ITP results failed to geocode`);

                            if (stats.dists) {
                                console.error();
                                console.error('DIST statistical breakdown');
                                console.error('-----------------------------------------------------------------------------------');
                                geocode.distReport(stats);
                            }

                            return cb();
                        }

                        for (const row of rows) {
                            let soft_mismatch = false;
                            let hard_mismatch = false;

                            for (let ntext of row.n_name) {
                                for (let atext of row.a_name) {

                                    if (['default', 'token'].indexOf(argv.name) !== -1) {
                                        const tokenKey = argv.name === 'default' ? 'tokenless' : 'tokens';
                                        ntext = tokenize.main(tokenize.replaceToken(tokenRegex, ntext), tokens, true)[tokenKey].join(' ');
                                        atext = tokenize.main(tokenize.replaceToken(tokenRegex, atext), tokens, true)[tokenKey].join(' ');
                                    }

                                    if (!hard_mismatch && ntext !== atext) hard_mismatch = { n: ntext, a: atext };

                                    const nfuzzed = ntext.split(/\s+/).map(singularize).map(metaphone).join('');
                                    const afuzzed = atext.split(/\s+/).map(singularize).map(metaphone).join('');

                                    if (!soft_mismatch && nfuzzed !== afuzzed) soft_mismatch = { n: ntext, a: atext };
                                }
                            }

                            if (hard_mismatch && !soft_mismatch) {
                                logResult('NAME MISMATCH (SOFT)', { networkText: hard_mismatch.n, addressText: hard_mismatch.a, queryPoint: JSON.parse(row.center).coordinates });
                                stats.total++;
                            } else if (hard_mismatch) {
                                logResult('NAME MISMATCH (HARD)', { networkText: hard_mismatch.n, addressText: hard_mismatch.a, queryPoint: JSON.parse(row.center).coordinates });
                                stats.total++;
                            }
                        }

                        setImmediate(iterate);
                    });
                }
            });
        }
    });
}

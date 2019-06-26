'use strict';

module.exports = test;

const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const geocode = require('./util/geocode');
const Q = require('d3-queue').queue;
const diacritics = require('diacritics').remove;

const resultTypeTotals = {};
const stats = {
    fail: 0,
    total: 0,
    itp: {
        fail: 0,
        total: 0
    },
    dists: {}
};

/**
 * Log result of test run to file and update totals
 * @name logResult
 * @param {Stream} out Output stream to write CSV Line to
 * @param {string} resultType Class of result
 * @param {Object} result Result object to write to file
 */
let logResult = (out, resultType, result) => {
    resultTypeTotals[resultType] = (resultTypeTotals[resultType] || 0) + 1;
    out.write([resultType, result.query || '', result.queryPoint || '', result.networkText || '', result.addressText || '', result.returnedPoint || '', result.distance || '']);
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
                'index',
                'output',
                'config',
                'input'
            ],
            alias: {
                output: 'o',
                input: 'i'
            }
        });
    }

    if (!argv.output) {
        console.error('--output=<output.errors> argument required');
        process.exit(1);
    } else if (!argv.output) {
        console.error('--input=<input.csv> argument required');
        process.exit(1);
    } else if (!argv.index) {
        console.error('--index=<INDEX.mbtiles> argument required');
        process.exit(1);
    } else if (!argv.config) {
        console.error('--config=<CONFIG.json> argument required');
        process.exit(1);
    }

    const errOut = fs.createWriteStream(path.resolve(process.cwd(), argv.output), { encoding: 'utf8' });
    const csvOut = csv.format({ headers: false });
    csvOut.pipe(errOut);
    logResult = logResult.bind(null, csvOut);
    errOut.write('error,query,query pt,net text,addr text,returned pt,dist (km)\n');

    const carmencnf = {
        getInfo: require(path.resolve(argv.config)),
        index: argv.index
    };

    const tokens_raw = carmencnf.getInfo.metadata ? carmencnf.getInfo.metadata.geocoder_tokens : carmencnf.getInfo.geocoder_tokens;
    const tokens = {};

    for (const token in tokens_raw) {
        const value = tokens_raw[token];
        let value_string;
        if (typeof value == 'object') {
            value_string = value['text'];
        }
        else if (typeof value == 'string') {
            value_string = value;
        } else {
            throw new Error(`not ok - testcsv doesn't know how to handle geocoder_tokens mapping: { "${token}": ${JSON.stringify(value)} }`);
        }
        tokens[diacritics(token.toLowerCase())] = diacritics(value_string.toLowerCase());
    }

    const c = geocode(carmencnf);

    let buffer = [];

    /**
     * Test for numeric-ness
     * @param {Object} n potential number
     * @return {boolean} isnumber
     */
    function isNumber(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }

    c.on('open', () => {
        const input = fs.createReadStream(path.resolve(process.cwd(), argv.input));

        const csvStream = csv.parseStream(input, {
            objectMode: true,
            headers: false
        });

        csvStream.on('data', (data) => {
            if (!isNumber(data[0]) || !isNumber(data[1])) return; // don't process rows with bad coords
            if (buffer.length >= 25) {
                csvStream.pause();
                buffer.push(data);
                geocodeBuffer(buffer, () => {
                    buffer = [];
                    csvStream.resume();
                });
            } else {
                buffer.push(data);
            }
        });

        csvStream.on('end', () => {
            if (buffer.length !== 0) {
                geocodeBuffer(buffer, writeStderr);
            } else {
                writeStderr();
            }
        });

        /**
        * Loop through a given buffer and geocode each address with carmen
        * @param {Object} buffer containing <= 25 lines of the input CSV where each
        * line is an address
        * @param {Function} callback
        * @return {Function} cb
        */
        function geocodeBuffer(buffer, callback) {
            const addrQ = new Q();

            for (const entry of buffer) {
                addrQ.defer((lon, lat, query, done) => {
                    stats.total++;
                    c.geocode(query, {
                        proximity: [lon, lat],
                        autocomplete: false
                    }, (err, res) => {
                        geocode.isPass(query, [lon, lat], res, {
                            tokens: tokens,
                            stats: stats
                        }, done);
                    });
                }, Number(entry[0]), Number(entry[1]), entry[2]);
            }

            addrQ.awaitAll((err, res) => {
                if (err) return cb(err);

                for (const r of res) {
                    if (!r) continue;
                    logResult(r[0], r[1]);
                }
                callback();
            });
        }

        /**
         * Write out a summary of the errors for addresses that failed to geocode
         * @return {Function} cb from test function
         */
        function writeStderr() {
            const totalCount = Object.keys(resultTypeTotals).reduce((prev, cur) => { return prev + resultTypeTotals[cur]; }, 0);

            console.error();
            console.error('ERROR TYPE                   COUNT');
            console.error('-----------------------------------------------------------------------------------');

            const errTypes = Object.keys(resultTypeTotals);
            errTypes.sort();

            for (const errType of errTypes) {
                process.stderr.write(errType);

                for (let i = 0; i < 34 - (errType.length + resultTypeTotals[errType].toString().length); i++) process.stderr.write(' ');

                process.stderr.write(resultTypeTotals[errType].toString());

                const pctOfErrors = (100 * resultTypeTotals[errType] / totalCount).toFixed(1).toString();
                const pctOfTotal = (100 * resultTypeTotals[errType] / stats.total).toFixed(1).toString();

                console.error(` (${Array(4 - pctOfErrors.length + 1).join(' ')} ${pctOfErrors}% of errors |${Array(4 - pctOfTotal.length + 1).join(' ')} ${pctOfTotal}% of total addresses)`);
            }

            console.error();
            console.error(`ok - ${stats.fail}/${stats.total} (${(100 * stats.fail / stats.total).toFixed(1).toString()}%) failed to geocode`);
            console.error(`ok - ${stats.itp.fail}/${stats.itp.total} (${(100 * stats.itp.fail / stats.itp.total).toFixed(1).toString()}%) ITP results failed to geocode`);

            if (stats.dists) {
                console.error();
                console.error('DIST statistical breakdown');
                console.error('-----------------------------------------------------------------------------------');
                geocode.distReport(stats);
            }

            return cb();
        }
    });
}

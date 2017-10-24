module.exports = test;

const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');
const csv = require('fast-csv');
const geocode = require('./geocode');
const Q = require('d3-queue').queue;
const tokenize = require('./tokenize');

const resultTypeTotals = {};
const stats = {
    fail: 0,
    total: 0
}

/**
 * Log result of test run to file and update totals
 * @name logResult
 * @param {Stream} out Output stream to write CSV Line to
 * @param {string} resultType Class of result
 * @param {Object} result Result object to write to file
 */
let logResult = (out, resultType, result) => {
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
    const csvOut = csv.createWriteStream({ headers: false });
    csvOut.pipe(errOut);
    logResult = logResult.bind(null, csvOut);
    errOut.write('error,query,query pt,addr text,returned pt,dist (km)\n');

    const carmencnf = {
        getInfo: require(path.resolve(argv.config)),
        index: argv.index
    }

    const tokens_raw = carmencnf.getInfo.metadata.geocoder_tokens;
    const tokens = {};

    for (let token in tokens_raw) {
        tokens[token.toLowerCase()] = tokens_raw[token].toLowerCase();
    }

    const c = geocode(carmencnf);

    let buffer = [];

    c.on('open', () => {
        const input = fs.createReadStream(path.resolve(process.cwd(), argv.input));

        csvStream = csv.fromStream(input, {
            headers: [ "lon", "lat", "address" ],
            objectMode: true,
            headers: false
        });

        csvStream.on('data', (data) => {
            if (buffer.length >= 25) {
                csvStream.pause();
                buffer.push(data);

                let addrQ = new Q();
                for (let entry of buffer) {
                    addrQ.defer((lon, lat, query, done) => {
                        stats.total++;

                        c.geocode(query, {
                            proximity: [ lon, lat ]
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

                    buffer = [];

                    for (let r of res) {
                        if (!r) continue;

                        logResult(r[0], r[1]);
                    }

                    csvStream.resume();
                });
            } else {
                buffer.push(data);
            }
        });

        csvStream.on('end', () => {
             let totalCount = Object.keys(resultTypeTotals).reduce((prev, cur) => { return prev + resultTypeTotals[cur]; }, 0);

            console.error();
            console.error('ERROR TYPE                   COUNT');
            console.error('-----------------------------------------------------------------------------------');

            let errTypes = Object.keys(resultTypeTotals);
            errTypes.sort();

            for (let errType of errTypes) {
                process.stderr.write(errType);

                for (let i=0; i < 34 - (errType.length + resultTypeTotals[errType].toString().length); i++) process.stderr.write(' ');

                process.stderr.write(resultTypeTotals[errType].toString());

                let pctOfErrors = (100 * resultTypeTotals[errType] / totalCount).toFixed(1).toString();
                let pctOfTotal = (100 * resultTypeTotals[errType] / stats.total).toFixed(1).toString();

                console.error(` (${Array(4 - pctOfErrors.length + 1).join(' ')} ${pctOfErrors}% of errors |${Array(4 - pctOfTotal.length + 1).join(' ')} ${pctOfTotal}% of total addresses)`);
            }

            console.error();
            console.error(`ok - ${stats.fail}/${stats.total} (${(100 * stats.fail / stats.total).toFixed(1).toString()}%) failed to geocode`);

            return cb();
        });
    });
}

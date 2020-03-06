'use strict';

const fs = require('fs');
const readline = require('readline');
const pg = require('pg');
const path = require('path');
const Queue = require('d3-queue').queue;
const csv = require('fast-csv');
const collocation = require('./analyze/collocation.js');
const copyFrom = require('pg-copy-streams').from;
const { tokenize_name } = require('../native/index.node');
const Context = require('./util/context');
const copyTo = require('pg-copy-streams').to;
const BiGramCollocationTable = collocation.BiGramCollocationTable;

let matchedTokens = 0;
let totalTokens = 0;

/**
 * This module analyzes the 'name' fields of address and network data. It
 * can load data from either the database, or a geojson file.
 *
 * The output is a CSV file with statistics on the frequency distribution of each token in that
 * data. Those statistics will be useful for surfacing important patterns in
 * street names and spotting potential near-misses when matching address and
 * network entries.
 *
 * Generally speaking, this command should be run three times per country. Once
 * for network, once for address, and then once for the comparison. eg:
 *
 *     ./index.js analyze --cc fr --source /path/to/file.geojson --output /tmp/fr.text-analysis/address
 *     ./index.js analyze --cc us_ia --type address --output=/tmp/us_ia.text-analysis/address
 *     ./index.js analyze --cc us_ia --type network --output=/tmp/us_ia.text-analysis/network
 *     ./index.js analyze --cc us_ia --compare true --output=/tmp/us_ia.text-analysis/comparison
 *
 * For each run with compare mode off, a markdown based summary will be generated to
 * summarize the results.
 *
 * @param {Object} argv - command line arguments passed when calling `pt2itp analyze`
 * @param {string} argv.cc - country code with optional region code (eg. `es` or `us ny`)
 * @param {string} argv.type - one of "network" or "address"
 * @param {string} argv.source - path to geojson file to load names from
 * @param {boolean} argv.compare - when true, run a comparison analysis
 * @param {number} argv.limit - limit analysis to just this many text values
 * @param {string} argv.output - the file path prefix to be used when writing CSV outputs
 * @param {function} callback - callback function to surface any thrown errors
 */
function analyze(argv, callback) {
    if (Array.isArray(argv)) {
        argv = require('minimist')(argv, {
            string: [
                'cc',
                'type',
                'source',
                'limit',
                'output'
            ],
            boolean: [
                'compare'
            ],
            default: {
                'compare': false
            }
        });
    }
    if (!argv.cc) {
        console.error('--cc=<country code> argument required');
        process.exit(1);
    }
    // note: you can limit results/rows with --limit <number>
    if (argv.limit) {
        argv.limit = parseInt(argv.limit);
    }

    const cc = argv.cc;
    let database;

    const country = cc.split('_')[0];
    if (cc.indexOf('_') > -1) {
        const region = cc.split('_')[1];
        database = `mbpl_${country}_${region}_address_both`;
    } else if (cc === 'test') {
        database = 'pt_test';
    } else {
        database = `mbpl_${country}_address_both`;
    }

    const pool = new pg.Pool({
        max: 1,
        user: 'postgres',
        database: database,
        idleTimeoutMillis: 30
    });

    if (argv.compare) {
        compareAddressAndNetwork(argv, pool, (err) => {
            if (err) callback(err);
            pool.end((err) => {
                if (err) callback(err);
                callback(null);
            });
        });
    } else {
        buildCollocationTables(argv, pool, (err) =>{
            if (err) callback(err);
            pool.end((err) => {
                if (err) callback(err);
                generateMarkdownSummary(cc, argv.output);
                callback(null);
            });
        });
    }
}


/**
 * Builds the bigram and unigram tables for a given country and type.
 *
 * @param {Object} argv - CLI arguments, parsed into an object
 * @param {Pool} pool - A pg connection pool
 * @param {function} cb - done
 */
function buildCollocationTables(argv, pool, cb) {
    const { type, limit, source, cc } = argv;
    if (!argv.output) {
        console.error('--output=<output file location> argument required');
        process.exit(1);
    }

    extractTextField(type, limit, source, pool, (err, text) => {
        if (err) cb(err);
        frequencyDistributionMunger(text, cc, (err, bigrams) => {
            if (err) cb(err);

            const popQ = new Queue(1);

            popQ.defer((done) => {
                pool.query(`
                    BEGIN;
                    DROP TABLE IF EXISTS ${type}_unigrams;
                    CREATE TABLE ${type}_unigrams (
                        word VARCHAR NOT NULL,
                        frequency INTEGER,
                        relative_frequency DOUBLE PRECISION
                    );

                    DROP TABLE IF EXISTS ${type}_bigrams;
                    CREATE TABLE ${type}_bigrams (
                        w1 VARCHAR NOT NULL,
                        w2 VARCHAR NOT NULL,
                        frequency INTEGER,
                        likelihood_ratio DOUBLE PRECISION
                    );

                    COMMIT;
                    `,
                (err) => {
                    return done(err);
                }
                );
            });

            popQ.defer((done) => {
                writeUnigram(argv, pool, bigrams, (err) => {
                    return done(err);
                });
            });

            popQ.defer((done) => {
                writeBigram(argv, pool, bigrams, (err) => {
                    return done(err);
                });
            });

            popQ.defer((done) => {
                pool.query(`
                    BEGIN;
                    CREATE INDEX ON ${type}_unigrams (word);
                    CREATE INDEX ON ${type}_bigrams (w1, w2);
                    COMMIT;
                    `, (err) => {
                    return done(err);
                }
                );
            });

            popQ.await((err) => {
                return cb(err);
            });
        });
    });

}

/**
 * Writes unigram frequencies to CSV and also to a table in the database
 *
 * @param {Object} argv - arguments from the command line
 * @param {Pool} pool - postgres connection pool
 * @param {BiGramCollocationTable} bigrams - a collocation table of order 2 (bigram)
 * @param {function} cb - callback
 */
function writeUnigram(argv, pool, bigrams, cb) {
    const unigramOutput = path.resolve(argv.output) + '-unigram.csv';
    const unigramCSVStream = csv.format({ headers: true });
    const unigramWriteStream = fs.createWriteStream(unigramOutput, { encoding: 'utf8' });
    unigramWriteStream.on('error', (err) => {
        cb(err);
    });
    unigramWriteStream.on('finish', () => {
        cb(null);
    });

    unigramCSVStream.pipe(unigramWriteStream);

    const unigramN = bigrams.unigram_fd.n();

    const unigrams = [...bigrams.unigram_fd.entries()].sort((a, b) => b[1] - a[1]);
    for (const [word, frequency] of unigrams) {
        const relativeFrequency = frequency / unigramN;
        unigramCSVStream.write(
            { 'word': word,'frequency': frequency, 'relative_frequency': relativeFrequency },
            { 'headers': true }
        );
    }

    unigramCSVStream.end(null, 'utf8', () => {
        pool.connect((err, client, release) => {
            if (err) cb(err);
            const queryString = `COPY ${argv.type}_unigrams from STDIN CSV HEADER`;
            const copyStream = client.query(copyFrom(queryString));
            const readStream = fs.createReadStream(unigramOutput, { encoding: 'utf8' });
            readStream.on('error', cb);
            copyStream.on('error', (err) =>{
                release();
                cb(err);
            });
            copyStream.on('end', (err) => {
                if (err) cb(err);
                release();
                cb(null);
            });
            readStream.pipe(copyStream);
        });
    });
}

/**
 * Writes bigram frequencies and likelihoods to CSV and also to a table in the database
 *
 * @param {Object} argv - arguments from the command line
 * @param {Pool} pool - postgres connection pool
 * @param {BiGramCollocationTable} bigrams - a collocation table of order 2 (bigram)
 * @param {function} cb - callback
 */
function writeBigram(argv, pool, bigrams, cb) {
    const bigramOutput = path.resolve(argv.output) + '-bigram.csv';
    const bigramCSVStream = csv.format({ headers: true });
    const bigramWriteStream = fs.createWriteStream(bigramOutput, { encoding: 'utf8' });
    bigramCSVStream.pipe(bigramWriteStream);

    const bigramsSorted = [];
    for (const score of bigrams.score_ngrams('likelihoodRatio')) {
        bigramsSorted.push(score);
    }
    bigramsSorted.sort((a, b) => b.frequency - a.frequency);

    for (const bigram of bigramsSorted) {
        bigramCSVStream.write(bigram, { headers: true });
    }

    bigramCSVStream.end(null, 'utf8', () => {
        pool.connect((err, client, release) => {
            if (err) cb(err);
            const queryString = `COPY ${argv.type}_bigrams from STDIN CSV HEADER`;
            const copyStream = client.query(copyFrom(queryString));
            const readStream = fs.createReadStream(bigramOutput, { encoding: 'utf8' });
            readStream.on('error', cb);
            copyStream.on('error', (err) =>{
                release();
                cb(err);
            });
            copyStream.on('end', (err) => {
                if (err) cb(err);
                release();
                cb(null);
            });
            readStream.pipe(copyStream);
        });
    });
}

/**
 * Delegates the retrieval of the list of names fields from either the
 * database, or a flat file.
 *
 * @param {String} type - one of "network" or "address"
 * @param {Number} limit - for dev/testing purposes, limit to this many rows
 * @param {String} source - path to geojson file
 * @param {Pool} pool - postgres pool object, connected to the database
 * @param {Function} callback - callback function
 * @returns {void}
 */
function extractTextField(type, limit, source, pool, callback) {
    if (source) {
        return extractNameFromFile(source, limit, callback);
    } else {
        return extractNameFromDb(type, limit, pool, callback);
    }
}

/**
 * This method queries the appropriate table in the postgres database, returns
 * the name field for each row, passes each value through {@link formatData},
 * and calls callback on an array of the results.
 *
 * @param {String} type - one of "network" or "address"
 * @param {Number} limit - for dev/testing purposes, limit to this many rows
 * @param {Pool} pool - postgres pool object, connected to the database
 * @param {Function} callback - callback function
 */
function extractNameFromDb(type, limit, pool, callback) {
    if (!type) {
        console.error('--type=<type> argument required');
        process.exit(1);
    }
    const table = (type === 'address') ? 'address_cluster' : 'network_cluster';
    const limitClause = limit ? ' LIMIT ' + limit : '';

    pool.query('SELECT names AS name FROM ' + table + limitClause + ';', (err, data) => {
        if (err) {
            pool.end();
            return callback(err);
        }
        const textFields = formatData(data.rows);
        return callback(null, textFields);
    });
}

/**
 * Reads in a line-delimited geojson file and populates an array with the contents
 * of all street name values.
 *
 * @param {String} source - path to geojson file
 * @param {Number} limit - for dev/testing purposes, limit to this many rows
 * @param {Function} cb - callback function
 */
function extractNameFromFile(source, limit, cb) {
    const stream = fs.createReadStream(path.resolve(__dirname, source));
    const rl = readline.createInterface({
        input: stream
    });

    const textFields = [];
    rl.on('line', (line) => {
        if (!line) return;
        if (textFields.length >= limit) rl.close();
        const feat = JSON.parse(line);
        if (feat && feat.properties.street) {
            feat.properties.street.forEach((street) => textFields.push(street.display));
        }
    });
    rl.on('close', () => cb(null, textFields));
    rl.on('error', (err) => cb(err));
}

/**
 * This function formats each result
 *
 * @param {Array<any>} data - an array of rows from a sql query result
 * @returns {Array<string>} an array of formatted name fields
 */
function formatData(data) {
    const results = [];

    if (!data.length) return [];

    data.forEach((d) => {
        if (!d.name || !d.name.length) return;
        d.name.forEach((name) => {
            return results.push(name.display);
        });
    });

    return results;
}

/**
 * This function tokenizes each text value and uses the token arrays to update
 * a {@link BiGramCollocationTable}. Then it returns an array of scored ngrams.
 *
 * @param {Array<string>} textfields - An array of _text values
 * @param {function} callback - callback function
 */
function frequencyDistributionMunger(textfields, cc, callback) {
    const bigrams = new BiGramCollocationTable();
    const context = new Context({ country: cc });

    for (const textField in textfields) {
        const tokenized = tokenize_name(textfields[textField], context);
        tokenized.forEach((t) => {
            if (t.token_type) matchedTokens++;
            totalTokens++;
        });
        bigrams.update(tokenized.map((t) => t.token));
    }
    return callback(null, bigrams);
}

/**
 * After the collocation tables have been built for network and address data,
 * this function can be called to compare the two
 *
 * @param {Object} argv - CLI arguments, parsed into an object
 * @param {Pool} pool - A pg connection Pool
 * @param {function} callback - callback
 */
function compareAddressAndNetwork(argv, pool, callback) {

    const outputPrefix = path.resolve(argv.output);

    const popQ = new Queue(1);

    popQ.defer((done) => {
        pool.query(`
            BEGIN;

            DROP TABLE IF EXISTS bigram_side_by_side;

            CREATE TABLE bigram_side_by_side AS
                SELECT
                    n.w1 AS network_w1,
                    n.w2 AS network_w2,
                    n.frequency AS network_frequency,
                    n.likelihood_ratio AS network_likelihood_ratio,
                    a.w1 AS address_w1,
                    a.w2 AS address_w2,
                    a.frequency AS address_frequency,
                    a.likelihood_ratio AS address_likelihood_ratio,
                    COALESCE(n.frequency,0) - COALESCE(a.frequency,0) AS frequency_diff,
                    COALESCE(n.likelihood_ratio,0) - COALESCE(a.likelihood_ratio,0) AS likelihood_ratio_diff
                FROM
                    network_bigrams n
                        FULL OUTER JOIN
                    address_bigrams a ON n.w1 = a.w1 AND n.w2 = a.w2;
            COMMIT;`,
        (err) => {
            if (err) {
                pool.end();
                return callback(err);
            }
            done();
        }
        );
    });

    popQ.defer((done) => {
        pool.query(`
            BEGIN;

            DROP TABLE IF EXISTS bigram_comparison;

            CREATE TABLE bigram_comparison AS
                SELECT
                    COALESCE(bc.network_w1, bc.address_w1) as w1,
                    COALESCE(bc.network_w2, bc.address_w2) as w2,
                    bc.network_frequency,
                    bc.network_likelihood_ratio,
                    bc.address_frequency,
                    bc.address_likelihood_ratio,
                    bc.frequency_diff,
                    bc.likelihood_ratio_diff,
                    (bc.likelihood_ratio_diff - ss.avg_lrd) / ss.stddev_lrd AS zscore
                FROM
                    bigram_side_by_side AS bc
                        CROSS JOIN
                    (SELECT
                        AVG(likelihood_ratio_diff) AS avg_lrd,
                        GREATEST(STDDEV(likelihood_ratio_diff), 1) AS stddev_lrd
                     FROM
                        bigram_side_by_side) AS ss;
            COMMIT;`,
        (err) => {
            if (err) {
                pool.end();
                return callback(err);
            }
            done();
        }
        );
    });

    popQ.defer((done) => {
        pool.query(`
            BEGIN;

            DROP TABLE IF EXISTS significant_network_bigrams;

            CREATE TABLE significant_network_bigrams AS
                SELECT
                    w1,
                    w2,
                    network_frequency,
                    zscore
                FROM
                    bigram_comparison
                WHERE
                    zscore > 1
                ORDER BY
                    zscore DESC, w1, w2;

            DROP TABLE IF EXISTS significant_address_bigrams;

            CREATE TABLE significant_address_bigrams AS
                SELECT
                    w1,
                    w2,
                    address_frequency,
                    zscore
                FROM
                    bigram_comparison
                WHERE
                    zscore < -1
                ORDER BY
                    zscore, w1, w2;
            COMMIT;`,
        (err) => {
            if (err) {
                pool.end();
                return callback(err);
            }
            done();
        }
        );
    });

    popQ.defer((done) => {
        pool.query(`
            BEGIN;

            DROP TABLE IF EXISTS unigram_side_by_side;

            CREATE TABLE unigram_side_by_side AS
                SELECT
                    n.word as network_word,
                    n.frequency AS network_frequency,
                    n.relative_frequency AS network_relative_frequency,
                    a.word AS address_word,
                    a.frequency AS address_frequency,
                    a.relative_frequency AS address_relative_frequency,
                    COALESCE(n.frequency, 0) - COALESCE(a.frequency, 0) AS frequency_diff,
                    COALESCE(n.relative_frequency, 0) - COALESCE(a.relative_frequency, 0) AS relative_frequency_diff
                FROM
                    network_unigrams n
                        FULL OUTER JOIN
                    address_unigrams a USING (word);
            COMMIT;`,
        (err) => {
            if (err) {
                pool.end();
                return callback(err);
            }
            done();
        }
        );
    });

    popQ.defer((done) => {
        pool.query(`
            BEGIN;

            DROP TABLE IF EXISTS unigram_comparison;

            CREATE TABLE unigram_comparison AS
                SELECT
                    COALESCE(network_word, address_word) as word,
                    network_frequency,
                    address_frequency,
                    network_relative_frequency,
                    address_relative_frequency,
                    relative_frequency_diff,
                    (relative_frequency_diff - avg_diff) / stddev_diff as zscore
                FROM
                    unigram_side_by_side uc
                        CROSS JOIN
                    (SELECT
                        AVG(relative_frequency_diff) AS avg_diff,
                        STDDEV(relative_frequency_diff) as stddev_diff
                     FROM
                        unigram_side_by_side) as ss order by zscore;
            COMMIT;`,
        (err) => {
            if (err) {
                pool.end();
                return callback(err);
            }
            done();
        }
        );
    });

    popQ.defer((done) => {
        pool.query(`
            BEGIN;

            DROP TABLE IF EXISTS significant_network_unigrams;

            CREATE TABLE significant_network_unigrams AS
                SELECT
                    word,
                    network_frequency,
                    zscore
                FROM
                    unigram_comparison
                WHERE
                    zscore > 1
                ORDER BY
                    zscore DESC, word;

            DROP TABLE IF EXISTS significant_address_unigrams;

            CREATE TABLE significant_address_unigrams AS
                SELECT
                    word,
                    address_frequency,
                    zscore
                FROM
                    unigram_comparison
                WHERE
                    zscore < -1
                ORDER BY
                    zscore,word;
            COMMIT;`,
        (err) => {
            if (err) {
                pool.end();
                return callback(err);
            }
            done();
        }
        );
    });

    /**
     * Copy the significant ngrams for some type and order to a CSV file
     *
     * @param {string} type - The type of data to be analyzed. Must be either "network" or "address"
     * @param {string} order - The order of the analysis. Must be one of "bigram" or "unigram"
     * @param {function} cb - callback
     */
    function copyOutput(type, order, cb) {
        const outputPath = `${outputPrefix}-${type}-${order}.csv`;
        pool.connect((err, client, release) => {
            const queryString = `COPY significant_${type}_${order}s TO STDOUT CSV HEADER`;
            const copyStream = client.query(copyTo(queryString));
            const writeStream = fs.createWriteStream(outputPath, { encoding: 'utf8' });
            writeStream.on('error', cb);
            copyStream.on('error', (err) => {
                release();
                return cb(err);
            });
            copyStream.on('end', (err) => {
                if (err) cb(err);
            });
            writeStream.on('finish', (err) => {
                if (err) cb(err);
                release();
                return cb(null);
            });
            copyStream.pipe(writeStream);
        });
    }

    popQ.defer(copyOutput, 'address', 'bigram');
    popQ.defer(copyOutput, 'address', 'unigram');
    popQ.defer(copyOutput, 'network', 'bigram');
    popQ.defer(copyOutput, 'network', 'unigram');

    popQ.await((err) => {
        if (err) callback(err);
        return callback(null);
    });
}

function generateMarkdownSummary(cc, output) {
    const bigrams = fs.readFileSync(path.resolve(output) + '-bigram.csv').toString();
    const unigrams = fs.readFileSync(path.resolve(output) + '-unigram.csv').toString();

    const markdown = `## ${cc} token matching\nmatched tokens: ${matchedTokens}\ntotal tokens: ${totalTokens}\n## ${cc} top unigrams\n${generateTable(unigrams)}\n## ${cc} top bigrams\n${generateTable(bigrams)}`;

    fs.writeFileSync(path.resolve(output) + '-summary.md', markdown);
}

function generateTable(csvStr) {
    let tableStr = '';
    csvStr.split('\n').slice(0, 26).forEach((line) => {
        if (tableStr === '') {
            const split = line.split(',');
            tableStr += split.join('|') + '\n';
            split.forEach(() => tableStr += '---|');
            tableStr += '\n';
        } else {
            tableStr = tableStr.concat(line.split(',').join('|') + '\n');
        }
    });
    return tableStr;
}

module.exports = analyze;
module.exports.frequencyDistributionMunger = frequencyDistributionMunger;
module.exports.extractTextField = extractTextField;
module.exports.formatData = formatData;

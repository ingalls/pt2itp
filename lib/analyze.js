const fs = require('fs');
const pg = require('pg');
const path = require('path');
const Queue = require('d3-queue').queue;
const csv = require('fast-csv');
const collocation = require('./analyze/collocation.js');
const tokenize = require('./tokenize.js');
const BiGramCollocationTable = collocation.BiGramCollocationTable;

/**
 * This module analyzes the "_text" fields of address and network data. It
 * assumes they have been loaded into the database already. The output is a CSV
 * file with statistics on the frequency distribution of each token in that
 * data. Those statistics will be useful for surfacing important patterns in
 * street names and spotting potential near-misses when matching address and
 * network entries.
 *
 * Generally speaking, this command should be run three times per country. Once
 * for network, once for address, and then once for the comparison. eg:
 *
 *     pt2itp analyze --cc us_ia --type address --output=/tmp/us_ia.text-analysis/address
 *     pt2itp analyze --cc us_ia --type network --output=/tmp/us_ia.text-analysis/network
 *     pt2itp analyze --cc us_ia --compare true --output=/tmp/us_ia.text-analysis/comparison
 *
 * @param {Object} argv - command line arguments passed when calling `pt2itp analyze`
 * @param {string} argv.cc - country code with optional region code (eg. `es` or `us ny`)
 * @param {string} argv.type - one of "network" or "address"
 * @param {boolean} argv.compare - when true, run a comparison analysis.
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
                'limit',
                'output',
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
    if (argv.limit) {
        argv.limit = parseInt(argv.limit);
    } else {
        console.log('note: you can limit results/rows with --limit <number>');
    }

    let cc = argv.cc;
    let database;

    let country = cc.split('_')[0];
    if (cc.indexOf('_') > -1) {
        let region = cc.split('_')[1];
        database = `mbpl_${country}_${region}_address_both`;
    } else if (cc == 'test') {
        database = 'pt_test';
    } else {
        database = `mbpl_${country}_address_both`;
    }

    const pool = new pg.Pool({
        max: 2,
        user: 'postgres',
        database: database,
        idleTimeoutMillis: 30
    });

    if (argv.compare) {
        compareAddressAndNetwork(argv, pool, (err) => {
            callback(err);
        });
    } else {
        buildCollocationTables(argv, pool, (err) =>{
            callback(err);
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
    if (!argv.type) {
        console.error('--type=<type> argument required');
        process.exit(1);
    } else if (!argv.output) {
        console.error('--output=<output file location> argument required');
        process.exit(1);
    }

    const cc = argv.cc;
    const type = argv.type;
    const limit = argv.limit;



    extractTextField(type, limit, pool, (err, text) => {
        if (err) cb(err);
        frequencyDistributionMunger(text, (err, bigrams) => {
            if (err) cb(err);

            let popQ = new Queue(1);

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
                    (err, res) => {
                        if (err) throw err;
                        return done();
                    }
                );
            });

            popQ.defer((done) => {
                writeUnigram(argv, pool, bigrams, (err) => {
                    if (err) cb(err);
                    return done();
                });
            });

            popQ.defer((done) => {
                writeBigram(argv, pool, bigrams, (err) => {
                    if (err) cb(err);
                    return done();
                });
            });

            popQ.defer((done) => {
                pool.query(`
                    BEGIN;
                    CREATE INDEX ON ${type}_unigrams (word);
                    CREATE INDEX ON ${type}_bigrams (w1, w2);
                    COMMIT;
                    `, (err, res) => {
                        if (err) cb(err);
                        return done();
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
    let unigramOutput = path.resolve(argv.output) + '-unigram.csv';
    let unigramCSVStream = csv.createWriteStream({ headers: true });
    let unigramWriteStream = fs.createWriteStream(unigramOutput, { encoding: 'utf8' });
    unigramWriteStream.on('error', (err) => {
        cb(err, unigramOutput);
    });
    unigramWriteStream.on('finish', () => {
        cb(null, unigramOutput);
    });

    unigramCSVStream.pipe(unigramWriteStream);

    let unigramN = bigrams.unigram_fd.n();
    let popQ = new Queue(1);
    for (let [word, frequency] of bigrams.unigram_fd.entries()) {
        let relativeFrequency = frequency / unigramN;

        // Write the frequency to CSV
        popQ.defer((done) => {
            unigramCSVStream.write(
                {'word': word,'frequency': frequency, 'relative_frequency': relativeFrequency },
                {'headers': true},
                (err) => { return done();}
            );
        });

        // Insert the frequency to table
        popQ.defer((done) => {
            pool.query({
                text: `INSERT INTO ${argv.type}_unigrams(word, frequency, relative_frequency) VALUES($1, $2, $3);`,
                values: [word, frequency, relativeFrequency]
            }, (err, res) => {
                if (err) throw err;
                done();
            });
        });
    }
    popQ.await((err) => {
        cb(err);
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
    let bigramOutput = path.resolve(argv.output) + '-bigram.csv';
    let bigramCSVStream = csv.createWriteStream({ headers: true });
    let bigramWriteStream = fs.createWriteStream(bigramOutput, { encoding: 'utf8' });
    bigramCSVStream.pipe(bigramWriteStream);

    let popQ = new Queue(1);
    for (let score of bigrams.score_ngrams('likelihoodRatio')) {
        // Write the score to CSV
        popQ.defer((done) => {
            bigramCSVStream.write(
                score,
                {headers: true},
                (err) => {return done();}
            );
        });

        // Insert the score to the bigrams table
        popQ.defer((done) => {
            pool.query({
                text: `INSERT INTO ${argv.type}_bigrams(w1, w2, frequency, likelihood_ratio) VALUES($1, $2, $3, $4)`,
                values: [score.w1, score.w2, score.frequency, score.likelihoodRatio]
            }, (err, res) => {
                if (err) throw err;
                done();
            });
        });
    }
    popQ.await((err) => {
        cb(err);
    });

}

/**
 * This method queries the appropriate table in the postgres database, returns
 * the _text field for each row, passes each value through {@link formatData},
 * and calls callback on an array of the results.
 *
 * @param {string} type - one of "network" or "address"
 * @param {numeric} limit - for dev/testing purposes, limit to this many rows
 * @param {Pool} pool - postgres pool object, connected to the database
 * @param {function} callback - callback function
 */
function extractTextField(type, limit, pool, callback) {
    let table;
    let limitClause;

    table = (type == 'address') ? 'address_cluster' : 'network_cluster';
    limitClause = limit ? ' LIMIT ' + limit : '';

    pool.query('SELECT _text FROM '+ table + limitClause +';', (err, data) => {
        if (err) {
            pool.end();
            return callback(err);
        }
        const textFields = formatData(data.rows);
        return callback(null, textFields);
    });
}

/**
 * This function formats each result
 *
 * @param {Array<any>} data - an array of rows from a sql query result
 * @returns {Array<string>} an array of formatted _text fields
 */
function formatData(data) {
    const results = [];
    data.forEach(function(i) {
        if (Array.isArray(i._text)) {
            for (let j of i._text) results.push(j);
        } else {
            results.push(i._text);
        }
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
function frequencyDistributionMunger(textfields, callback) {
    const bigrams = new BiGramCollocationTable();
    let scores;

    for (let textField in textfields) {
        let tokens = tokenize.main(textfields[textField]);
        bigrams.update(tokens);
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

    let popQ = new Queue(1);

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
                    address_bigrams a ON n.w1=a.w1 AND n.w2 = a.w2;
            COMMIT;`,
            (err, res) => {
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
            (err, res) => {
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
            (err, res) => {
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
            (err, res) => {
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
            (err, res) => {
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
            (err, res) => {
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
     * @param {string} outputPath - The file path prefix for the output CSVs
     * @param {function} cb - callback
     */
    function copyOutput(type, order, outputPath, cb) {
        let writeStream = fs.createWriteStream(outputPath, { encoding: 'utf8' });
        let csvStream = csv.createWriteStream({ headers: true });
        csvStream.pipe(writeStream);
        csvStream.on('finish', (err) => {
            cb(err);
        });
        pool.query(`
            SELECT * FROM significant_${type}_${order}s;
            `,
            (err, res) => {
                if (err) {
                    cb(err);
                }
                for (let i=0; i<res.rows.length; i++) {
                    csvStream.write(res.rows[i]);
                    if (i==res.rows.length-1) {
                        csvStream.end();
                    }
                }
            }
        );
    }

    const outputPrefix = path.resolve(argv.output);

    let typeOrderPairs = [
        ['address', 'bigram'],
        ['address', 'unigram'],
        ['network', 'bigram'],
        ['network', 'unigram']
    ];


    for (let i=0; i< typeOrderPairs.length; i++) {
        let [type, order] = typeOrderPairs[i];
        outputPath = `${outputPrefix}-${type}-${order}.csv`;
        popQ.defer(copyOutput, type, order, outputPath);
    }


    popQ.await((err) => {
        callback(err);
    });


}

module.exports = analyze;
module.exports.frequencyDistributionMunger = frequencyDistributionMunger;
module.exports.extractTextField = extractTextField;
module.exports.formatData = formatData;

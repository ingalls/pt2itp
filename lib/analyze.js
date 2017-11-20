const fs = require('fs');
const pg = require('pg');
const path = require('path');
const queue = require('queue-async');
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
 * @param {Object} argv - command line arguments passed when calling `pt2itp analyze`
 * @param {string} argv.cc - country code with optional region code (eg. `es` or `us ny`)
 * @param {Object} argv.type - one of "network" or "address"
 * @param {function} callback - callback function to surface any thrown errors
 */
function analyze(argv, callback) {
    if (Array.isArray(argv)) {
        argv = require('minimist')(argv, {
            string: [
                'cc',
                'type',
                'limit',
                'output'
            ]
        });
    }
    if (!argv.cc) {
        console.error('--cc=<country code> argument required');
        process.exit(1);
    } else if (!argv.type) {
        console.error('--type=<type> argument required');
        process.exit(1);
    } else if (!argv.output) {
        console.error('--output=<output file location> argument required');
        process.exit(1);
    }

    if (argv.limit) {
        argv.limit = parseInt(argv.limit);
    } else {
        console.log('note: you can limit results/rows with --limit <number>');
    }

    const cc = argv.cc;
    const type = argv.type;
    const limit = argv.limit

    const writeStream = fs.createWriteStream(path.resolve(argv.output), { encoding: 'utf8' });

    const csvStream = csv.createWriteStream({ headers: true });
    csvStream.pipe(writeStream);

    extractTextField(cc, type, limit, (err, text) => {
        if (err) return callback(err);
        frequencyDistributionMunger(text, (err, scores) => {
            if (err) return callback(err);
            else {
                for (let score of scores) {
                    csvStream.write(score, {headers: true});
                }
                csvStream.end();
            }
        });
    });
    writeStream.on("finish", () => { callback(null);});
}

/**
 * This method queries the appropriate table in the postgres database, returns
 * the _text field for each row, passes each value through {@link formatData},
 * and calls callback on an array of the results.
 *
 * @param {string} cc - country code or country code + region (eg "es" or "us ny")
 * @param {string} type - one of "network" or "address"
 * @param {function} callback - callback function
 */
function extractTextField(cc, type, limit, callback) {
    let database;
    let table;
    let limitClause;

    table = (type == 'address') ? 'address_cluster' : 'network_cluster';
    limitClause = limit ? ' LIMIT ' + limit : '';

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
    scores = bigrams.score_ngrams('likelihoodRatio');
    return callback(null, scores);
}

module.exports = analyze;
module.exports.frequencyDistributionMunger = frequencyDistributionMunger;
module.exports.extractTextField = extractTextField;
module.exports.formatData = formatData;

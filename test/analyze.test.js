const analyser = require('../lib/analyze');
const freqDist = require('./fixtures/analyze.freqDist.js');
const comparison = require('./fixtures/analyze.comparison.js');
const path = require('path');
const pg = require('pg');
const fs = require('fs');
const tmp = require('tmp');
const test = require('tape');
const Queue = require('d3-queue').queue;
const Cluster = require('../lib/cluster');
const Index = require('../lib/index');

const pool = new pg.Pool({
    max: 3,
    user: 'postgres',
    database: 'pt_test',
    idleTimeoutMillis: 3000
});

const cluster = new Cluster({ pool: pool });
const index = new Index(pool);

test('Drop/Init Database', (t) => {
    index.init((err, res) => {
        t.error(err);
        t.end();
    });
});

test('Init db', (t) => {
    const popQ = new Queue(1);

    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            DELETE FROM address_cluster;
            INSERT INTO address_cluster (id, text, text_tokenless, _text) VALUES
                (1, '{"akoko st"}', '{"akoko"}', '{"Akoko Street", "Akoko Rd"}'),
                (2, '{"wong ho ln"}', '{"wong ho"}', '{"Wong Ho Lane"}'),
                (3, '{"pier 1"}', '{"pier 1"}', '{"Pier 1"}'),
                (4, '{"main st"}', '{"main"}', '{"Main St"}'),
                (5, '{"fake st"}', '{"fake"}', '{"Fake St"}'),
                (6, '{"elm way"}', '{"elm"}', '{"Elm Way"}'),
                (7, '{"evergreen tr"}', '{"evergreen"}', '{"Evergreen Terrace"}');
            COMMIT;
        `, (err, res) => {
            t.error(err);
            return done();
        });
    });

    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            DELETE FROM network_cluster;
            INSERT INTO network_cluster (id, address, _text, text_tokenless) VALUES
                (1, 1, 'Akoko Street', 'Akoko'),
                (2, 2, 'Wong Ho Lane', 'Wong Ho'),
                (3, 3, 'Pier 1',       'Pier 1'),
                (4, 4, 'Main St',      'Main'),
                (5, 5, 'Fake St',      'Fake'),
                (6, 6, 'Canal St',      'Canal'),
                (5, 7, 'Lonely Street', 'Lonely');
            COMMIT;
        `, (err, res) => {
            t.error(err);
            return done();
        });
    });

    popQ.await((err) => {
        t.error(err);
        t.end();
    });

});

test('Results from extractTextField', (t) => {
    analyser.extractTextField('address', 5, pool, (err, data) => {
        t.error(err);
        t.deepEquals(
            data,
            ['Akoko Street', 'Akoko Rd', 'Wong Ho Lane', 'Pier 1', 'Main St', 'Fake St' ],
            'extracted text is correct'
        );
        t.end();
    });
});

test('format data from text extraction', (t) => {
    let fixture = [ { _text: 'Akoko Street' }, { _text: 'Akala Lane' }, { _text: 'Dreier Street' }];
    let expected = analyser.formatData(fixture);
    t.deepEquals(expected, [ 'Akoko Street', 'Akala Lane', 'Dreier Street' ], 'Data formatted correctly');
    t.end();
});

test('frequencyDistribution check', (t) => {
    let fixtures = [ 'Akoko Street', 'Wong Ho Lane', 'Pier 1', 'Main St', 'Fake St', 'Canal St', 'Lonely Street'];
    analyser.frequencyDistributionMunger(fixtures, (err, data) => {
        t.deepEquals([...data.score_ngrams('likelihoodRatio')], freqDist.network_bigram, 'expected frequency distribution');
        t.end();
    });
});


/**
 * Tests the outputs of the analyze command where --type is set
 *
 * @param {string} type - The type of data to be analyzed. Must be either "network" or "address"
 * @param {Test} t - a tape.js Test
 */
function testOutputs(type, t) {
    /**
     * Check that the CSV output is as expected
     *
     * @param {string} order - the order of the analysis. Must be one of "bigram" or "unigram"
     * @param {string} type - The type of data to be analyzed. Must be either "network" or "address"
     * @param {string} tempFileNamePrefix - The file path prefix for the outputs of analyze
     * @param {Test} t - a tape.js Test
     * @param {function} cb - callback
     */
    function checkCSV(order, type, tempFileNamePrefix, t, cb) {
        let tmpOutput = `${tempFileNamePrefix}-${order}.csv`;

        let fixturePath = path.resolve(__dirname, `./fixtures/analyze.${type}-${order}.csv`);
        if (process.env.UPDATE) {
            fs.createReadStream(tmpOutput)
                .pipe(fs.createWriteStream(fixturePath));
            t.fail(`updated ${type} ${order} fixture ${fixturePath}`);
        } else {
            let expected = fs.readFileSync(fixturePath).toString();
            let actual = fs.readFileSync(tmpOutput).toString();
            t.deepEqual(actual, expected, `${type} ${order} output is as expected`);
        }
        return cb();
    }

    /**
     * Check that the SQL tables populated by analyze are as expected
     *
     * @param {string} order - The order of the analysis. Must be one of "bigram" or "unigram"
     * @param {string} type - The type of data to be analyzed. Must be either "network" or "address"
     * @param {Test} t - a tape.js Test
     * @param {function} cb - callback
     */
    function checkTable(order, type, t, cb) {
        let q=`SELECT * FROM ${type}_${order}s;`;
        pool.query(q, (err, res) => {
            t.error(err);
            let results = [];

            for (let j=0;j<res.rows.length;j++) {
                //d = res.rows[j]
                results.push(res.rows[j]);
            }
            if (results.length <= 0) {
                t.fail(`no results returned from ${type}_${order}s. query was "${q}"`);
            }
            t.deepEqual(results, freqDist[`${type}_${order}_sql`], `SQL table ${type}_${order}s has expected values`);
            return cb();
        });
    }

    let popQ = new Queue(1);

    let tempFileNamePrefix = tmp.tmpNameSync();
    analyser(
        {cc: 'test', type: type, limit: 100, output: tempFileNamePrefix},
        (err) => {
            t.error(err);
            let orders = ['bigram', 'unigram'];
            for (let j=0;j<orders.length;j++) {
                let order = orders[j];
                popQ.defer(checkCSV, order, type, tempFileNamePrefix, t);
                popQ.defer(checkTable, order, type, t);
            }
            popQ.await((err) => {
                t.error(err);
                t.end();
            });
        }
    );
}

test('analyze.js output - address', (t) => {
    testOutputs('address', t);
});

test('analyze.js output - network', (t) => {
    testOutputs('network', t);
});

test('analyze.js comparison', (t) => {
    /**
     * Check that the comparison's CSV output is as expected
     *
     * @param {string} order - the order of the analysis. Must be one of "bigram" or "unigram"
     * @param {string} type - The type of data to be analyzed. Must be either "network" or "address"
     * @param {string} tempFileNamePrefix - The file path prefix for the outputs of analyze
     * @param {Test} t - a tape.js Test
     * @param {function} cb - callback
     */
    function checkCSV(order, type, tempFileNamePrefix, t, cb) {
        let tmpOutput = `${tempFileNamePrefix}-${type}-${order}.csv`;

        let fixturePath = path.resolve(__dirname, `./fixtures/analyze.significant-${type}-${order}s.csv`);
        if (process.env.UPDATE) {
            fs.createReadStream(tmpOutput)
                .pipe(fs.createWriteStream(fixturePath));
            t.fail(`updated ${type} ${order} fixture ${fixturePath}`);
        } else {
            let expected = fs.readFileSync(fixturePath).toString();
            let actual = fs.readFileSync(tmpOutput).toString();
            t.deepEqual(actual, expected, `${type} ${order} output is as expected`);
        }
        return cb();
    }

    /**
     * Check that the SQL tables populated by analyze are as expected
     *
     * @param {string} order - The order of the analysis. Must be one of "bigram" or "unigram"
     * @param {Test} t - a tape.js Test
     * @param {function} cb - callback
     */
    function checkComparison(order, t, cb) {
        let q=`SELECT * FROM ${order}_comparison;`;
        pool.query(q, (err, res) => {
            t.error(err);
            let results = [];

            for (let j=0;j<res.rows.length;j++) {
                //d = res.rows[j]
                results.push(res.rows[j]);
            }
            if (results.length <= 0) {
                t.fail(`no results returned from ${order}_comparison. query was "${q}"`);
            }
            t.deepEqual(results, comparison[`${order}_comparison`], `SQL table ${order}_comparison has expected values`);
            return cb();
        });
    }

    let popQ = new Queue(1);
    let tempFileNamePrefix = tmp.tmpNameSync();
    analyser(
        {cc: 'test', compare: true, output: tempFileNamePrefix},
        (err) => {
            if (err) throw err;
            let orders = ['bigram', 'unigram'];
            for (let j=0;j<orders.length;j++) {
                let order = orders[j];
                popQ.defer(checkComparison, order, t);
                let types = ['network', 'address'];
                for (let k=0; k<types.length; k++) {
                    let type = types[k];
                    popQ.defer(checkCSV, order, type, tempFileNamePrefix, t);
                }
            }
            popQ.await((err) => {
                t.error(err);
                t.end();
            });
        }
    );

});

test('end connection', (t) => {
    pool.end();
    t.end();
});

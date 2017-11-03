const Index = require('../lib/index');
const worker = require('../lib/map');

const fs = require('fs');
const tape = require('tape');
const spawn = require('tape-spawn');
const csv = require('fast-csv');
const pg = require('pg');
const Queue = require('d3-queue').queue;
const ReadLine = require('readline');

const carmenIndex = `${__dirname}/fixtures/index-ri-single/us_la-address-both-0437f7c1171016141008-0437f7c1b8.mbtiles`;
const database = 'pt_test';
const output = `${__dirname}/fixtures/test-mode-ri-errors.csv`;
const config = `${__dirname}/fixtures/index-ri-carmen-config.json`;

const pool = new pg.Pool({
    max: 10,
    user: 'postgres',
    database: database,
    idleTimeoutMillis: 30000
});

const index = new Index(pool);

tape.test('Drop/init database', (t) => {
    index.init((err, res) => {
        t.error(err);
        t.end();
    });
});

// loads address and network data into postgres, produces an ITP geojson in /tmp/
tape.test('load address and network files', (t) => {
    worker({
            'in-address': './test/fixtures/index-ri-single/address.geojson',
            'in-network': './test/fixtures/index-ri-single/network.geojson',
            output: '/tmp/itp.geojson',
            debug: true,
            db: 'pt_test'
       }, (err, res) => {
            t.error(err);
            t.end();
    });
});

tape.test('Return correct std.err message', (t) => {

    let st = spawn(t, `${__dirname}/../index.js test --index ${carmenIndex} --database ${database} --output ${output} --config ${config}`);

    st.stderr.match(`
        ok - beginning match
        ok - beginning unmatch
        ok - beginning diff name

        ERROR TYPE                   COUNT
        -----------------------------------------------------------------------------------
        NAME MISMATCH (HARD)             1 (  1.8% of errors |  1.8% of total addresses)
        TEXT                            54 ( 98.2% of errors | 98.2% of total addresses)

        ok - 54/55 (98.2%) failed to geocode
        ok - skipped 0 duplicative & proximate house numbers as redundant (these are fine)
        ok - skipped 0 duplicative & distant house numbers as impossible to geocode (these are less fine)
        `.replace(/^ +/mg, ''));
    st.end();
});

//comment out to persist database after test run
tape.test('Drop/init database', (t) => {
    index.init((err, res) => {
        t.error(err);
        t.end();
    });
});

tape.test('end connection', (t) => {
    pool.end();
    t.end();
});
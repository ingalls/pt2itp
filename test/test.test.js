const Index = require('../lib/index');
const worker = require('../lib/map');

const tape = require('tape');
const spawn = require('tape-spawn');
const csv = require('fast-csv');
const pg = require('pg');

const carmenIndex = `${__dirname}/fixtures/index-ri-single/us_ri-address-both-0d603c2a171017011038-0d603c2a39.mbtiles`;
const database = 'pt_test';
const output = `${__dirname}/fixtures/index-ri-single/test-mode-ri-errors.csv`;
const config = `${__dirname}/fixtures/index-ri-single/index-ri-carmen-config.json`;

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
            db: 'pt_test',
            tokens: 'en'
       }, (err, res) => {
            t.error(err);
            t.end();
    });
});

tape.test('Run test mode', (t) => {

    let st = spawn(t, `${__dirname}/../index.js test --index ${carmenIndex} --database ${database} --output ${output} --config ${config}`);

    t.test('Return correct std.err message', (t) => {
        st.stderr.match(`
            ok - beginning match
            ok - beginning unmatch
            ok - beginning diff name

            ERROR TYPE                   COUNT
            -----------------------------------------------------------------------------------
            NAME MISMATCH (SOFT)             1 (  9.1% of errors |  9.1% of total addresses)
            NO RESULTS                       1 (  9.1% of errors |  9.1% of total addresses)

            ok - 1/11 ( 9.1%) failed to geocode
            ok - skipped 0 duplicative & proximate house numbers as redundant (these are fine)
            ok - skipped 0 duplicative & distant house numbers as impossible to geocode (these are less fine)
            `.replace(/^ +/mg, ''));
        st.end();
    });

    t.test('Return correct error messages in csv', (t) => {
        let csvErr = [];

        csv.fromPath(output, {headers: true})
        .on("data", (data) => {
            csvErr.push(data);
        })
        .on("end", function() {
            t.equals(csvErr[0].error, 'NAME MISMATCH (SOFT)');
            t.equals(csvErr[1].error, 'NO RESULTS');
            t.end();
        });

        st.end();
    });
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
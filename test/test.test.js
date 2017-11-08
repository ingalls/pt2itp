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
            NAME MISMATCH (SOFT)             1 ( 50.0% of errors |  9.1% of total addresses)
            NO RESULTS                       1 ( 50.0% of errors |  9.1% of total addresses)

            ok - 1/11 (9.1%) failed to geocode
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
            t.equal(csvErr.length, 2);
            t.notEqual(csvErr.map((ele) => ele.error).indexOf('NO RESULTS'), -1);
            t.notEqual(csvErr.map((ele) => ele.error).indexOf('NAME MISMATCH (SOFT)'), -1);
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
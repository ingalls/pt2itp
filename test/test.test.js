const Index = require('../lib/index');
const worker = require('../lib/map');

const spawn = require('tape-spawn');
const csv = require('fast-csv');
const test = require('tape');
const path = require('path');
const pg = require('pg');

const database = 'pt_test';
const carmenIndex = path.resolve(__dirname, './fixtures/index-ri-single/us_ri-address-both-0d603c2a171017011038-0d603c2a39.mbtiles');
const output = path.resolve(__dirname, './fixtures/index-ri-single/test-mode-ri-errors.csv');
const config = path.resolve(__dirname, './fixtures/index-ri-single/index-ri-carmen-config.json');

const pool = new pg.Pool({
    max: 10,
    user: 'postgres',
    database: database,
    idleTimeoutMillis: 30000
});

const index = new Index(pool);

test('Drop/init database', (t) => {
    index.init((err, res) => {
        t.error(err);
        t.end();
    });
});

// loads address and network data into postgres
test('load address and network files', (t) => {
    worker({
        'in-address': './test/fixtures/index-ri-single/address.geojson',
        'in-network': './test/fixtures/index-ri-single/network.geojson',
        output: '/tmp/itp.geojson',
        debug: true,
        db: database,
        tokens: 'en'
    }, (err, res) => {
        t.error(err);
        t.end();
    });
});

test('Run test mode', (t) => {
    let st = spawn(t, `${__dirname}/../index.js test --index ${carmenIndex} --database ${database} --output ${output} --config ${config}`);

    t.test('Return correct std.err message', (t) => {
        st.stderr.match(/NAME MISMATCH \(SOFT\)\s+1 \( 50\.0% of errors \|  9\.1% of total addresses\)/, 'NAME MISMATCH (SOFT) error');
        st.stderr.match(/NO RESULTS\s+1 \( 50\.0% of errors \|  9\.1% of total addresses\)/, 'NO RESULTS error');
        st.stderr.match(/1\/11 \(9\.1%\) failed to geocode/, 'failed to geocode error')
        st.end();
    });

    t.test('Return correct error messages in csv', (t) => {
        let csvErr = [];

        csv.fromPath(output, {headers: true})
        .on('data', (data) => {
            csvErr.push(data);
        })
        .on('end', function() {
            t.equal(csvErr.length, 2);
            t.notEqual(csvErr.map((ele) => ele.error).indexOf('NO RESULTS'), -1);
            t.notEqual(csvErr.map((ele) => ele.error).indexOf('NAME MISMATCH (SOFT)'), -1);
            t.end();
        });
        st.end();
    });
});

test('Drop/init database', (t) => {
    index.init((err, res) => {
        t.error(err);
        t.end();
    });
});

test('end connection', (t) => {
    pool.end();
    t.end();
});

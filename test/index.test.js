const tape = require('tape');
const tmp = require('tmp');
const os = require('os');
const fs = require('fs');
const copy = require('../lib/copy');
const index = require('../lib/index');
const tokenize = require('../lib/tokenize');

const pool = new pg.Pool({
    max: 10,
    user: 'postgres',
    database: 'pt_test',
    idleTimeoutMillis: 30000
});

test('Init Database', (t) => {
    const index = new Index(pool);

    index.init((err) => {
        t.error(err);
        t.end();
    });
});

tape('index.js output', (t) => {
    let file = __dirname + '/fixtures/copy.sample-geojson-input.geojson';
    index.copy(file, 'address', {
        tokens: tokens,
        map: argv['map-address'],
        error: argv['error-address']
    }, done);
});

const tape = require('tape');
const tmp = require('tmp');
const tokens = require('@mapbox/geocoder-abbreviations')
const os = require('os');
const fs = require('fs');
const copy = require('../lib/copy');
const Index = require('../lib/index');
const tokenize = require('../lib/tokenize');
const pg = require('pg');

const pool = new pg.Pool({
    max: 10,
    user: 'postgres',
    database: 'pt_test',
    idleTimeoutMillis: 30000
});

const index = new Index(pool);

tape('Init Database', (t) => {

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

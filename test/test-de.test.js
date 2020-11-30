'use strict';

const worker = require('../lib/map');
const exec = require('child_process').exec;
const fs = require('fs');

const test = require('tape');
const path = require('path');

const database = 'pt_test';
const carmenIndex = '/tmp/test-de.mbtiles';
const output = '/tmp/test-de.err';
const config = path.resolve(__dirname, './fixtures/test-de/carmen-config.json');
const deTokens = require('@mapbox/geocoder-abbreviations')('de');
const abbr = '/tmp/test-de-abbr.json';
const db = require('./lib/db');

// Convert the de regex tokens into the global format expected by carmen.
const tokens = {};
for (const token of deTokens) {
    if (!Array.isArray(token) || typeof(token[1]) !== 'object' || !token[1]['regex']) {
        continue;
    }
    const from = token[1]['text'];
    const to = token[0];
    tokens[from] = to;
}
fs.writeFileSync(abbr, JSON.stringify(tokens));

db.init(test);

// loads address and network data into postgres
test('load address and network de files', (t) => {
    worker({
        'in-address': path.resolve(__dirname, './fixtures/test-de/address.geojson'),
        'in-network': path.resolve(__dirname, './fixtures/test-de/network.geojson'),
        output: '/tmp/itp-de.geojson',
        debug: true,
        db: database,
        languages: 'de'
    }, (err) => {
        t.ifError(err);
        t.end();
    });
});

// make sure to delete /tmp/test-de.* before running indexer
test('clean up any previous database files', (t) => {
    exec('rm -rf /tmp/test-de.*', (err) => {
        t.ifError(err);
        if (fs.existsSync('/tmp/test-de.mbtiles')) {
            t.equal(fs.existsSync('/tmp/test-de.mbtiles'), false, 'cleans up test-de.mbtiles');
        }
        t.end();
    });
});

// step 2: create index file for test mode
// cat <geojson> | carmen-index --config=${config} --index=${carmenIndex}
test('create index from geojson', (t) => {
    exec(`cat /tmp/itp-de.geojson | ${__dirname}/../node_modules/.bin/carmen-index --config=${config} --index=${carmenIndex} --tokens ${abbr}`, (err) => {
        t.ifError(err);
        t.equal(fs.existsSync('/tmp/test-de.mbtiles'), true, 'creates test-de.mbtiles');
        t.end();
    });
});

test('query from new index', (t) => {
    exec(`${__dirname}/../node_modules/.bin/carmen --query "5 Haupt Strasse" ${carmenIndex} --tokens ${abbr} | grep "1.00 5 Haupt Strasse" | tr -d '\n'`, (err, res) => {
        t.ifError(err);
        t.equal(res.split(',')[0], '- 1.00 5 Haupt Strasse', 'Finds 5 Haupt Strasse');
        t.end();
    });
});

test('query for new index', (t) => {
    exec(`${__dirname}/../node_modules/.bin/carmen --query "5 Hauptstrasse" ${carmenIndex} --tokens ${abbr} | grep "1.00 5 Haupt Strasse" | tr -d '\n'`, (err, res) => {
        t.ifError(err);
        t.equal(res.split(',')[0], '- 1.00 5 Haupt Strasse', 'Finds 5 "Hauptstrasse" as "Haupt Strasse"');
        t.end();
    });
});

// step 3: run test mode against the built index
test('Run test mode', (t) => {
    exec(`${__dirname}/../index.js test --config=${config} --index=${carmenIndex} --db=${database} -o ${output}`, () => {
        t.test('Return correct error messages in csv', (t) => {
            try {
                fs.accessSync(output);
            } catch (err) {
                t.ok(err, 'no errors for strasse tokens');
            }
            t.end();
        });
    });
});

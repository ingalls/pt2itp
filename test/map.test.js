'use strict';

const ReadLine = require('readline');
const worker = require('../lib/map');

const test = require('tape');
const fs = require('fs');
const db = require('./lib/db');

db.init(test);

test('map - in-address error', (t) => {
    worker({
    }, (err) => {
        t.equals(err.toString(), 'Error: --in-address=<FILE.geojson> argument required');
        t.end();
    });
});

db.init(test);

test('map - in-network error', (t) => {
    worker({
        'in-address': '/tmp/us_dc_addr.geojson'
    }, (err) => {
        t.equals(err.toString(), 'Error: --in-network=<FILE.geojson> argument required');
        t.end();
    });
});

db.init(test);

test('map - output error', (t) => {
    worker({
        'in-address': '/tmp/us_dc_addr.geojson',
        'in-network': '/tmp/us_dc_str.geojson'
    }, (err) => {
        t.equals(err.toString(), 'Error: --output=<FILE.geojson> argument required');
        t.end();
    });
});

db.init(test);

test('map - db error', (t) => {
    worker({
        'in-address': '/tmp/us_dc_addr.geojson',
        'in-network': '/tmp/us_dc_str.geojson',
        'output': '/tmp/itp.geojson'
    }, (err) => {
        t.equals(err.toString(), 'Error: --db=<DATABASE> argument required');
        t.end();
    });
});

db.init(test);

test('map - good run', (t) => {

    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/itp.geojson');
        fs.unlinkSync('/tmp/error-network');
        fs.unlinkSync('/tmp/error-address');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    worker({
        'in-address': '/tmp/us_dc_addr.geojson',
        'in-network': '/tmp/us_dc_str.geojson',
        stats: '/tmp/counties.geojson',
        output: '/tmp/itp.geojson',
        'error-network': '/tmp/error-network',
        'error-address': '/tmp/error-address',
        languages: 'en',
        debug: true,
        db: 'pt_test'
    }, (err) => {
        t.error(err);

        t.doesNotThrow(() => {
            fs.accessSync('/tmp/error-network');
            fs.accessSync('/tmp/error-address');
        });

        fs.unlinkSync('/tmp/itp.geojson');
        fs.unlinkSync('/tmp/error-network');
        fs.unlinkSync('/tmp/error-address');
        t.end();
    });
});

db.init(test);

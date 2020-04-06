'use strict';

const ReadLine = require('n-readlines');
const worker = require('../index').consensus;

const test = require('tape');
const path = require('path');
const fs = require('fs');

const db = require('./lib/db');
db.init(test);

test('consensus - sources argument error', (t) => {
    t.throws(() => worker(), /sources argument is required/);
    t.end();
});

test('consensus - test_set argument error', (t) => {
    t.throws(() => worker({
        sources: [path.resolve(__dirname, './fixtures/dc-persistent.geojson')]
    }), /test_set argument is required/);
    t.end();
});

test('consensus - output argument error', (t) => {
    t.throws(() => worker({
        sources: [path.resolve(__dirname, './fixtures/dc-persistent.geojson')],
        'test_set': path.resolve(__dirname, './fixtures/dc-new.geojson')
    }), /Output file required/);
    t.end();
});

test('consensus', (t) => {
    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/output.txt');
        fs.unlinkSync('/tmp/error-sources');
        fs.unlinkSync('/tmp/error-test-set');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    worker({
        sources: [
            path.resolve(__dirname, './fixtures/dc-consensus-source-1.geojson'),
            path.resolve(__dirname, './fixtures/dc-consensus-source-2.geojson'),
            path.resolve(__dirname, './fixtures/dc-consensus-source-3.geojson')
        ],
        'test_set': path.resolve(__dirname, './fixtures/dc-consensus-test-set.geojson'),
        output: '/tmp/output.txt',
        'error_sources': '/tmp/error-sources',
        'error_test_set': '/tmp/error-test-set',
        context: {
            country: 'us',
            region: 'dc',
            languages: ['en']
        },
        db: 'pt_test'
    });

    const rl = new ReadLine('/tmp/output.txt');
    const line = rl.next();
    t.ok(line.toString());

    t.notOk(rl.next(), '1 output feature');
    t.doesNotThrow(() => {
        fs.accessSync('/tmp/error-sources');
        fs.accessSync('/tmp/error-test-set');
    });

    fs.unlinkSync('/tmp/output.txt');
    fs.unlinkSync('/tmp/error-sources');
    fs.unlinkSync('/tmp/error-test-set');
    t.end();
});

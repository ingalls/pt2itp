'use strict';

const ReadLine = require('n-readlines');
const worker = require('../index').conflate;

const test = require('tape');
const path = require('path');
const fs = require('fs');

const db = require('./lib/db');
db.init(test);

test('Compare - CREATE', (t) => {

    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/output.geojson');
        fs.unlinkSync('/tmp/error-persistent');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    worker({
        'in_persistent': path.resolve(__dirname, './fixtures/dc-persistent.geojson'),
        'in_address': path.resolve(__dirname, './fixtures/dc-new.geojson'),
        output: '/tmp/output.geojson',
        'error_persistent': '/tmp/error-persistent',
        context: {
            country: 'us',
            region: 'dc',
            languages: ['en']
        },
        db: 'pt_test'
    });

    const rl = new ReadLine('/tmp/output.geojson');

    t.deepEquals(JSON.parse(rl.next()), {
        action: 'create',
        type: 'Feature',
        version: 0,
        properties: {
            number: '112',
            street: [{
                display: '4th St NE',
                priority: -1
            }]
        },
        geometry: {
            type: 'Point',
            coordinates: [-77.00080543756485, 38.89128752230519]
        }
    });

    t.doesNotThrow(() => {
        fs.accessSync('/tmp/error-persistent');
    });

    fs.unlinkSync('/tmp/output.geojson');
    fs.unlinkSync('/tmp/error-persistent');
    t.end();
});

test('Compare - MODIFY', (t) => {

    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/output.geojson');
        fs.unlinkSync('/tmp/error-persistent');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    worker({
        'in_persistent': path.resolve(__dirname, './fixtures/dc-persistent.geojson'),
        'in_address': path.resolve(__dirname, './fixtures/dc-new-modify.geojson'),
        output: '/tmp/output.geojson',
        'error_persistent': '/tmp/error-persistent',
        context: {
            country: 'us',
            region: 'dc',
            languages: ['en']
        },
        db: 'pt_test'
    });

    const rl = new ReadLine('/tmp/output.geojson');

    t.deepEquals(JSON.parse(rl.next()), {
        id: 1,
        version: 2,
        action: 'modify',
        type: 'Feature',
        properties: {
            number: 108,
            street: [{
                display: '4th St NE',
                priority: -1
            },{
                display: 'DC Route 101',
                priority: -2
            }]
        },
        geometry: {
            type: 'Point',
            coordinates: [-77.0008054375648, 38.8912875223052]
        }
    });

    t.doesNotThrow(() => {
        fs.accessSync('/tmp/error-persistent');
    });

    fs.unlinkSync('/tmp/output.geojson');
    fs.unlinkSync('/tmp/error-persistent');
    t.end();
});

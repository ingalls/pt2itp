'use strict';

const ReadLine = require('n-readlines');
const worker = require('../index').conflate;

const test = require('tape');
const path = require('path');
const fs = require('fs');

const db = require('./lib/db');
db.init(test);

test('conflate - in_persistent argument error', (t) => {
    t.throws(() => worker(), /in_persistent argument is required/);
    t.end();
});

test('conflate - in_address argument error', (t) => {
    t.throws(() => worker({
        'in_persistent': path.resolve(__dirname, './fixtures/dc-persistent.geojson')
    }), /in_address argument is required/);
    t.end();
});

test('conflate - output argument error', (t) => {
    t.throws(() => worker({
        'in_persistent': path.resolve(__dirname, './fixtures/dc-persistent.geojson'),
        'in_address': path.resolve(__dirname, './fixtures/dc-new.geojson')
    }), /Output file required/);
    t.end();
});

test('conflate - CREATE finds only exact duplicate features, adds nothing', (t) => {
    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/output.geojson');
        fs.unlinkSync('/tmp/error-persistent');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    worker({
        'in_persistent': path.resolve(__dirname, './fixtures/dc-persistent.geojson'),
        'in_address': path.resolve(__dirname, './fixtures/dc-persistent.geojson'),
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

    t.notOk(rl.next(), 'no output features');
    t.doesNotThrow(() => {
        fs.accessSync('/tmp/error-persistent');
    });

    fs.unlinkSync('/tmp/output.geojson');
    fs.unlinkSync('/tmp/error-persistent');
    t.end();
});

test('conflate - CREATE finds features with same address number and street less than 1km away, adds nothing', (t) => {
    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/output.geojson');
        fs.unlinkSync('/tmp/error-persistent');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    worker({
        'in_persistent': path.resolve(__dirname, './fixtures/dc-persistent.geojson'),
        'in_address': path.resolve(__dirname, './fixtures/dc-new-close.geojson'),
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

    t.notOk(rl.next(), 'no output features');
    t.doesNotThrow(() => {
        fs.accessSync('/tmp/error-persistent');
    });

    fs.unlinkSync('/tmp/output.geojson');
    fs.unlinkSync('/tmp/error-persistent');
    t.end();
});

test('conflate - CREATE finds features with same address number and street more than 1km away, add new address', (t) => {
    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/output.geojson');
        fs.unlinkSync('/tmp/error-persistent');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    worker({
        'in_persistent': path.resolve(__dirname, './fixtures/dc-persistent.geojson'),
        'in_address': path.resolve(__dirname, './fixtures/dc-new-far.geojson'),
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
        properties: {
            number: '108',
            street: [{
                display: '4th St NE',
                priority: -1
            }]
        },
        geometry: {
            type: 'Point',
            coordinates: [-77.00055599212646, 38.880443352851955]
        }
    });

    t.notOk(rl.next(), '1 output feature');
    t.doesNotThrow(() => {
        fs.accessSync('/tmp/error-persistent');
    });

    fs.unlinkSync('/tmp/output.geojson');
    fs.unlinkSync('/tmp/error-persistent');
    t.end();
});

test('conflate - CREATE finds feature with different address number and street, adds new address', (t) => {
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

    t.notOk(rl.next(), 'output 1 feature');
    t.doesNotThrow(() => {
        fs.accessSync('/tmp/error-persistent');
    });

    fs.unlinkSync('/tmp/output.geojson');
    fs.unlinkSync('/tmp/error-persistent');
    t.end();
});

test('conflate - MODIFY adds new names to existing address names preferencing new names', (t) => {
    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/output.geojson');
        fs.unlinkSync('/tmp/error-persistent');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    worker({
        'in_persistent': path.resolve(__dirname, './fixtures/dc-persistent-syns.geojson'),
        'in_address': path.resolve(__dirname, './fixtures/dc-modify.geojson'),
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
                display: '4th Street Northeast',
                priority: -1
            }, {
                display: 'DC Route 101',
                priority: -2
            }, {
                display: 'Main St',
                priority: -2
            }]
        },
        geometry: {
            type: 'Point',
            coordinates: [-77.0008054375648, 38.8912875223052]
        }
    });

    t.notOk(rl.next(), 'output 1 feature');
    t.doesNotThrow(() => {
        fs.accessSync('/tmp/error-persistent');
    });

    fs.unlinkSync('/tmp/output.geojson');
    fs.unlinkSync('/tmp/error-persistent');
    t.end();
});

test('conflate - MODIFY does not update existing address, no new names are added', (t) => {
    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/output.geojson');
        fs.unlinkSync('/tmp/error-persistent');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    worker({
        'in_persistent': path.resolve(__dirname, './fixtures/dc-persistent-syns.geojson'),
        'in_address': path.resolve(__dirname, './fixtures/dc-persistent.geojson'),
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

    t.notOk(rl.next(), 'no output features');
    t.doesNotThrow(() => {
        fs.accessSync('/tmp/error-persistent');
    });

    fs.unlinkSync('/tmp/output.geojson');
    fs.unlinkSync('/tmp/error-persistent');
    t.end();
});

test('conflate - MODIFY handles multiple updates to the same feature', (t) => {
    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/output.geojson');
        fs.unlinkSync('/tmp/error-persistent');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    worker({
        'in_persistent': path.resolve(__dirname, './fixtures/dc-persistent.geojson'),
        'in_address': path.resolve(__dirname, './fixtures/dc-modify-multiple.geojson'),
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
            }, {
                display: 'Main St',
                priority: -2
            }, {
                display: 'DC Route 101',
                priority: -2
            }]
        },
        geometry: {
            type: 'Point',
            coordinates: [-77.0008054375648, 38.8912875223052]
        }
    });

    t.notOk(rl.next(), 'output 1 feature');
    t.doesNotThrow(() => {
        fs.accessSync('/tmp/error-persistent');
    });

    fs.unlinkSync('/tmp/output.geojson');
    fs.unlinkSync('/tmp/error-persistent');
    t.end();
});

test('conflate - MODIFY all properties on the existing address are preserved, including overrides, excluding street names', (t) => {
    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/output.geojson');
        fs.unlinkSync('/tmp/error-persistent');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    worker({
        'in_persistent': path.resolve(__dirname, './fixtures/dc-persistent-override.geojson'),
        'in_address': path.resolve(__dirname, './fixtures/dc-modify.geojson'),
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
            postcode: '00000',
            accuracy: 'rooftop',
            source: 'original-source',
            number: 108,
            street: [{
                display: '4th Street Northeast',
                priority: -1
            }, {
                display: 'DC Route 101',
                priority: -2
            }]
        },
        geometry: {
            type: 'Point',
            coordinates: [-77.0008054375648, 38.8912875223052]
        }
    });

    t.notOk(rl.next(), 'output 1 feature');
    t.doesNotThrow(() => {
        fs.accessSync('/tmp/error-persistent');
    });

    fs.unlinkSync('/tmp/output.geojson');
    fs.unlinkSync('/tmp/error-persistent');
    t.end();
});

test('conflate - MODIFY non-street properties on the new address are not included in updates', (t) => {
    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/output.geojson');
        fs.unlinkSync('/tmp/error-persistent');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    worker({
        'in_persistent': path.resolve(__dirname, './fixtures/dc-persistent.geojson'),
        'in_address': path.resolve(__dirname, './fixtures/dc-persistent-override.geojson'),
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

    t.notOk(rl.next(), 'no features output');
    t.doesNotThrow(() => {
        fs.accessSync('/tmp/error-persistent');
    });

    fs.unlinkSync('/tmp/output.geojson');
    fs.unlinkSync('/tmp/error-persistent');
    t.end();
});

test('conflate - MODIFY existing addresses with output==false are not modified', (t) => {
    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/output.geojson');
        fs.unlinkSync('/tmp/error-persistent');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    worker({
        'in_persistent': path.resolve(__dirname, './fixtures/dc-persistent-output.geojson'),
        'in_address': path.resolve(__dirname, './fixtures/dc-modify-output.geojson'),
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
    t.notOk(rl.next(), 'no features output');
    t.doesNotThrow(() => {
        fs.accessSync('/tmp/error-persistent');
    });

    fs.unlinkSync('/tmp/output.geojson');
    fs.unlinkSync('/tmp/error-persistent');
    t.end();
});

test('conflate - MODIFY existing addresses with output==false are not modified, cardinal to non-cardinal match', (t) => {
    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/output.geojson');
        fs.unlinkSync('/tmp/error-persistent');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    worker({
        'in_persistent': path.resolve(__dirname, './fixtures/dc-persistent-output-cardinal.geojson'),
        'in_address': path.resolve(__dirname, './fixtures/dc-modify-output-cardinal.geojson'),
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
    t.notOk(rl.next(), 'no features output');
    t.doesNotThrow(() => {
        fs.accessSync('/tmp/error-persistent');
    });

    fs.unlinkSync('/tmp/output.geojson');
    fs.unlinkSync('/tmp/error-persistent');
    t.end();
});

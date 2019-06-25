'use strict';

const stats = require('../native/index.node').stats;
const test = require('tape');
const path = require('path');

test('Stats - MultiPoint Orphan', (t) => {
    const res = stats({
        input: String(path.resolve(__dirname, 'fixtures/stats.orphan-mp'))
    });

    t.deepEquals(res, {
        feats: 1,
        clusters: 0,
        invalid: 0,
        addresses: 2,
        intersections: 0,
        address_orphans: 1,
        network_orphans: 0,
        bounds: {}
    }, 'has 2 addresses');

    t.end();
});

test('Stats - GeometryCollection Orphan', (t) => {
    const res = stats({
        input: String(path.resolve(__dirname, 'fixtures/stats.orphan'))
    });

    t.deepEquals(res, {
        feats: 1,
        clusters: 0,
        invalid: 0,
        addresses: 2,
        intersections: 0,
        address_orphans: 1,
        network_orphans: 0,
        bounds: {}
    }, 'has 2 addresses');

    t.end();
});

test('Stats - MultiLine', (t) => {
    const res = stats({
        input: String(path.resolve(__dirname, 'fixtures/stats.orphan-double'))
    });

    t.deepEquals(res, {
        feats: 2,
        clusters: 0,
        invalid: 0,
        addresses: 4,
        intersections: 0,
        address_orphans: 2,
        network_orphans: 0,
        bounds: {}
    }, 'has 4 addresses');

    t.end();
});

test('Stats - Cluster', (t) => {
    const res = stats({
        input: String(path.resolve(__dirname, 'fixtures/stats.cluster'))
    });

    t.deepEquals(res, {
        feats: 1,
        clusters: 1,
        invalid: 0,
        addresses: 2,
        intersections: 1,
        address_orphans: 0,
        network_orphans: 0,
        bounds: {}
    }, 'has 1 cluster');

    t.end();
});

test('Stats - Network Orphan', (t) => {
    const res = stats({
        input: String(path.resolve(__dirname, 'fixtures/stats.network'))
    });

    t.deepEquals(res, {
        feats: 1,
        clusters: 0,
        invalid: 0,
        addresses: 0,
        intersections: 0,
        address_orphans: 0,
        network_orphans: 1,
        bounds: {}
    }, 'has 1 cluster');

    t.end();
});

test('Stats - Invalid', (t) => {
    const res = stats({
        input: String(path.resolve(__dirname, 'fixtures/stats.invalid'))
    });

    t.deepEquals(res, {
        feats: 1,
        clusters: 0,
        invalid: 1,
        addresses: 0,
        intersections: 0,
        address_orphans: 0,
        network_orphans: 0,
        bounds: {}
    }, 'has 1 cluster');

    t.end();
});

test('Stats - Real World Data', (t) => {
    const res = stats({
        input: String(path.resolve(__dirname, 'fixtures/stats.actual')),
        bounds: '/tmp/counties.geojson'
    });

    t.deepEquals(Object.keys(res).sort(), [
        'feats',
        'clusters',
        'addresses',
        'invalid',
        'intersections',
        'address_orphans',
        'network_orphans',
        'bounds'
    ].sort());

    t.equals(res.feats, 1);
    t.equals(res.clusters, 1);
    t.equals(res.invalid, 0);
    t.equals(res.addresses, 2);
    t.equals(res.intersections, 1);
    t.equals(res.address_orphans, 0);
    t.equals(res.network_orphans, 0);

    for (const bound of Object.keys(res.bounds)) {
        if (bound === '11001') {
            t.deepEquals(res.bounds[bound], {
                addresses: 2,
                intersections: 1,
                names: ['US Route 101'],
                synonyms: ['101', 'US Route', 'US Route 101'],
                custom: {
                    postcodes: 1,
                    accuracy: {
                        rooftop: 1,
                        parcel: 0,
                        point: 1
                    }
                }
            }, 'DC should have data');
        } else {
            t.deepEquals(res.bounds[bound], {
                addresses: 0,
                intersections: 0,
                names: [],
                synonyms: [],
                custom: {
                    postcodes: 0,
                    accuracy: {
                        rooftop: 0,
                        parcel: 0,
                        point: 0
                    }
                }
            }, bound);
        }
    }

    t.end();
});

const stats = require('../native/index.node').stats;
const test = require('tape');
const path = require('path');
const os = require('os');

test('Stats - MultiPoint Orphan', (t) => {
    let res = stats({
        input: String(path.resolve(__dirname, 'fixtures/stats.orphan-mp'))
    });

    t.deepEquals(res, {
        feats: 1,
        clusters: 0,
        invalid: 0,
        addresses: 2,
        intersections: 0,
        address_orphans: 1,
        network_orphans: 0
    }, 'has 2 addresses');

    t.end();
});

test('Stats - GeometryCollection Orphan', (t) => {
    let res = stats({
        input: String(path.resolve(__dirname, 'fixtures/stats.orphan'))
    });

    t.deepEquals(res, {
        feats: 1,
        clusters: 0,
        invalid: 0,
        addresses: 2,
        intersections: 0,
        address_orphans: 1,
        network_orphans: 0
    }, 'has 2 addresses');

    t.end();
});

test('Stats - MultiLine', (t) => {
    let res = stats({
        input: String(path.resolve(__dirname, 'fixtures/stats.orphan-double'))
    });

    t.deepEquals(res, {
        feats: 2,
        clusters: 0,
        invalid: 0,
        addresses: 4,
        intersections: 0,
        address_orphans: 2,
        network_orphans: 0
    }, 'has 4 addresses');

    t.end();
});

test('Stats - Cluster', (t) => {
    let res = stats({
        input: String(path.resolve(__dirname, 'fixtures/stats.cluster'))
    });

    t.deepEquals(res, {
        feats: 1,
        clusters: 1,
        invalid: 0,
        addresses: 2,
        intersections: 1,
        address_orphans: 0,
        network_orphans: 0
    }, 'has 1 cluster');

    t.end();
});

test('Stats - Network Orphan', (t) => {
    let res = stats({
        input: String(path.resolve(__dirname, 'fixtures/stats.network'))
    });

    t.deepEquals(res, {
        feats: 1,
        clusters: 0,
        invalid: 0,
        addresses: 0,
        intersections: 0,
        address_orphans: 0,
        network_orphans: 1
    }, 'has 1 cluster');

    t.end();
});

test('Stats - Invalid', (t) => {
    let res = stats({
        input: String(path.resolve(__dirname, 'fixtures/stats.invalid'))
    });

    t.deepEquals(res, {
        feats: 1,
        clusters: 0,
        invalid: 1,
        addresses: 0,
        intersections: 0,
        address_orphans: 0,
        network_orphans: 0
    }, 'has 1 cluster');

    t.end();
});

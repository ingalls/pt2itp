const map = require('../lib/map/osmium').map;
const test = require('tape');

test('Osmium', (t) => {
    t.equals(map({
        type: 'Feature',
        geometry: {
            type: 'Polygon'
        }
    },{}), false, 'Feat must be a (Multi)LineString geom');

    t.equals(map({
        type: 'Feature',
        geometry: {
            type: 'LineString'
        }
    },{}), false, 'Feat must have Properties');

    t.equals(map({
        type: 'Feature',
        properties: { },
        geometry: {
            type: 'LineString'
        }
    },{}), false, 'Feat must have Highway');

    t.equals(map({
        type: 'Feature',
        properties: {
            name: 'Test',
            highway: 'fake'
        },
        geometry: {
            type: 'LineString'
        }
    },{}), false, 'Feat must be valid Highway');

    t.equals(map({
        type: 'Feature',
        properties: {
            name: 'Test',
            highway: 'primary'
        },
        geometry: {
            type: 'LineString',
            coordinates: [[0,0], [0,0]]
        }
    },{}), false, 'Feat must have length');

    //Streets allowed to be missing names
    for (let type of ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'pedestrian', 'road']) {
        t.deepEquals(map({
            type: 'Feature',
            properties: {
                "@id": 1,
                highway: type
            },
            geometry: {
                type: 'LineString',
                coordinates: [[0,0],[1,1]]
            }
        },{}), [{ geometry: { type: 'LineString', coordinates: [[0,0], [1,1]] }, properties: { id: 1, street: '' }, type: 'Feature' }], `${type} is accepted`);
    }

    //Streets required to have names as they are lower quality tags
    for (let type of ['track', 'service', 'construction', 'proposed', 'footway']) {
        t.equals(map({
            type: 'Feature',
            properties: {
                highway: type
            },
            geometry: {
                type: 'LineString',
                coordinates: [[0,0],[1,1]]
            }
        },{}), false, `${type} requires name`);
    }

    for (let type of ['track', 'service', 'construction', 'proposed', 'footway']) {
        t.deepEquals(map({
            type: 'Feature',
            properties: {
                "@id": 2,
                highway: type,
                name: 'Test'
            },
            geometry: {
                type: 'LineString',
                coordinates: [[0,0],[1,1]]
            }
        },{}), [{ geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] }, properties: { id: 2, street: 'Test' }, type: 'Feature' }], `${type} is accepted w/ name`);
    }

    t.deepEquals(map({
        type: 'Feature',
        properties: {
            highway: 'motorway',
            "@id": 3,
            name: 'name',
            loc_name: 'loc_name',
            alt_name: 'alt_name',
            ref: 'ref'
        },
        geometry: {
            type: 'LineString',
            coordinates: [[0,0],[1,1]]
        }
    },{}), [
        { geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] }, properties: { id: 3, street: 'name' }, type: 'Feature' },
        { geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] }, properties: { id: 3, street: 'loc_name' }, type: 'Feature' },
        { geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] }, properties: { id: 3, street: 'alt_name' }, type: 'Feature' },
        { geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] }, properties: { id: 3, street: 'ref' }, type: 'Feature' }], 'AltNames');

    t.deepEquals(map({
        type: 'Feature',
        properties: {
            "@id": 4,
            highway: 'motorway',
            name: '1 Name;2 Name;3 Name'
        },
        geometry: {
            type: 'LineString',
            coordinates: [[0,0],[1,1]]
        }
    },{}), [
        { geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] }, properties: { id: 4, street: '1 Name' }, type: 'Feature'},
        { geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] }, properties: { id: 4, street: '2 Name' }, type: 'Feature'},
        { geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] }, properties: { id: 4, street: '3 Name' }, type: 'Feature'}
    ], 'OSM ; AltNames');

    t.deepEquals(map({
        type: 'Feature',
        properties: {
            '@id': 5,
            highway: 'motorway',
            name: '1 Name; '
        },
        geometry: {
            type: 'LineString',
            coordinates: [[0,0],[1,1]]
        }
    },{}), [{ geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] }, properties: { id: 5, street: '1 Name' }, type: 'Feature' }], 'OSM ; AltNames null');

    t.deepEquals(map({
        type: 'Feature',
        properties: {
            highway: 'motorway',
            "@id": 3,
            name: 'name',
            ref: 'US 66'
        },
        geometry: {
            type: 'LineString',
            coordinates: [[0,0],[1,1]]
        }
    },{country: "us", region: "pa"}), [
        { geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] }, properties: { id: 3, street: 'name' }, type: 'Feature' },
        { geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] }, properties: { id: 3, street: 'ROUTE 66' }, type: 'Feature' }], 'US Federal Route');

    t.deepEquals(map({
        type: 'Feature',
        properties: {
            highway: 'motorway',
            "@id": 3,
            name: 'name',
            ref: 'PA 66'
        },
        geometry: {
            type: 'LineString',
            coordinates: [[0,0],[1,1]]
        }
    },{country: "us", region: "pa"}), [
        { geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] }, properties: { id: 3, street: 'name' }, type: 'Feature' },
        { geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] }, properties: { id: 3, street: 'ROUTE 66' }, type: 'Feature' }], 'US State Route');

    // remove octothorpes from highway names
    t.deepEquals(map({
        type: 'Feature',
        properties: {
            highway: 'motorway',
            "@id": 3,
            name: 'name',
            ref: 'HWY #35'
        },
        geometry: {
            type: 'LineString',
            coordinates: [[0,0],[1,1]]
        }
    },{country: "us"}), [
        { geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] }, properties: { id: 3, street: 'name' }, type: 'Feature' },
        { geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] }, properties: { id: 3, street: 'HWY 35' }, type: 'Feature' }], 'HWY # replaced');

    t.end();
});


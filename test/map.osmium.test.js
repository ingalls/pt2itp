const map = require('../lib/inputs/osmium').map;
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

    // remove octothorpes from highway names
    t.deepEquals(map({
        type: 'Feature',
        properties: {
            street: [{
                display: 'name',
                priority: 0
            },{
                display: 'HWY #35',
                priority: -1
            }]

        },
        geometry: {
            type: 'LineString',
            coordinates: [[0,0],[1,1]]
        }
    },{country: 'us'}), { type: 'Feature', properties: { street: [ { display: 'name', priority: 0 }, { display: 'HWY 35', priority: -1 } ] }, geometry: { type: 'LineString', coordinates: [ [ 0, 0 ], [ 1, 1 ] ] } }, 'HWY # replaced');

    // Ensure drop overrides are dropped
    for (let name of [
        'Burger King Drive-in',
        'Burger King Drivein',
        'Burger King Drive in',
        'Burger King Drivethru',
        'Burger King Drive-through',
        'Burger King Drivethrough',
        'Burger King Drive through'
    ]) {
        t.deepEquals(map({
            type: 'Feature',
            properties: {
                highway: 'motorway',
                name: name
            },
            geometry: {
                type: 'LineString',
                coordinates: [[0,0],[1,1]]
            }
        }, { country: 'gb', region: 'pa'}), false, `${name} was dropped`);
    }

    // handle suffixless numeric streets
    let streets = [
        ['1 Ave', 'st'],
        ['2 St', 'nd'],
        ['3 Lane', 'rd'],
        ['4 St', 'th'],
        ['10 Ave', 'th'],
        ['11 Ave', 'th'],
        ['12 Ave', 'th'],
        ['13 Ave', 'th'],
        ['14 Ave', 'th'],
        ['21 Ave', 'st'],
        ['22 Ave', 'nd'],
        ['23 Ave', 'rd'],
        ['34 Ave', 'th'],
        ['101 St', 'st']
    ];
    streets.forEach((x) => {
        let res = map({
            type: 'Feature',
            properties: {
                street: [{
                    display: x[0],
                    priority: 0
                }]
            },
            geometry: {
                type: 'LineString',
                coordinates: [[0,0],[1,1]]
            }
        }, { country: 'us' });

        t.deepEquals(res, { type: 'Feature', properties: { street: [ { display: x[0], priority: 0 }, { display: x[0].split(' ')[0] + x[1] + ' ' + x[0].split(' ')[1], priority: -1 } ] }, geometry: { type: 'LineString', coordinates: [ [ 0, 0 ], [ 1, 1 ] ] } });

    });

    streets.forEach((x) => {
        let res = map({
            type: 'Feature',
            properties: {
                street: [{
                    display: x[0],
                    priority: 0
                }]
            },
            geometry: {
                type: 'LineString',
                coordinates: [[0,0],[1,1]]
            }
        }, { country: 'de' });

        t.equals(res.properties.street.length, 1, x[0] + ' unmodified when country=de');
    });

    for (let name of [
        'CR 123',
        'County Road 123'
    ]) {
        t.deepEquals(map({
            type: 'Feature',
            properties: {
                street: [{
                    display: name,
                    priority: 0
                }]
            },
            geometry: {
                type: 'LineString',
                coordinates: [[0,0],[1,1]]
            }
        }, { country: 'us', region: 'pa'}),
            { type: 'Feature', properties: { street: [
                { display: 'County Road 123', priority: 1 },
                { display: name, priority: 0 },
                { display: 'CR 123', priority: -1 },
        ] }, geometry: { type: 'LineString', coordinates: [ [ 0, 0 ], [ 1, 1 ] ] } }, `COUNTY ROAD: ${name}`);
    }

    for (let name of [
        'State Highway 123',
        'Highway 123',
        'Hwy 123',
        '123 hwy',
        '123 Highway',
        'Pennsylvania Hwy 123',
        'Pennsylvania highway 123',
        'PA 123'
    ]) {
        t.deepEquals(map({
            type: 'Feature',
            properties: {
                street: [{
                    display: name,
                    priority: 0
                }]
            },
            geometry: {
                type: 'LineString',
                coordinates: [[0,0],[1,1]]
            }
        }, { country: 'us', region: 'pa'}),
            { type: 'Feature', properties: { street: [
                { display: 'Pennsylvania Highway 123', priority: 1 },
                { display: name, priority: 0 },
                { display: 'PA 123', priority: -1 },
                { display: 'SR 123', priority: -1 },
                { display: 'State Highway 123', priority: -1 },
                { display: 'State Route 123', priority: -1 },
                { display: 'PA 123 Highway', priority: -2 },
                { display: 'Highway 123', priority: -2 }
        ] }, geometry: { type: 'LineString', coordinates: [ [ 0, 0 ], [ 1, 1 ] ] } }, `STATE HIGHWAY: ${name}`);
    }
    for (let name of [
        'State Highway 123',
        'Highway 123',
        'Hwy 123',
        '123 hwy',
        '123 Highway',
        'Pennsylvania Hwy 123',
        'Pennsylvania highway 123',
        'PA 123'
    ]) {
        t.deepEquals(map({
            type: 'Feature',
            properties: {
                street: [{
                    display: name,
                    priority: 0
                }]
            },
            geometry: {
                type: 'LineString',
                coordinates: [[0,0],[1,1]]
            }
        }, { country: 'us', region: 'pa'}),
            { type: 'Feature', properties: { street: [
                { display: 'Pennsylvania Highway 123', priority: 1 },
                { display: name, priority: 0 },
                { display: 'PA 123', priority: -1 },
                { display: 'SR 123', priority: -1 },
                { display: 'State Highway 123', priority: -1 },
                { display: 'State Route 123', priority: -1 },
                { display: 'PA 123 Highway', priority: -2 },
                { display: 'Highway 123', priority: -2 }
        ] }, geometry: { type: 'LineString', coordinates: [ [ 0, 0 ], [ 1, 1 ] ] } }, `STATE HIGHWAY: ${name}`);
    }

    for (let name of [
        'us-81',
        'US 81',
        'U.S. Route 81',
        'US Route 81',
        'US Rte 81',
        'US Hwy 81',
        'US Highway 81',
        'United States 81',
        'United States Route 81',
        'United States Highway 81',
        'United States Hwy 81',
    ]) {
        t.deepEquals(map({
            type: 'Feature',
            properties: {
                street: [{
                    display: name,
                    priority: 0
                }]
            },
            geometry: {
                type: 'LineString',
                coordinates: [[0,0],[1,1]]
            }
        }, { country: 'us', region: 'pa'}),
             { type: 'Feature', properties: { street: [
                 { display: 'US Route 81', priority: 1 },
                 { display: name, priority: 0 },
                 { display: 'US 81', priority: -1 },
                 { display: 'US Highway 81', priority: -1 },
                 { display: 'United States Route 81', priority: -1 },
                { display: 'United States Highway 81', priority: -1 }
             ] }, geometry: { type: 'LineString', coordinates: [ [ 0, 0 ], [ 1, 1 ] ] } }, `US ROUTE: ${name}`);
    }

    for (let name of [
        '101a',
        'NB-101a',
        'New Brunswick Route 101a',
        'New Brunswick Highway 101a',
        'New Brunswick Hwy 101a',
        'Route 101a',
        'Rte 101a',
        'Highway 101a',
        'Hwy 101a',
    ]) {
        t.deepEquals(map({
            type: 'Feature',
            properties: {
                street: [{
                    display: name,
                    priority: 0
                }]
            },
            geometry: {
                type: 'LineString',
                coordinates: [[0,0],[1,1]]
            }
        }, { country: "ca", region: "nb"}),
             { type: 'Feature', properties: { street: [
                 { display: name, priority: 0 },
                 { display: 'Highway 101a', priority: -1 },
                 { display: 'Route 101a', priority: -1 },
                 { display: 'NB 101a', priority: -2 },
                 { display: 'New Brunswick Route 101a', priority: -2 },
             ] }, geometry: { type: 'LineString', coordinates: [ [ 0, 0 ], [ 1, 1 ] ] } }, `Canadian Highway: ${name}`);
    }

    // German Drivethroughs
    t.deepEquals(map({
        type: 'Feature',
        properties: {
            street: [{
                display: 'Burger King Einfahrt',
                priority: 0
            }]
        },
        geometry: {
            type: 'LineString',
            coordinates: [[0,0],[1,1]]
        }
    },{ country: 'de' }), false, 'Einfahrt Removed');

    t.end();
});


const test = require('tape');
const asGeoJSON = require('../lib/map/asgeojson');
const turf = require('@turf/turf');

test('mergeFeatures - composition', (t) => {

    const itp = turf.multiLineString([[
        [ -71.31046691448468, 42.701550719883855 ],
        [ -71.3101749, 42.7012937 ]
    ]]);

    const pts = turf.multiPoint([
        [ -71.31014227867126, 42.70150325754059 ]
    ], {
        'carmen:addressnumber': [ 5 ]
    });

    const intersections = turf.multiPoint([
        [ -71.3101749, 42.7012937 ]
    ], {
        'carmen:intersections': [ 'Cross Street' ]
    });

    let feature = asGeoJSON.mergeFeatures(itp);

    t.equal(feature.geometry.type, 'GeometryCollection');
    t.equal(feature.geometry.geometries.length, 1)
    t.equal(feature.properties['carmen:addressnumber'], undefined);
    t.equal(feature.properties['carmen:intersections'], undefined);

    feature = asGeoJSON.mergeFeatures(itp, pts);

    t.equal(feature.geometry.type, 'GeometryCollection');
    t.equal(feature.geometry.geometries.length, 2)
    t.deepEqual(feature.properties['carmen:addressnumber'], [null, [5]]);
    t.equal(feature.properties['carmen:intersections'], undefined);

    feature = asGeoJSON.mergeFeatures(itp, undefined, intersections);

    t.equal(feature.geometry.type, 'GeometryCollection');
    t.equal(feature.geometry.geometries.length, 2)
    t.equal(feature.properties['carmen:addressnumber'], undefined);
    t.deepEqual(feature.properties['carmen:intersections'], [null, ['Cross Street']]);

    feature = asGeoJSON.mergeFeatures(itp, pts, intersections);

    t.equal(feature.geometry.type, 'GeometryCollection');
    t.equal(feature.geometry.geometries.length, 3)
    t.deepEqual(feature.properties['carmen:addressnumber'], [null, [5], null]);
    t.deepEqual(feature.properties['carmen:intersections'], [null, null, ['Cross Street']]);

    t.end();

});

test('addressPointsFeature - empty', (t) => {
    const feature = asGeoJSON.addressPointsFeature([]);
    t.equal(feature.geometry.type, 'MultiPoint');
    t.equal(feature.geometry.coordinates.length, 0)
    t.end();
});

test('addressPointsFeature - output: false', (t) => {
    const points = [{
        coords: [-79.43968176841736, 38.74250272111668],
        props: {
            number: 1,
            output: false,
            props: true
        }
    }];

    let feature = asGeoJSON.addressPointsFeature(points);
    t.equal(feature.geometry.type, 'MultiPoint');
    t.equal(feature.geometry.coordinates.length, 0)
    t.equal(feature.properties['carmen:addressnumber'].length, 0);

    t.end();
});

test('addressPointsFeature - output: true', (t) => {
    const points = [{
        coords: [-79.43968176841736, 38.74250272111668],
        props: {
            number: 1,
            output: true,
            props: {
                number: '2',
                other: true
            }
        }
    }];

    let feature = asGeoJSON.addressPointsFeature(points);
    t.equal(feature.geometry.type, 'MultiPoint');
    t.equal(feature.geometry.coordinates.length, 1)
    t.equal(feature.properties['carmen:addressnumber'].length, 1);
    t.equal(feature.properties['carmen:addressnumber'][0], 1);
    t.deepEqual(feature.properties.address_props, [{number: '2', other: true}]);

    t.end();
});

test('intersectionFeature - empty', (t) => {
    const feature = asGeoJSON.intersectionFeature([], 0);
    t.equal(feature.geometry.type, 'MultiPoint');
    t.equal(feature.geometry.coordinates.length, 0)
    t.end();
});

test('intersectionFeature - ok', (t) => {
    const points = [{
        coords: [-79.43968176841736, 38.74250272111668],
        props: {
            id: 2,
            a_id: 3,
            b_id: 1,
            a_street: [{
                freq: 1,
                priority: 0,
                display: 'WV Route 33',
                tokenized: [{ token: 'wv', token_type: null }, { token: 'rte', token_type: 'Way' }, { token: '33', token_type: 'Cardinal' }]
            },{
                freq: 1,
                priority: 0,
                display: 'Mountaineer Drive',
                tokenized: [{ token: 'mountaineer', token_type: null }, { token: 'dr', token_type: 'Way' }]
            }],
            b_street: [{
                freq: 1,
                priority: 0,
                display: 'Riverton Road South',
                tokenized: [{ token: 'riverton', token_type: null }, { token: 'rd', token_type: 'Way' }, { token: 's', token_type: 'Cardinal' }]
            }],
        }
    }];

    let feature = asGeoJSON.intersectionFeature(points, 0);
    t.equal(feature.geometry.type, 'MultiPoint');
    t.equal(feature.geometry.coordinates.length, 0)
    t.equal(feature.properties['carmen:intersections'].length, 0);

    feature = asGeoJSON.intersectionFeature(points, 1);
    t.equal(feature.geometry.type, 'MultiPoint',);
    t.equal(feature.properties['carmen:intersections'].join(), 'WV Route 33,Mountaineer Drive');
    t.equal(feature.geometry.coordinates.length, 2)

    feature = asGeoJSON.intersectionFeature(points, 3);
    t.equal(feature.geometry.type, 'MultiPoint');
    t.equal(feature.properties['carmen:intersections'].join(), 'Riverton Road South');
    t.equal(feature.geometry.coordinates.length, 1)
    t.end();
});

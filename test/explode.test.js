const turf = require('@turf/turf');
const test = require('tape');
const fs = require('fs');

// add test for feature that dedupe will collapse & should discard
const Explode = require('../lib/map/explode');

const db = require('./lib/db');
db.init(test);

test('explode', (t) => {
    t.test('explode', (q) => {
        const explode = new Explode();

        q.deepEquals(explode.join({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "Point",
                    "coordinates": [1,1]
                }
            }]
        }).features[0].geometry.coordinates, [ 1, 1 ] , 'Non joinstrings are ignored');

        q.end()
    });

    t.test('explode', (q) => {
        const explode = new Explode({
            degTolerance: 100
        });

        q.deepEquals(explode.join({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [[[0,0],[0,1]], [[0,1],[1,1]]]
                }
            }]
        }).features[0].geometry.coordinates, [ [ 0, 0 ], [ 0, 1 ], [ 1, 1 ] ], '90 deg angle');

        q.end();
    });

    t.test('explode', (q) => {
        const explode = new Explode({
            degTolerance: 30
        });

        q.deepEquals(explode.join({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [[[0,0],[0,1]], [[0,1],[1,1]]]
                }
            }]
        }).features[0].geometry.coordinates, [ [ 0, 0 ], [ 0, 1 ] ], '90 deg angle cutoff');

        q.end();
    });

    t.test('explode', (q) => {
        const explode = new Explode();

        q.deepEquals(explode.join({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [[[0,0],[1,1]]]
                }
            }]
        }).features[0].geometry.coordinates, [ [ 0, 0 ], [ 1, 1 ] ] , '-1->');

        q.end();
    });

    t.test('explode', (q) => {
        const explode = new Explode();

        q.deepEquals(explode.join({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [[[-1,-1],[0,0]],[[0,0],[1,1]]]
                }
            }]
        }).features[0].geometry.coordinates, [[-1,-1,], [0,0], [1,1]], '-1-> -2->');

        q.end();
    });

    t.test('explode', (q) => {
        const explode = new Explode();

        q.deepEquals(explode.join({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [[[0,0],[1,1]], [[-1,-1],[0,0]]]
                }
            }]
        }).features[0].geometry.coordinates, [[-1,-1,], [0,0], [1,1]], '-2-> -1->');

        q.end();
    });

    t.test('explode', (q) => {
        const explode = new Explode();

        q.deepEquals(explode.join({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [[[-1,-1],[0,0]],[[1,1],[0,0]]]
                }
            }]
        }).features[0].geometry.coordinates, [[-1,-1,], [0,0], [1,1]], '-1-> <-2-');

        q.end();
    });

    t.test('explode', (q) => {
        const explode = new Explode();

        q.deepEquals(explode.join({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [[[1,1],[0,0]], [[-1,-1],[0,0]]]
                }
            }]
        }).features[0].geometry.coordinates, [[1,1],[0,0],[-1,-1 ]], '-2-> <-1-');

        q.end();
    });

    t.test('explode', (q) => {
        const explode = new Explode();

        q.deepEquals(explode.join({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [[[-1,-1],[0,0]],[[2,2], [1,1]],[[0,0],[1,1]], [[3,3], [2,2]]]
                }
            }]
        }).features[0].geometry.coordinates, [[-1,-1,], [0,0], [1,1],[2,2],[3,3]], '-1-> -3-> <-2- <-4-');

        q.end();
    });

    t.test('explode', (q) => {
        const explode = new Explode();

        q.deepEquals(explode.join({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [[[3,3], [2,2]], [[4,4], [3,3]]]
                }
            }]
        }).features[0].geometry.coordinates, [ [ 4, 4 ], [ 3, 3 ], [ 2, 2 ] ], '<-1- <-2-');

        q.end();
    });

    t.test('explode', (q) => {
        const explode = new Explode();

        let res = explode.join({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [[[4,4],[3,3]], [[3,3],[2,2]]]
                }
            }]
        });
        q.pass('<-2- <-1-');
        q.deepEquals(res.features[0].geometry.coordinates, [ [ 4, 4 ], [ 3, 3 ], [ 2, 2 ] ]);
        q.deepEquals(res.features.length, 1);
        q.end();
    });

    t.test('explode', (q) => {
        const explode = new Explode();

        let res = explode.join({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [[[-1,-1],[0,0]],[[3,3], [2,2]],[[0,0],[1,1]], [[4,4], [3,3]]]
                }
            }]
        });

        q.ok(true, '-1-> -3->   <-2- <-4-');
        q.deepEquals(res.features[0].geometry.coordinates, [ [ -1, -1 ], [ 0, 0 ], [ 1, 1 ] ]);
        q.deepEquals(res.features[1].geometry.coordinates, [ [ 4, 4 ], [ 3, 3 ], [ 2, 2 ]]);
        q.deepEquals(res.features.length, 2);
        q.end();
    });

    //Don't connect where divided highways meet or else you can get odds and evens on the same side
    t.test('explode', (q) => {
        const explode = new Explode();

        let res = explode.join({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [
                        [ [ -66.15374565124512, 45.24081084565751 ], [ -66.15177154541016, 45.23967766228492 ], [ -66.15009784698486, 45.23816671596496 ], [ -66.14908933639526, 45.236489518498345 ], [ -66.14827394485474, 45.23441939571161 ] ],
                        [ [ -66.15344524383545, 45.241203677284545 ], [ -66.15202903747559, 45.24032735684951 ], [ -66.15102052688599, 45.23963233447991 ], [ -66.14992618560791, 45.23855956587336 ], [ -66.14919662475586, 45.23730545858455 ], [ -66.1483383178711, 45.23499359791086 ], [ -66.14827394485474, 45.23441939571161 ] ]
                    ]
                }
            }]
        });
        q.deepEquals(res.features[0].geometry.coordinates, [ [ -66.15374565124512, 45.24081084565751 ], [ -66.15177154541016, 45.23967766228492 ], [ -66.15009784698486, 45.23816671596496 ], [ -66.14908933639526, 45.236489518498345 ], [ -66.14827394485474, 45.23441939571161 ] ]);
        q.deepEquals(res.features[1].geometry.coordinates, [ [ -66.15344524383545, 45.241203677284545 ], [ -66.15202903747559, 45.24032735684951 ], [ -66.15102052688599, 45.23963233447991 ], [ -66.14992618560791, 45.23855956587336 ], [ -66.14919662475586, 45.23730545858455 ], [ -66.1483383178711, 45.23499359791086 ], [ -66.14827394485474, 45.23441939571161 ] ]);
        q.deepEquals(res.features.length, 2);
        q.end();
    });

    t.test('explode', (q) => {
        const explode = new Explode({
            noDistance: true
        });

        q.deepEquals(explode.join({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [[[0,0],[1,1]],[[0,0],[-1,-1]]]
                }
            }]
        }).features[0].geometry.coordinates, [[-1,-1,], [0,0], [1,1]], '<-2- -1->');

        q.end();
    });

    t.test('explode', (q) => {
        const explode = new Explode({
            noDistance: true
        });

        q.deepEquals(explode.join({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [[[0,0],[-1,-1]],[[0,0],[1,1]]]
                }
            }]
        }).features[0].geometry.coordinates, [[1,1,], [0,0], [-1,-1]], '<-1- -2->');

        q.end();
    });

    t.test('explode', (q) => {
        const explode = new Explode();

        q.deepEquals(explode.join({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [
                        [ [ -75.49416303634644, 39.78758228335605 ], [ -75.49162030220032, 39.78959385734031 ] ],
                        [ [ -75.49162030220032, 39.78959385734031 ], [ -75.49128770828247, 39.78975873784561 ] ]
                    ]
                }
            }]
        }).features[0].geometry.coordinates, [ [ -75.49416303634644, 39.78758228335605 ], [ -75.49162030220032, 39.78959385734031 ], [ -75.49128770828247, 39.78975873784561 ] ], '-1-> -2-> (real world)');

        q.end();
    });

    //Don't connect segements that will create a self intersecting geometry
    t.test('explode', (q) => {
        const explode = new Explode();

        let res = explode.join({
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [
                        [ [ -75.49405574798584, 39.78426800449771 ], [ -75.49497842788695, 39.78532331459258 ], [ -75.49482822418213, 39.78603234197182 ], [ -75.49418449401855, 39.786972204212276 ], [ -75.49416303634644, 39.78758228335605 ], [ -75.49162030220032, 39.78959385734031 ] ],
                        [ [ -75.49162030220032, 39.78959385734031 ], [ -75.49128770828247, 39.78975873784561 ], [ -75.49092292785645, 39.78970927373552 ], [ -75.49080491065979, 39.78933829177609 ], [ -75.49094438552856, 39.78882715779947 ], [ -75.49254298210144, 39.787524573398436 ], [ -75.49360513687134, 39.78587569701685 ], [ -75.49556851387024, 39.78637860850151 ] ]
                    ]
                }
            }]
        });

        q.deepEquals(res.features[0].geometry.coordinates, [ [ -75.49405574798584, 39.78426800449771 ], [ -75.49497842788695, 39.78532331459258 ], [ -75.49482822418213, 39.78603234197182 ], [ -75.49418449401855, 39.786972204212276 ], [ -75.49416303634644, 39.78758228335605 ], [ -75.49162030220032, 39.78959385734031 ] ]);
        q.deepEquals(res.features[1].geometry.coordinates, [ [ -75.49162030220032, 39.78959385734031 ], [ -75.49128770828247, 39.78975873784561 ], [ -75.49092292785645, 39.78970927373552 ], [ -75.49080491065979, 39.78933829177609 ], [ -75.49094438552856, 39.78882715779947 ], [ -75.49254298210144, 39.787524573398436 ], [ -75.49360513687134, 39.78587569701685 ], [ -75.49556851387024, 39.78637860850151 ] ]);
        q.deepEquals(res.features.length, 2);
        q.end();
    });

    t.end();
});

test('explode#split', (t) => {
    const explode = new Explode();

    let res = explode.split({
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[ -72.52744674682617, 45.900282732840324 ], [ -72.65018463134764, 45.79816953017265 ]]
            }
        }]
    });

    res = turf.truncate(res);

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/explode-halfthedup.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }

    t.deepEquals(res, require('./fixtures/explode-halfthedup.json'));
    t.end();
});

test('explode#dedupeBorks', (t) => {
    const explode = new Explode({
        noDistance: true
    });

    t.deepEquals(explode.join({
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "MultiLineString",
                "coordinates": [
                    [ [0,1], [1,0] ],
                    [ [1,1], [1,1] ]
                ]
            }
        }]
    }).features[0].geometry.coordinates, [[0,1], [1,0]], 'single-point dedupes are discarded');

    t.end();
});

test('explode#hasIntersect', (t) => {
    const explode = new Explode();

    t.equals(explode.hasIntersect(
        [[0,0], [1,1]],
        [[1,1], [2,2]]
    ), false, 'simple join');

    t.equals(explode.hasIntersect(
        [[0,0], [1,1], [0,1]],
        [[1,0], [0,1]]
    ), true, 'crossing');

    t.end();
});

test('explode#sortStreets', (t) => {
    t.test('explode#sortStreets - Basic - NonMultiFirst', (q) => {
        const explode = new Explode();

        let strs = [
            { id: 1, "type": "Feature", "properties": {}, "geometry": { "type": "LineString", "coordinates": [ [ -46.7578125, 37.71859032558816 ], [ -31.289062500000004, 37.71859032558816 ] ] } },
            { id: 2, "type": "Feature", "properties": {}, "geometry": { "type": "MultiLineString", "coordinates": [ [ [ -74.1796875, 22.268764039073968 ], [ 65.7421875, 24.5271348225978 ] ] ] } }
        ];

        strs.sort(explode.sortStreets);

        q.equals(strs[0].id, 1);
        q.equals(strs[1].id, 2);

        q.end();
    });

    t.test('explode#sortStreets - Basic - NonMultiFirst', (q) => {
        const explode = new Explode();

        let strs = [
            { id: 1, "type": "Feature", "properties": {}, "geometry": { "type": "MultiLineString", "coordinates": [ [ [ -74.1796875, 22.268764039073968 ], [ 65.7421875, 24.5271348225978 ] ] ] } },
            { id: 2, "type": "Feature", "properties": {}, "geometry": { "type": "LineString", "coordinates": [ [ -46.7578125, 37.71859032558816 ], [ -31.289062500000004, 37.71859032558816 ] ] } }
        ];

        strs.sort(explode.sortStreets);

        q.equals(strs[0].id, 2);
        q.equals(strs[1].id, 1);

        q.end();
    });

    t.test('explode#sortStreets - Basic', (q) => {
        const explode = new Explode();

        let strs = [
            { id: 1, "type": "Feature", "properties": {}, "geometry": { "type": "MultiLineString", "coordinates": [ [ [ -46.7578125, 37.71859032558816 ], [ -31.289062500000004, 37.71859032558816 ] ] ] } }, //Shorter Line
            { id: 2, "type": "Feature", "properties": {}, "geometry": { "type": "MultiLineString", "coordinates": [ [ [ -74.1796875, 22.268764039073968 ], [ 65.7421875, 24.5271348225978 ] ] ] } } //Longer Line
        ];

        strs.sort(explode.sortStreets);

        q.equals(strs[0].id, 2);
        q.equals(strs[1].id, 1);

        q.end();
    });

    t.test('explode#sortStreets - Basic - allready sorted', (q) => {
        const explode = new Explode();

        let strs = [
            { id: 1, "type": "Feature", "properties": {}, "geometry": { "type": "MultiLineString", "coordinates": [ [ [ -74.1796875, 22.268764039073968 ], [ 65.7421875, 24.5271348225978 ] ] ] } }, //Longer Line
            { id: 2, "type": "Feature", "properties": {}, "geometry": { "type": "MultiLineString", "coordinates": [ [ [ -46.7578125, 37.71859032558816 ], [ -31.289062500000004, 37.71859032558816 ] ] ] } } //Shorter Line
        ];

        strs.sort(explode.sortStreets);

        q.equals(strs[0].id, 1);
        q.equals(strs[1].id, 2);

        q.end();
    });

    t.end();
});

const interpolize = require('../lib/interpolize');
const turf = require('@turf/turf');
const test = require('tape');
const fs = require('fs');

test('Drop Low', (t) => {
    let d;

    d = interpolize.diff(22, 96);
    t.equals(interpolize.dropLow(22, d), 0);

    d = interpolize.diff(22, 10044);
    t.equals(interpolize.dropLow(22, d), 0);

    d = interpolize.diff(22, 246432642);
    t.equals(interpolize.dropLow(22, d), 0);

    d = interpolize.diff(105, 109);
    t.equals(interpolize.dropLow(105, d), 101);

    d = interpolize.diff(1246, 1948);
    t.equals(interpolize.dropLow(1246, d), 1000);

    d = interpolize.diff(1246, 42354264);
    t.equals(interpolize.dropLow(1246, d), 0);

    t.end();
});

test('Raise High', (t) => {
    let d;

    d = interpolize.diff(22, 96);
    t.equals(interpolize.raiseHigh(96, d), 100);

    d = interpolize.diff(22, 10044);
    t.equals(interpolize.raiseHigh(10044, d), 20000);

    d = interpolize.diff(22, 246432642);
    t.equals(interpolize.raiseHigh(246432642, d), 300000000);

    d = interpolize.diff(105, 109);
    t.equals(interpolize.raiseHigh(109, d), 111);

    d = interpolize.diff(1246, 1948);
    t.equals(interpolize.raiseHigh(1948, d), 2000);

    d = interpolize.diff(1246, 42354264);
    t.equals(interpolize.raiseHigh(42354264, d), 100000000);

    t.end();
});

test('ITP Sort', (t) => {
    t.test('ITP Sort: Basic', (q) => {
        let feats = [
            { id: 2, properties: { 'carmen:lfromhn': 22 } },
            { id: 4, properties: { 'carmen:lfromhn': 1423 } },
            { id: 1, properties: { 'carmen:lfromhn': 3 } },
            { id: 5, properties: { 'carmen:lfromhn': 4362 } },
            { id: 3, properties: { 'carmen:lfromhn': 43 } }
        ]

        feats.sort(interpolize.itpSort);

        q.equals(feats[0].id, 1);
        q.equals(feats[1].id, 2);
        q.equals(feats[2].id, 3);
        q.equals(feats[3].id, 4);
        q.equals(feats[4].id, 5);

        q.end();
    });

    t.test('ITP Sort: Nulls Last', (q) => {
        let feats = [
            { id: 1, properties: { 'carmen:lfromhn': 22 } },
            { id: 2, properties: { 'carmen:lfromhn': 1423 } },
            { id: 5, properties: { } },
            { id: 3, properties: { 'carmen:lfromhn': 4362 } },
            { id: 4, properties: { } }
        ]

        feats.sort(interpolize.itpSort);

        q.equals(feats[0].id, 1);
        q.equals(feats[1].id, 2);
        q.equals(feats[2].id, 3);
        q.equals(feats[3].id, 4);
        q.equals(feats[4].id, 5);

        q.end();
    });
});

test('lsb', (t) => {
    t.test('lsb forward', (q) => {
        let lsb = interpolize.lsb(
            [-79.37625288963318,38.83449282408381],
            [-79.37467575073241,38.83594698648804]
        )
        q.equal(lsb, 1);
        q.end();
    });

    t.test('lsb reverse', (q) => {
        let lsb = interpolize.lsb(
            [-79.37467575073241,38.83594698648804],
            [-79.37625288963318,38.83449282408381]
        )
        q.equal(lsb, 1);
        q.end();
    });
    t.end();
});

test('segments', (t) => {
    let seg = interpolize.segment(
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "LineString",
                "coordinates": [ [ -77.00275003910065, 38.963765608971286 ], [ -77.00335085391998, 38.963765608971286 ], [ -77.00378805398941, 38.9637697800411 ] ]
              }
        },
        0.01,
        'kilometers'
    )
    t.deepEquals(seg, [ [ -77.00275003910065, 38.963765608971286 ], [ -77.00335085391998, 38.963765608971286 ] ]);
    t.end();
});

test('Interpolize', (t) => {
    let segs = [{
        network: {
            type: "Feature",
            properties: { },
            geometry: {
                type: "LineString",
                coordinates: [
                    [-77.21062123775481,39.17687343078357],
                    [-77.21064805984497,39.1773849237293]
                ]
            }
        },
        address: {
            type: "Feature",
            properties: { },
            geometry: {
                type: "MultiPoint",
                coordinates: [
                    [-77.21054881811142,39.1769482836422],
                    [-77.21056759357452,39.17731007133552],
                    [-77.2107258439064,39.176966996844406],
                    [-77.21077680587769,39.177320467506085]
                ]
            }
        },
        number:  [
            { num: "8", output: true },
            { num: "10", output: true },
            { num: "9", output: true },
            { num:"11", output: true }
        ]
    }];

    let res = interpolize('Battleridge Place', segs);

    delete res.id;

    t.deepEquals(res, {
        type: 'Feature',
        properties: {
            'carmen:text': 'Battleridge Place',
            "carmen:center": [ -77.2107258439064, 39.176966996844406 ],
            'carmen:rangetype':'tiger',
            'carmen:parityl':[ ['O'], null],
            'carmen:lfromhn':[ [1] , null],
            'carmen:ltohn':  [ [21], null],
            'carmen:parityr':[['E'], null],
            'carmen:rfromhn':[ [0], null],
            'carmen:rtohn':  [ [20] ,null],
            'carmen:addressnumber':[null,['8','9','10','11']]
        },
        'geometry':{
            'type':'GeometryCollection',
            'geometries':[{
                'type':'MultiLineString',
                'coordinates':[[[-77.21062123775481,39.17687343078357],[-77.21064805984497,39.1773849237293]]]
            },{
                'type':'MultiPoint',
                'coordinates': [[-77.21054881811142,39.1769482836422],[-77.2107258439064,39.176966996844406], [-77.21056759357452,39.17731007133552], [-77.21077680587769,39.177320467506085]]
            }]
        }
    }, 'has expected props');

    t.end();
});

/*
 *  2  4  6  8                            4  6  8 10 12
 * ---------------------------------------------------
 *
 * NH has several instances of continuous roads that have identical housenumbers. Since the road is so long the 4 on the left is in one town
 * and the 4 on the right another. Since the road is continuous however the network is a single cluster and although the points will be grouped into
 * two separate clusters, they will be merged together by the adoption module. This test ensures these issues are detected and the network_cluster output as
 * two unique clusters
 */
test('Interpolize - Continious network - unique address duplicate num', (t) => {
    let segs = [{
        network: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[ -72.52744674682617, 45.900282732840324 ], [ -72.65018463134764, 45.79816953017265 ]]
            }
        },
        address: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [ -72.65104293823242, 45.80846108136044 ],
                    [ -72.64297485351562, 45.80810210576385 ],
                    [ -72.6416015625, 45.81372579098662 ],
                    [ -72.63490676879883, 45.81587939239973 ],

                    [ -72.55027770996094, 45.886423557648435 ],
                    [ -72.54547119140625, 45.8909640131969 ],
                    [ -72.53094434738159, 45.8986550563925 ],
                    [ -72.52995729446411, 45.89973022416613 ],
                    [ -72.52869129180908, 45.90050672127712 ]
                ]
            }
        },
        number:  [
            { num: "2", output: true },
            { num: "4", output: true },
            { num: "6", output: true },
            { num:"8", output: true },
            { num: "4", output: true },
            { num: "6", output: true },
            { num: "8", output: true },
            { num: "10", output: true },
            { num: "12", output: true }
        ]
    }];

    let res = interpolize('Complicated Ave', segs, { debug: true });

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-halfthedup.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-halfthedup.json'));
    t.end();
});

/*
 *  2  4  6  8                            10  8  6 4 2
 * ---------------------------------------------------
 *
 * NH has several instances of continuous roads that have identical housenumbers. Since the road is so long the 4 on the left is in one town
 * and the 4 on the right another. Since the road is continuous however the network is a single cluster and although the points will be grouped into
 * two separate clusters, they will be merged together by the adoption module. This test ensures these issues are detected and the network_cluster output as
 * two unique clusters
 */
test('Interpolize - Continious network - unique address duplicate num - different order', (t) => {
    let segs = [{
        network: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[ -72.52744674682617, 45.900282732840324 ], [ -72.65018463134764, 45.79816953017265 ]]
            }
        },
        address: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [ -72.65104293823242, 45.80846108136044 ],
                    [ -72.64297485351562, 45.80810210576385 ],
                    [ -72.6416015625, 45.81372579098662 ],
                    [ -72.63490676879883, 45.81587939239973 ],

                    [ -72.55027770996094, 45.886423557648435 ],
                    [ -72.54547119140625, 45.8909640131969 ],
                    [ -72.53094434738159, 45.8986550563925 ],
                    [ -72.52995729446411, 45.89973022416613 ],
                    [ -72.52869129180908, 45.90050672127712 ]
                ]
            }
        },
        number:  [
            { num: "2", output: true },
            { num: "4", output: true },
            { num: "6", output: true },
            { num:"8", output: true },
            { num: "10", output: true },
            { num: "8", output: true },
            { num: "6", output: true },
            { num: "4", output: true },
            { num: "2", output: true }
        ]
    }];

    let res = interpolize('Complicated Ave', segs, { debug: true });

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-halfthedup2.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-halfthedup2.json'));
    t.end();
});

/*
 * . |                  .
 *   | .
 * . |
 *   | .
 * . |
 * These errors typically happen due to data errors where an identically named street is missing from the source
 * We retain the address point but don't use it to calculate the ITP
 */
test('Interpolize - Ignore addresses above (average * 5) away from line', (t) => {
    let segs = [{
        network: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [ [ -64.27054524421692, 44.54747368148878 ], [ -64.26584601402283, 44.548261225872096 ] ]
            }
        },
        address: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [-64.27004098892212, 44.54781775558832],
                    [-64.26878571510315, 44.548093013403566],
                    [-64.26747679710388, 44.54839885389387],
                    [-64.26645755767822, 44.548635879168515],
                    [-64.26933288574217, 44.55552448238052]
                ]
            }
        },
        number:  [
            { num: "8", output: true },
            { num: "10", output: true },
            { num: "12", output: true },
            { num:"14", output: true },
            { num: "16000", output: true }
        ]
    }];

    let res = interpolize('Hill Top Road', segs, { debug: true });

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-deviant.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-deviant.json'));
    t.end();
});

test('Interpolize - Addr past line end', (t) => {
    let segs = [{
        network: {
            type: "Feature",
            properties: { },
            geometry: {
                type: "LineString",
                coordinates: [
                    [-77.21062123775481,39.17687343078357],
                    [-77.21064805984497,39.1773849237293]
                ]
            }
        },
        address: {
            type: "Feature",
            properties: { },
            geometry: {
                type: "MultiPoint",
                coordinates: [
                    [-77.21054881811142,39.1769482836422],
                    [-77.21056759357452,39.17731007133552],
                    [-77.2107258439064,39.176966996844406],
                    [-77.21077680587769,39.177320467506085],
                    [ -77.21077412366867,39.17755334132392],
                    [ -77.21056491136551,39.17757413359157 ]
                ]
            }
        },
        number:  [
            { num: "8", output: true },
            { num: "10", output: true },
            { num: "9", output: true },
            { num:"11", output: true },
            { num: "13", output: true },
            { num: "12", output: true }
        ]
    }];

    let res = interpolize('Battleridge Place', segs, { debug: true });

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-pastline.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-pastline.json'));
    t.end();
});

test('Interpolize - Addr past line end - opposite', (t) => {
    let segs = [{
        network: {
            type: "Feature",
            properties: { },
            geometry: {
                type: "LineString",
                coordinates: [
                    [-77.21062123775481,39.17687343078357],
                    [-77.21064805984497,39.1773849237293]
                ]
            }
        },
        address: {
            type: "Feature",
            properties: { },
            geometry: {
                type: "MultiPoint",
                coordinates: [
                    [-77.21054881811142,39.1769482836422],
                    [-77.21056759357452,39.17731007133552],
                    [-77.2107258439064,39.176966996844406],
                    [-77.21077680587769,39.177320467506085],
                    [-77.21078217029572, 39.17767393639073],
                    [ -77.21056491136551,39.17757413359157 ]
                ]
            }
        },
        number:  [
            { num: "8", output: true },
            { num: "10", output: true },
            { num: "9", output: true },
            { num:"11", output: true },
            { num: "13", output: true },
            { num: "12", output: true }
        ]
    }];

    let res = interpolize('Battleridge Place', segs, { debug: true });

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-pastline-opp.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-pastline-opp.json'));
    t.end();
});

test('Interpolize - Addr past line end - bend', (t) => {
    let segs = [{
        network: {
            type: "Feature",
            properties: { },
            geometry: {
                type: "LineString",
                coordinates: [
                    [ -77.21002042293549, 39.17696283835544 ],
                    [ -77.20934987068176, 39.17688382701869 ],
                    [ -77.20870077610016, 39.177050166571725 ]
                ]
            }
        },
        address: {
            type: "Feature",
            properties: { },
            geometry: {
                type: "MultiPoint",
                coordinates: [
                    [ -77.20983803272247, 39.17702937414912 ],
                    [ -77.20847547054291, 39.177740471511456 ],
                    [ -77.20990777015686, 39.17674659659119 ],
                    [ -77.20825552940369, 39.1777238377372 ]
                ]
            }
        },
        number:  [
            { num: "2", output: true },
            { num: "4", output: true },
            { num: "1", output: true },
            { num:"3", output: true }
        ]
    }];

    let res = interpolize('Battleridge Place', segs, { debug: true });

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-pastline-bend.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-pastline-bend.json'));
    t.end();
});

test('Interpolize - Addr past line end - bend - reverse', (t) => {
    let segs = [{
        network: {
            type: "Feature",
            properties: { },
            geometry: {
                type: "LineString",
                coordinates: [
                    [ -77.20870077610016, 39.177050166571725 ],
                    [ -77.20934987068176, 39.17688382701869 ],
                    [ -77.21002042293549, 39.17696283835544 ]
                ]
            }
        },
        address: {
            type: "Feature",
            properties: { },
            geometry: {
                type: "MultiPoint",
                coordinates: [
                    [ -77.20983803272247, 39.17702937414912 ],
                    [ -77.20847547054291, 39.177740471511456 ],
                    [ -77.20990777015686, 39.17674659659119 ],
                    [ -77.20825552940369, 39.1777238377372 ]
                ]
            }
        },
        number:  [
            { num: "2", output: true },
            { num: "4", output: true },
            { num: "1", output: true },
            { num:"3", output: true }
        ]
    }];

    let res = interpolize('Battleridge Place', segs, { debug: true });

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-pastline-bend-rev.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-pastline-bend-rev.json'));
    t.end();
});

/*
 * . |--
 *   | .
 * . |
 *   | .
 * . |
 */
test('Interpolize - Hooked Road', (t) => {
    let segs = [{
        network: {
            type: "Feature",
            properties: { },
            geometry: {
                type: "LineString",
                coordinates: [
                    [ -77.19249486923218, 39.090421398604306 ],
                    [ -77.19209790229797, 39.09155388949448 ],
                    [ -77.19150245189667, 39.091428983303274 ]
                ]
            }
        },
        address: {
            type: "Feature",
            properties: { },
            geometry: {
                type: "MultiPoint",
                coordinates: [
                    [-77.19264507293701,39.090575451742545],
                    [-77.19256460666656,39.09079612186787],
                    [-77.19247877597809,39.09103344557164],
                    [-77.19239830970764,39.0912208058263],
                    [-77.19228029251099,39.091412329127714],
                    [-77.19221591949463,39.09162466957128],
                    [-77.19157218933105,39.090342290105255],
                    [-77.19144344329834,39.090587942522795],
                    [-77.19135761260986,39.09077946754287],
                    [-77.19130396842955,39.09100430059841],
                    [-77.19125032424927,39.09124995071007]
                ]
            }
        },
        number:  [
            { num: "2", output: true },
            { num: "4", output: true },
            { num: "6", output: true },
            { num: "8", output: true },
            { num: "10", output: true },
            { num: "12", output: true },
            { num: "1", output: true },
            { num: "3", output: true },
            { num: "5", output: true },
            { num: "7", output: true },
            { num: "9", output: true }
        ]
    }];

    let res = interpolize('Tommy Bell Pl', segs, { debug: true });

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/left-hook.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }

    t.deepEquals(res, require('./fixtures/left-hook.json'));
    t.end();
});

test('Interpolize - No address cluster', (t) => {
    let segs = [{
        network: {
            type: "Feature",
            properties: { },
            geometry: {
                type: "LineString",
                coordinates: [
                    [ -77.19249486923218, 39.090421398604306 ],
                    [ -77.19209790229797, 39.09155388949448 ],
                    [ -77.19150245189667, 39.091428983303274 ]
                ]
            }
        }
    }];

    let res = interpolize('Tommy Bell Pl', segs);
    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/left-hook-network.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }

    t.deepEquals(res, require('./fixtures/left-hook-network.json'));
    t.end();
});

'use strict';

const interpolize = require('../lib/map/interpolize');
const Split = require('../lib/map/split').Split;
const test = require('tape');
const fs = require('fs');

test('Drop Low', (t) => {
    let d;

    d = interpolize.diff(22, 96);
    t.equals(d, 100);
    t.equals(interpolize.dropLow(22, d), 0);

    d = interpolize.diff(22, 10044);
    t.equals(d, 1000);
    t.equals(interpolize.dropLow(22, d), 0);

    d = interpolize.diff(22, 246432642);
    t.equals(d, 10000000);
    t.equals(interpolize.dropLow(22, d), 0);

    d = interpolize.diff(105, 109);
    t.equals(d, 10);
    t.equals(interpolize.dropLow(105, d), 101);

    d = interpolize.diff(1246, 1948);
    t.equals(d, 1000);
    t.equals(interpolize.dropLow(1246, d), 1000);

    d = interpolize.diff(1246, 42354264);
    t.equals(d, 10000000);
    t.equals(interpolize.dropLow(1246, d), 0);

    d = interpolize.diff(0, 6500);
    t.equals(d, 1000);
    t.equals(interpolize.dropLow(1246, d), 1000);

    d = interpolize.diff(2500, 6500);
    t.equals(d, 1000);
    t.equals(interpolize.dropLow(2500, d), 2000);

    t.end();
});

test('Raise High', (t) => {
    let d;

    d = interpolize.diff(22, 96);
    t.equals(d, 100);
    t.equals(interpolize.raiseHigh(96, d), 100);

    d = interpolize.diff(22, 10044);
    t.equals(d, 1000);
    t.equals(interpolize.raiseHigh(10044, d), 11000);

    d = interpolize.diff(22, 246432642);
    t.equals(d, 10000000);
    t.equals(interpolize.raiseHigh(246432642, d), 250000000);

    d = interpolize.diff(105, 109);
    t.equals(d, 10);
    t.equals(interpolize.raiseHigh(109, d), 111);

    d = interpolize.diff(1246, 1948);
    t.equals(d, 1000);
    t.equals(interpolize.raiseHigh(1948, d), 2000);

    d = interpolize.diff(1246, 42354264);
    t.equals(d, 10000000);
    t.equals(interpolize.raiseHigh(42354264, d), 50000000);

    t.end();
});

test('ITP Sort', (t) => {
    t.test('ITP Sort: Basic', (q) => {
        const feats = [
            { id: 2, lstart: { number: 22 } },
            { id: 4, lstart: { number: 1423 } },
            { id: 1, lstart: { number: 3 } },
            { id: 5, lstart: { number: 4362 } },
            { id: 3, lstart: { number: 43 } }
        ].map((v) => { return  { range: v };});

        feats.sort(interpolize.itpSort);

        q.equals(feats.map((v) => v.range.id).join(' '), '1 2 3 4 5');

        q.end();
    });

    t.test('ITP Sort: Nulls Last', (q) => {
        const feats = [
            { id: 1, lstart: { number: 22 } },
            { id: 2, lstart: { number: 1423 } },
            { id: 5 },
            { id: 3, lstart: { number: 4362 } },
            { id: 4 }
        ].map((v) => { return  { range: v };});

        feats.sort(interpolize.itpSort);

        q.equals(feats.map((v) => v.range.id).join(' '), '1 2 3 4 5');

        q.end();
    });
});

test('lsb', (t) => {
    t.test('lsb forward', (q) => {
        const lsb = interpolize.lsb(
            [-79.37625288963318,38.83449282408381],
            [-79.37467575073241,38.83594698648804]
        );
        q.equal(lsb, 1);
        q.end();
    });

    t.test('lsb reverse', (q) => {
        const lsb = interpolize.lsb(
            [-79.37467575073241,38.83594698648804],
            [-79.37625288963318,38.83449282408381]
        );
        q.equal(lsb, 1);
        q.end();
    });
    t.end();
});

test('segments', (t) => {
    const seg = interpolize.segment(
        {
            'type': 'Feature',
            'properties': {},
            'geometry': {
                'type': 'LineString',
                'coordinates': [[-77.00275003910065, 38.963765608971286], [-77.00335085391998, 38.963765608971286], [-77.00378805398941, 38.9637697800411]]
            }
        },
        0.01,
        'kilometers'
    );
    t.deepEquals(seg, [[-77.00275003910065, 38.963765608971286], [-77.00335085391998, 38.963765608971286]]);
    t.end();
});

test('Interpolize', (t) => {
    const seg = {
        network: {
            type: 'Feature',
            properties: { },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-77.21062123775481,39.17687343078357],
                    [-77.21064805984497,39.1773849237293]
                ]
            }
        }
    };
    seg.addressPoints = placePointsAndProps(seg.network, [
        [-77.21054881811142,39.1769482836422],
        [-77.21056759357452,39.17731007133552],
        [-77.2107258439064,39.176966996844406],
        [-77.21077680587769,39.177320467506085]
    ], [
        { number: '8', output: true, props: {} },
        { number: '10', output: true, props: {} },
        { number: '9', output: true, props: {} },
        { number:'11', output: true, props: {} }
    ]);

    let res = interpolize.interpolize([seg], { dropLow: true, raiseHigh: true });
    res = legacyFormatter(res, seg.addressPoints);

    delete res.id;

    t.equals(res.type, 'Feature', 'is feature');

    t.deepEquals(res.properties, {
        address_props: [{}, {}, {}, {}],
        'carmen:rangetype':'tiger',
        'carmen:parityl':[['O', 'O'], null],
        'carmen:lfromhn':[[1, 9] , null],
        'carmen:ltohn':  [[9, 11], null],
        'carmen:parityr':[[null,'E'], null],
        'carmen:rfromhn':[[null, 8], null],
        'carmen:rtohn':  [[null, 10] ,null],
        'carmen:addressnumber':[null,['8','10','9','11']]
    }, 'has expected properties');

    t.deepEquals(res.geometry, {
        'type':'GeometryCollection',
        'geometries':[{
            'type':'MultiLineString',
            'coordinates':[[[-77.21062123775481,39.17687343078357],[-77.21062630866005,39.17697013213097]],[[-77.21062123775481,39.17687343078357],[-77.21064805984497,39.1773849237293]]]
        },{
            type: 'MultiPoint',
            coordinates: [
                [-77.21054881811142, 39.1769482836422],
                [-77.21056759357452, 39.17731007133552],
                [-77.2107258439064, 39.176966996844406],
                [-77.21077680587769, 39.177320467506085]
            ]
        }]
    }, 'has expected geometry');

    t.end();
});

function legacyFormatter(itps, addressPoints) {
    const asGeoJSON = require('../lib/map/asgeojson');
    if (addressPoints === undefined) {
        return asGeoJSON.mergeFeatures(itps);
    } else {
        return asGeoJSON.mergeFeatures(itps, asGeoJSON.addressPointsFeature(addressPoints));
    }
}

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
    const seg = {
        network: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[-72.52744674682617, 45.900282732840324], [-72.65018463134764, 45.79816953017265]]
            }
        }
    };
    seg.addressPoints = placePointsAndProps(seg.network, [
        [-72.65104293823242, 45.80846108136044],
        [-72.64297485351562, 45.80810210576385],
        [-72.6416015625, 45.81372579098662],
        [-72.63490676879883, 45.81587939239973],
        [-72.55027770996094, 45.886423557648435],
        [-72.54547119140625, 45.8909640131969],
        [-72.53094434738159, 45.8986550563925],
        [-72.52995729446411, 45.89973022416613],
        [-72.52869129180908, 45.90050672127712]
    ], [
        { number: '2', output: true, props: {} },
        { number: '4', output: true, props: {} },
        { number: '6', output: true, props: {} },
        { number:'8', output: true, props: {} },
        { number: '4', output: true, props: {} },
        { number: '6', output: true, props: {} },
        { number: '8', output: true, props: {} },
        { number: '10', output: true, props: {} },
        { number: '12', output: true, props: {} }
    ]);

    let res = interpolize.interpolize([seg], { debug: true, dropLow: true, raiseHigh: true });
    res = legacyFormatter(res, seg.addressPoints);

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
    // TODO: Confirm that repated numbers in the range is not concerning
    // 'carmen:rfromhn': [ [ 2, 2, 2 ], null ], 'carmen:rtohn': [ [ 0, 2, 10 ], null ]
    const seg = {
        network: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[-72.52744674682617, 45.900282732840324], [-72.65018463134764, 45.79816953017265]]
            }
        }
    };
    seg.addressPoints = placePointsAndProps(seg.network, [
        [-72.65104293823242, 45.80846108136044],
        [-72.64297485351562, 45.80810210576385],
        [-72.6416015625, 45.81372579098662],
        [-72.63490676879883, 45.81587939239973],
        [-72.55027770996094, 45.886423557648435],
        [-72.54547119140625, 45.8909640131969],
        [-72.53094434738159, 45.8986550563925],
        [-72.52995729446411, 45.89973022416613],
        [-72.52869129180908, 45.90050672127712]
    ], [
        { number: '2', output: true, props: {} },
        { number: '4', output: true, props: {} },
        { number: '6', output: true, props: {} },
        { number:'8', output: true, props: {} },
        { number: '10', output: true, props: {} },
        { number: '8', output: true, props: {} },
        { number: '6', output: true, props: {} },
        { number: '4', output: true, props: {} },
        { number: '2', output: true, props: {} }
    ]);

    let res = interpolize.interpolize([seg], { debug: true, dropLow: true, raiseHigh: true  });
    res = legacyFormatter(res, seg.addressPoints);

    delete res.id;

    // TODO this test should fail. we shoud test that two features are generated.

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
test('Interpolize - Ignore addresses above far away from line', (t) => {
    const seg = {
        network: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[-64.27054524421692, 44.54747368148878], [-64.26584601402283, 44.548261225872096]]
            }
        }
    };
    seg.addressPoints = placePointsAndProps(seg.network, [
        [-64.27004098892212, 44.54781775558832],
        [-64.26878571510315, 44.548093013403566],
        [-64.26747679710388, 44.54839885389387],
        [-64.26645755767822, 44.548635879168515],
        [-64.26933288574217, 44.55552448238052]
    ], [
        { number: '8', output: true, props: {} },
        { number: '10', output: true, props: {} },
        { number: '12', output: true, props: {} },
        { number:'14', output: true, props: {} },
        { number: '16000', output: true, props: {} }
    ]);

    let res = interpolize.interpolize([seg], { debug: true, dropLow: true, raiseHigh: true  });
    res = legacyFormatter(res, seg.addressPoints);

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-deviant.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-deviant.json'));
    t.end();
});

test('Interpolize - Addr past line end', (t) => {
    const seg = {
        network: {
            type: 'Feature',
            properties: { },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-77.21062123775481,39.17687343078357],
                    [-77.21064805984497,39.1773849237293]
                ]
            }
        }
    };
    seg.addressPoints = placePointsAndProps(seg.network, [
        [-77.21054881811142,39.1769482836422],
        [-77.21056759357452,39.17731007133552],
        [-77.2107258439064,39.176966996844406],
        [-77.21077680587769,39.177320467506085],
        [-77.21077412366867,39.17755334132392],
        [-77.21056491136551,39.17757413359157]
    ],[
        { number: '8', output: true, props: {} },
        { number: '10', output: true, props: {} },
        { number: '9', output: true, props: {} },
        { number:'11', output: true, props: {} },
        { number: '13', output: true, props: {} },
        { number: '12', output: true, props: {} }
    ]);

    let res = interpolize.interpolize([seg], { debug: true, dropLow: true, raiseHigh: true  });
    res = legacyFormatter(res, seg.addressPoints);

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-pastline.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-pastline.json'));
    t.end();
});

test('Interpolize - Addr past line end - opposite', (t) => {
    const seg = {
        network: {
            type: 'Feature',
            properties: { },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-77.21062123775481,39.17687343078357],
                    [-77.21064805984497,39.1773849237293]
                ]
            }
        }
    };

    seg.addressPoints = placePointsAndProps(seg.network, [
        [-77.21054881811142,39.1769482836422],
        [-77.21056759357452,39.17731007133552],
        [-77.2107258439064,39.176966996844406],
        [-77.21077680587769,39.177320467506085],
        [-77.21078217029572, 39.17767393639073],
        [-77.21056491136551,39.17757413359157]
    ], [
        { number: '8', output: true, props: {} },
        { number: '10', output: true, props: {} },
        { number: '9', output: true, props: {} },
        { number:'11', output: true, props: {} },
        { number: '13', output: true, props: {} },
        { number: '12', output: true, props: {} }
    ]);

    let res = interpolize.interpolize([seg], { debug: true, dropLow: true, raiseHigh: true  });
    res = legacyFormatter(res, seg.addressPoints);

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-pastline-opp.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-pastline-opp.json'));
    t.end();
});

test('Interpolize - Addr past line end - bend', (t) => {
    const seg = {
        network: {
            type: 'Feature',
            properties: { },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-77.21002042293549, 39.17696283835544],
                    [-77.20934987068176, 39.17688382701869],
                    [-77.20870077610016, 39.177050166571725]
                ]
            }
        }
    };
    seg.addressPoints = placePointsAndProps(seg.network, [
        [-77.20983803272247, 39.17702937414912],
        [-77.20847547054291, 39.177740471511456],
        [-77.20990777015686, 39.17674659659119],
        [-77.20825552940369, 39.1777238377372]
    ], [
        { number: '2', output: true, props: {} },
        { number: '4', output: true, props: {} },
        { number: '1', output: true, props: {} },
        { number:'3', output: true, props: {} }
    ]);

    let res = interpolize.interpolize([seg], { debug: true, dropLow: true, raiseHigh: true });
    res = legacyFormatter(res, seg.addressPoints);

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-pastline-bend.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-pastline-bend.json'));
    t.end();
});

test('Interpolize - Addr past line end - bend - reverse', (t) => {
    const seg = {
        network: {
            type: 'Feature',
            properties: { },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-77.20870077610016, 39.177050166571725],
                    [-77.20934987068176, 39.17688382701869],
                    [-77.21002042293549, 39.17696283835544]
                ]
            }
        }
    };
    seg.addressPoints = placePointsAndProps(seg.network, [
        [-77.20983803272247, 39.17702937414912],
        [-77.20847547054291, 39.177740471511456],
        [-77.20990777015686, 39.17674659659119],
        [-77.20825552940369, 39.1777238377372]
    ],
    [
        { number: '2', output: true, props: {} },
        { number: '4', output: true, props: {} },
        { number: '1', output: true, props: {} },
        { number:'3', output: true, props: {} }
    ]);

    let res = interpolize.interpolize([seg], { debug: true, dropLow: false, raiseHigh: true  });
    res = legacyFormatter(res, seg.addressPoints);

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
    const seg = {
        network: {
            type: 'Feature',
            properties: { },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-77.19249486923218, 39.090421398604306],
                    [-77.19209790229797, 39.09155388949448],
                    [-77.19150245189667, 39.091428983303274]
                ]
            }
        }
    };

    seg.addressPoints = placePointsAndProps(seg.network, [
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
    ],
    [
        { number: '2', output: true, props: {} },
        { number: '4', output: true, props: {} },
        { number: '6', output: true, props: {} },
        { number: '8', output: true, props: {} },
        { number: '10', output: true, props: {} },
        { number: '12', output: true, props: {} },
        { number: '1', output: true, props: {} },
        { number: '3', output: true, props: {} },
        { number: '5', output: true, props: {} },
        { number: '7', output: true, props: {} },
        { number: '9', output: true, props: {} }
    ]);

    let res = interpolize.interpolize([seg], { debug: true, dropLow: true, raiseHigh: true  });
    res = legacyFormatter(res, seg.addressPoints);

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/left-hook.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }

    t.deepEquals(res, require('./fixtures/left-hook.json'));
    t.end();
});

test('Interpolize - No address cluster', (t) => {
    const segs = [{
        network: {
            type: 'Feature',
            properties: { },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-77.19249486923218, 39.090421398604306],
                    [-77.19209790229797, 39.09155388949448],
                    [-77.19150245189667, 39.091428983303274]
                ]
            }
        }
    }];

    const res = interpolize.interpolize(segs);
    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/left-hook-network.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }

    t.deepEquals(res, require('./fixtures/left-hook-network.json'));
    t.end();
});

test('Interpolize - sequence', (t) => {
    const segs = require('./fixtures/interpolize_sequence.json')[0].map((v) => {
        const network = {
            type: 'FeatureCollection',
            features: [v.network]
        };
        return {
            network: v.network,
            addressPoints: Split.attachPoints(network, v.address.geometry.coordinates, v.number)
        };
    });
    const res = interpolize.interpolize(segs, { dropLow: true, raiseHigh: false });

    t.equals(res.type, 'Feature', 'is feature');

    t.deepEquals(res.properties['carmen:lfromhn'], [
        1000, 1140, 3770, 3964, 4152, 4410, 4700, null, 4814, 5216, 5700, 6000, 6414, 7128, 7218, null, 7910, 8442, 8836, 9124, 9608, 10110, 10530, 10968, 11102, 11800, 12200, 12704, 13122, 13530, 14028, 14530, 15114
    ], 'lfromhn is as expected');
    t.deepEquals(res.properties['carmen:ltohn'], [
        1140, 11736, 3960, 4122, 4360, 4610, 4730, null, 5118, 5620, 5940, 6318, 6624, 7128, 7218, null, 8120, 8722, 9118, 9430, 9906, 10526, 10962, 11026, 11248, 12114, 12224, 13118, 13452, 14006, 14526, 14832, 15114
    ], 'ltohn is as expected');
    t.deepEquals(res.properties['carmen:rfromhn'], [
        11001, 11519, 3789, 3963, 4153, 4409, null, 4721, 4815, 5207, 5709, 6001, 6415, null, 7211, 7713, 7911, 8403, 8721, 9133, 9513, 10117, 10531, 10975, 11101, 11743, 12315, 12701, 13201, 13603, 14021, 14535, 15019
    ], 'rfromhn is as expected');
    t.deepEquals(res.properties['carmen:rtohn'], [
        11519, 11739, 3961, 4123, 4345, 4613, null, 4731, 5171, 5705, 5965, 6319, 6609, null, 7519, 7713, 8311, 8715, 9029, 9511, 9815, 10529, 10965, 11023, 11251, 12125, 12619, 12923, 13441, 14015, 14527, 15015, 15215
    ], 'rtohn is as expected');

    t.end();
});

test('Interpolize - add extended ranges', (t) => {
    const segs = require('./fixtures/interpolize_add_range.json')[0].map((v) => {
        const network = {
            type: 'FeatureCollection',
            features: [v.network]
        };
        return {
            network: v.network,
            addressPoints: Split.attachPoints(network, v.address.geometry.coordinates, v.number)
        };
    });
    const res = interpolize.interpolize(segs, { dropLow: true, raiseHigh: true });

    t.equals(res.type, 'Feature', 'is feature');

    t.deepEquals(res.properties['carmen:parityl'], ['E', 'E', 'E', 'E', null], 'parityl is as expected');
    t.deepEquals(res.properties['carmen:lfromhn'], [7000, 7910, 8442, 8836, null], 'lfromhn is as expected');
    t.deepEquals(res.properties['carmen:ltohn'], [7910, 8120, 8722, 9118, null], 'ltohn is as expected');
    t.deepEquals(res.properties['carmen:parityr'], ['O', 'O', 'O', 'O', 'O'], 'parityr is as expected');
    t.deepEquals(res.properties['carmen:rfromhn'], [7001, 7911, 8403, 8721, 9029], 'rfromhn is as expected');
    t.deepEquals(res.properties['carmen:rtohn'], [7911, 8311, 8715, 9029, 10001], 'rtohn is as expected');

    t.equals(res.geometry.type, 'MultiLineString');
    t.equals(res.geometry.coordinates.length, 5, 'number of segments is as expected');
    t.deepEquals(res.geometry.coordinates[0], [
        [-118.2961922, 33.9672769],
        [-118.2961407, 33.9668583],
        [-118.29611089042608, 33.96676970594631]
    ], 'segment at the start');

    t.deepEquals(res.geometry.coordinates[4], [
        [-118.29590100400371, 33.95519550144166],
        [-118.2959031, 33.9550112],
        [-118.2958894, 33.9545658],
        [-118.2959106, 33.9541135],
        [-118.29590619950275, 33.95381755865377],
        [-118.29590619950275, 33.95381755865377]
    ], 'segment at the end');

    t.end();
});

test('Interpolize - Do not raise high', (t) => {

    const seg = {
        network: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[-72.52744674682617, 45.900282732840324], [-72.65018463134764, 45.79816953017265]]
            }
        }
    };
    seg.addressPoints = placePointsAndProps(seg.network, [
        [-72.65104293823242, 45.80846108136044],
        [-72.64297485351562, 45.80810210576385],
        [-72.6416015625, 45.81372579098662],
        [-72.63490676879883, 45.81587939239973],
        [-72.55027770996094, 45.886423557648435],
        [-72.54547119140625, 45.8909640131969],
        [-72.53094434738159, 45.8986550563925],
        [-72.52995729446411, 45.89973022416613],
        [-72.52869129180908, 45.90050672127712]
    ], [
        { number: '3', output: true, props: {} },
        { number: '4', output: true, props: {} },
        { number: '5', output: true, props: {} },
        { number: '6', output: true, props: {} },
        { number: '7', output: true, props: {} },
        { number: '9', output: true, props: {} },
        { number: '11', output: true, props: {} },
        { number: '10', output: true, props: {} },
        { number: '12', output: true, props: {} }
    ]);

    let res = interpolize.interpolize([seg], { debug: true, dropLow: true, raiseHigh: false });
    res = legacyFormatter(res, seg);

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-no-raise.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-no-raise.json'));
    t.end();
});

test('Interpolize - Do not drop low', (t) => {
    const seg = {
        network: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[-72.52744674682617, 45.900282732840324], [-72.65018463134764, 45.79816953017265]]
            }
        }
    };
    seg.addressPoints = placePointsAndProps(seg.network, [
        [-72.65104293823242, 45.80846108136044],
        [-72.64297485351562, 45.80810210576385],
        [-72.6416015625, 45.81372579098662],
        [-72.63490676879883, 45.81587939239973],
        [-72.55027770996094, 45.886423557648435],
        [-72.54547119140625, 45.8909640131969],
        [-72.53094434738159, 45.8986550563925],
        [-72.52995729446411, 45.89973022416613],
        [-72.52869129180908, 45.90050672127712]
    ], [
        { number: '3', output: true, props: {} },
        { number: '4', output: true, props: {} },
        { number: '5', output: true, props: {} },
        { number: '6', output: true, props: {} },
        { number: '7', output: true, props: {} },
        { number: '9', output: true, props: {} },
        { number: '11', output: true, props: {} },
        { number: '10', output: true, props: {} },
        { number: '12', output: true, props: {} }
    ]);

    let res = interpolize.interpolize([seg], { raiseHigh: true, debug: true });
    res = legacyFormatter(res, seg.addressPoints);

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-no-drop.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-no-drop.json'));
    t.end();
});

test('calculateInterpolationParams - Ignore addresses above mediam * 10 away from line', (t) => {

    let limit = { min: 1000000, max: 0 };
    let split = {};
    split.network = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: [[-64.27054524421692, 44.54747368148878], [-64.26584601402283, 44.548261225872096]]
        }
    };
    split.addressPoints = placePointsAndProps(split.network, [
        [-64.27004098892212, 44.54781775558832],
        [-64.26878571510315, 44.548093013403566],
        [-64.26747679710388, 44.54839885389387],
        [-64.26645755767822, 44.548635879168515],
        [-64.26933288574217, 44.55552448238052]
    ], [
        { number: '8', output: true, props: {} },
        { number: '10', output: true, props: {} },
        { number: '12', output: true, props: {} },
        { number: '14', output: true, props: {} },
        { number: '16000', output: true, props: {} }
    ]);


    let params = interpolize.calculateInterpolationParams(split, limit);
    t.equal(limit.max, 14);
    t.equal(params.distEnd.length, 4);
    t.equal(params.distStart.length, 4);

    limit = { min: 1000000, max: 0 };
    split = {};
    split.network =  {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: [[-64.27054524421692, 44.54747368148878], [-64.26584601402283, 44.548261225872096]]
        }
    };
    split.addressPoints = placePointsAndProps(split.network, [
        [-64.27004098892212, 44.54781775558832],
        [-64.26878571510315, 44.548093013403566],
        [-64.26933288574217, 44.55552448238052],
        [-64.26747679710388, 44.54839885389387],
        [-64.26645755767822, 44.548635879168515]
    ], [
        { number: '8', output: true, props: {} },
        { number: '10', output: true, props: {} },
        { number: '1200', output: true, props: {} },
        { number: '14', output: true, props: {} },
        { number: '16', output: true, props: {} }
    ]);

    params = interpolize.calculateInterpolationParams(split, limit);
    t.equal(limit.max, 16);
    t.equal(params.distEnd.length, 4);
    t.equal(params.distStart.length, 4);
    t.end();
});

test('calculateInterpolationParams - sequence', (t) => {
    const networkWestward = {
        'type': 'Feature',
        'properties': {},
        'geometry': {
            'type': 'LineString',
            'coordinates': [[-75.99213391542435, 37.82787020541603], [-75.99321484565735, 37.82766046758019]]
        }
    };
    const networkEastward = {
        'type': 'Feature',
        'properties': {},
        'geometry': {
            'type': 'LineString',
            'coordinates': [[-75.99321484565735, 37.82766046758019], [-75.99213391542435, 37.82787020541603]]
        }
    };
    const points = [
        [-75.99238, 37.82787],
        [-75.99277, 37.82780],
        [-75.99269, 37.82771],
        [-75.99305, 37.82774],
        [-75.99299, 37.82764]
    ];
    const numberAsc = [
        { number: 1, output: true, props: null },
        { number: 3, output: true, props: null },
        { number: 2, output: true, props: null },
        { number: 7, output: true, props: null },
        { number: 8, output: true, props: null }
    ];
    const numberDesc = [
        { number: 7, output: true, props: null },
        { number: 3, output: true, props: null },
        { number: 8, output: true, props: null },
        { number: 1, output: true, props: null },
        { number: 2, output: true, props: null }
    ];
    let res;
    let limit;

    limit = { max: 0, min: 100000 };
    res = interpolize.calculateInterpolationParams({
        network: networkWestward,
        addressPoints: placePointsAndProps(networkWestward, points, numberAsc)
    }, limit);
    t.equal(res.sequence, true, 'Sequence is ascending');
    t.equal(res.leftside, 1);

    limit = { max: 0, min: 100000 };
    res = interpolize.calculateInterpolationParams({
        network: networkWestward,
        addressPoints: placePointsAndProps(networkWestward, points, numberDesc)
    }, limit);
    t.equal(res.sequence, false);
    t.equal(res.leftside, 1);

    limit = { max: 0, min: 100000 };
    res = interpolize.calculateInterpolationParams({
        network: networkEastward,
        addressPoints: placePointsAndProps(networkEastward, points, numberAsc)
    }, limit);
    t.equal(res.sequence, false);
    t.equal(res.leftside, 1);

    limit = { max: 0, min: 100000 };
    res = interpolize.calculateInterpolationParams({
        network: networkEastward,
        addressPoints: placePointsAndProps(networkEastward, points, numberDesc)
    }, limit);
    t.equal(res.sequence, true);
    t.equal(res.leftside, 1);
    t.end();
});

function placePointsAndProps(network, points, props) {
    const pointOnLine = require('@turf/turf').pointOnLine;
    return points.map((v, i) => {
        const pt = pointOnLine(network, v);
        return {
            coords: v,
            dist: pt.properties.dist,
            location: pt.properties.location,
            props: props === undefined ? undefined : props[i],
            segment: 0
        };
    });
}

test('generateInterpolationRange - basic', (t) => {
    const r = interpolize.generateInterpolationRange({
        distStart: [
            { number: 3, side: 1, distOnLine: 0, geometry: { properties: {} } },
            { number: 4, side: 0, distOnLine: 0, geometry: { properties: {} } }
        ],
        distEnd: [
            { number: 7, side: 1, distOnLine: 1, geometry: { properties: {} } },
            { number: 6, side: 0, distOnLine: 1, geometry: { properties: {} } }
        ],
        parity: { totall: 2, lo: 0, le: 2, totalr: 2, ro: 2, re: 0 },
        leftside: 1,
        streetdist: 5,
        sequence: true
    });

    t.equal(r.parityl, 'E');
    t.equal(r.lstart.number, 4);
    t.equal(r.lend.number, 8);
    t.equal(r.parityr, 'O');
    t.equal(r.rstart.number, 3);
    t.equal(r.rend.number, 7);

    t.end();
});


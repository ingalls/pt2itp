'use strict';

const interpolize = require('../lib/map/interpolize');
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
            { id: 2, properties: { 'carmen:lfromhn': [22, null] } },
            { id: 4, properties: { 'carmen:lfromhn': [1423, null] } },
            { id: 1, properties: { 'carmen:lfromhn': [3, null] } },
            { id: 5, properties: { 'carmen:lfromhn': [4362, null] } },
            { id: 3, properties: { 'carmen:lfromhn': [43, null] } }
        ];

        feats.sort(interpolize.itpSort);

        q.equals(feats.map((v) => v.id).join(' '), '1 2 3 4 5');

        q.end();
    });

    t.test('ITP Sort: Nulls Last', (q) => {
        const feats = [
            { id: 1, properties: { 'carmen:lfromhn': [22, null] } },
            { id: 2, properties: { 'carmen:lfromhn': [1423, null] } },
            { id: 5, properties: { } },
            { id: 3, properties: { 'carmen:lfromhn': [4362, null] } },
            { id: 4, properties: { } }
        ];

        feats.sort(interpolize.itpSort);

        q.equals(feats.map((v) => v.id).join(' '), '1 2 3 4 5');

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
    const segs = [{
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
        },
        address: {
            type: 'Feature',
            properties: { },
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [-77.21054881811142,39.1769482836422],
                    [-77.21056759357452,39.17731007133552],
                    [-77.2107258439064,39.176966996844406],
                    [-77.21077680587769,39.177320467506085]
                ]
            }
        },
        number:  [
            { number: '8', output: true, props: {} },
            { number: '10', output: true, props: {} },
            { number: '9', output: true, props: {} },
            { number:'11', output: true, props: {} }
        ]
    }];

    const res = interpolize({ segs });

    delete res.id;

    t.equals(res.type, 'Feature', 'is feature');

    t.deepEquals(res.properties, {
        address_props: [{}, {}, {}, {}],
        'carmen:rangetype':'tiger',
        'carmen:parityl':[['O','O','O'], null],
        'carmen:lfromhn':[[1, 9, 11] , null],
        'carmen:ltohn':  [[9, 11, 21], null],
        'carmen:parityr':[['E', 'E', 'E'], null],
        'carmen:rfromhn':[[0, 8, 10], null],
        'carmen:rtohn':  [[8, 10, 20] ,null],
        'carmen:addressnumber':[null,['8','10','9','11']],
        'carmen:intersections': []
    }, 'has expected properties');

    t.deepEquals(res.geometry, {
        'type':'GeometryCollection',
        'geometries':[{
            'type':'MultiLineString',
            'coordinates':[
                [[-77.21062123775481, 39.17687343078357],     [-77.21062630866005, 39.17697013213097]],
                [[-77.21062123775481, 39.17687343078357],    [-77.21064805984497, 39.1773849237293]],
                [[-77.21064489772711, 39.17732462265027],     [-77.21064805984497, 39.1773849237293],    [-77.21064805984497, 39.1773849237293]]
            ]
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
    const segs = [{
        network: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[-72.52744674682617, 45.900282732840324], [-72.65018463134764, 45.79816953017265]]
            }
        },
        address: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [-72.65104293823242, 45.80846108136044],
                    [-72.64297485351562, 45.80810210576385],
                    [-72.6416015625, 45.81372579098662],
                    [-72.63490676879883, 45.81587939239973],

                    [-72.55027770996094, 45.886423557648435],
                    [-72.54547119140625, 45.8909640131969],
                    [-72.53094434738159, 45.8986550563925],
                    [-72.52995729446411, 45.89973022416613],
                    [-72.52869129180908, 45.90050672127712]
                ]
            }
        },
        number:  [
            { number: '2', output: true, props: {} },
            { number: '4', output: true, props: {} },
            { number: '6', output: true, props: {} },
            { number:'8', output: true, props: {} },
            { number: '4', output: true, props: {} },
            { number: '6', output: true, props: {} },
            { number: '8', output: true, props: {} },
            { number: '10', output: true, props: {} },
            { number: '12', output: true, props: {} }
        ]
    }];

    const res = interpolize({ segs }, { debug: true });

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
    const segs = [{
        network: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[-72.52744674682617, 45.900282732840324], [-72.65018463134764, 45.79816953017265]]
            }
        },
        address: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [-72.65104293823242, 45.80846108136044],
                    [-72.64297485351562, 45.80810210576385],
                    [-72.6416015625, 45.81372579098662],
                    [-72.63490676879883, 45.81587939239973],

                    [-72.55027770996094, 45.886423557648435],
                    [-72.54547119140625, 45.8909640131969],
                    [-72.53094434738159, 45.8986550563925],
                    [-72.52995729446411, 45.89973022416613],
                    [-72.52869129180908, 45.90050672127712]
                ]
            }
        },
        number:  [
            { number: '2', output: true, props: {} },
            { number: '4', output: true, props: {} },
            { number: '6', output: true, props: {} },
            { number:'8', output: true, props: {} },
            { number: '10', output: true, props: {} },
            { number: '8', output: true, props: {} },
            { number: '6', output: true, props: {} },
            { number: '4', output: true, props: {} },
            { number: '2', output: true, props: {} }
        ]
    }];

    const res = interpolize({ segs }, { debug: true });

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
test('Interpolize - Ignore addresses above far away from line', (t) => {
    const segs = [{
        network: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[-64.27054524421692, 44.54747368148878], [-64.26584601402283, 44.548261225872096]]
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
            { number: '8', output: true, props: {} },
            { number: '10', output: true, props: {} },
            { number: '12', output: true, props: {} },
            { number:'14', output: true, props: {} },
            { number: '16000', output: true, props: {} }
        ]
    }];

    const res = interpolize({ segs }, { debug: true });

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-deviant.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-deviant.json'));
    t.end();
});

test('Interpolize - Addr past line end', (t) => {
    const segs = [{
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
        },
        address: {
            type: 'Feature',
            properties: { },
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [-77.21054881811142,39.1769482836422],
                    [-77.21056759357452,39.17731007133552],
                    [-77.2107258439064,39.176966996844406],
                    [-77.21077680587769,39.177320467506085],
                    [-77.21077412366867,39.17755334132392],
                    [-77.21056491136551,39.17757413359157]
                ]
            }
        },
        number:  [
            { number: '8', output: true, props: {} },
            { number: '10', output: true, props: {} },
            { number: '9', output: true, props: {} },
            { number:'11', output: true, props: {} },
            { number: '13', output: true, props: {} },
            { number: '12', output: true, props: {} }
        ]
    }];

    const res = interpolize({ segs }, { debug: true });

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-pastline.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-pastline.json'));
    t.end();
});

test('Interpolize - Addr past line end - opposite', (t) => {
    const segs = [{
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
        },
        address: {
            type: 'Feature',
            properties: { },
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [-77.21054881811142,39.1769482836422],
                    [-77.21056759357452,39.17731007133552],
                    [-77.2107258439064,39.176966996844406],
                    [-77.21077680587769,39.177320467506085],
                    [-77.21078217029572, 39.17767393639073],
                    [-77.21056491136551,39.17757413359157]
                ]
            }
        },
        number:  [
            { number: '8', output: true, props: {} },
            { number: '10', output: true, props: {} },
            { number: '9', output: true, props: {} },
            { number:'11', output: true, props: {} },
            { number: '13', output: true, props: {} },
            { number: '12', output: true, props: {} }
        ]
    }];

    const res = interpolize({ segs }, { debug: true });

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-pastline-opp.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-pastline-opp.json'));
    t.end();
});

test('Interpolize - Addr past line end - bend', (t) => {
    const segs = [{
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
        },
        address: {
            type: 'Feature',
            properties: { },
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [-77.20983803272247, 39.17702937414912],
                    [-77.20847547054291, 39.177740471511456],
                    [-77.20990777015686, 39.17674659659119],
                    [-77.20825552940369, 39.1777238377372]
                ]
            }
        },
        number:  [
            { number: '2', output: true, props: {} },
            { number: '4', output: true, props: {} },
            { number: '1', output: true, props: {} },
            { number:'3', output: true, props: {} }
        ]
    }];

    const res = interpolize({ segs }, { debug: true });

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-pastline-bend.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-pastline-bend.json'));
    t.end();
});

test('Interpolize - Addr past line end - bend - reverse', (t) => {
    const segs = [{
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
        },
        address: {
            type: 'Feature',
            properties: { },
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [-77.20983803272247, 39.17702937414912],
                    [-77.20847547054291, 39.177740471511456],
                    [-77.20990777015686, 39.17674659659119],
                    [-77.20825552940369, 39.1777238377372]
                ]
            }
        },
        number:  [
            { number: '2', output: true, props: {} },
            { number: '4', output: true, props: {} },
            { number: '1', output: true, props: {} },
            { number:'3', output: true, props: {} }
        ]
    }];

    const res = interpolize({ segs }, { debug: true });

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
        },
        address: {
            type: 'Feature',
            properties: { },
            geometry: {
                type: 'MultiPoint',
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
        ]
    }];

    const res = interpolize({ segs }, { debug: true });

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

    const res = interpolize({ segs });
    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/left-hook-network.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }

    t.deepEquals(res, require('./fixtures/left-hook-network.json'));
    t.end();
});

test('Interpolize - sequence', (t) => {
    const segs = require('./fixtures/interpolize_sequence.json');
    const res = interpolize({ segs: segs[0], nextDelta: 0 });

    t.equals(res.type, 'Feature', 'is feature');

    t.deepEquals(res.properties['carmen:lfromhn'], [
        [1000, 1140, 3770, 3964, 4152, 4410, 4700, null, 4814, 5216, 5700, 6000, 6414, 7128, 7218, null, 7910, 8442, 8836, 9124, 9608, 10110, 10530, 10968, 11102, 11800, 12200, 12704, 13122, 13530, 14028, 14530, 15114], null
    ], 'lfromhn is as expected');
    t.deepEquals(res.properties['carmen:ltohn'], [
        [1140, 11736, 3956, 4122, 4360, 4610, 4730, null, 5118, 5620, 5940, 6318, 6624, 7128, 7218, null, 8120, 8722, 9118, 9430, 9906, 10526, 10958, 11026, 11248, 12114, 12224, 13118, 13452, 14006, 14526, 14832, 15114], null
    ], 'ltohn is as expected');
    t.deepEquals(res.properties['carmen:rfromhn'], [
        [11001, 11519, 3809, 3963, 4153, 4409, null, 4721, 4815, 5207, 5709, 6001, 6415, null, 7211, 7713, 7911, 8403, 8721, 9133, 9513, 10117, 10531, 10975, 11101, 11743, 12315, 12701, 13201, 13603, 14021, 14535, 15019], null
    ], 'rfromhn is as expected');
    t.deepEquals(res.properties['carmen:rtohn'], [
        [11519, 11739, 3955, 4123, 4345, 4613, null, 4731, 5171, 5705, 5965, 6319, 6609, null, 7519, 7713, 8311, 8715, 9029, 9511, 9815, 10529, 10965, 11023, 11251, 12125, 12619, 12923, 13441, 14015, 14527, 15015, 15215], null
    ], 'rtohn is as expected');

    t.end();
});

test('Interpolize - add extended ranges', (t) => {
    const segs = require('./fixtures/interpolize_add_range.json');
    const res = interpolize({ segs: segs[0] });

    t.equals(res.type, 'Feature', 'is feature');

    t.deepEquals(res.properties['carmen:lfromhn'], [
        [7000, 7910, 8442, 8836, 9118], null
    ], 'lfromhn is as expected');
    t.deepEquals(res.properties['carmen:ltohn'], [
        [7910, 8120, 8722, 9118, 10000], null
    ], 'ltohn is as expected');
    t.deepEquals(res.properties['carmen:rfromhn'], [
        [7001, 7911, 8403, 8721, 9029], null
    ], 'rfromhn is as expected');
    t.deepEquals(res.properties['carmen:rtohn'], [
        [7911, 8311, 8715, 9029, 10001], null
    ], 'rtohn is as expected');

    t.end();
});

test('Interpolize - Do not raise high', (t) => {
    const segs = [{
        network: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[-72.52744674682617, 45.900282732840324], [-72.65018463134764, 45.79816953017265]]
            }
        },
        address: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [-72.65104293823242, 45.80846108136044],
                    [-72.64297485351562, 45.80810210576385],
                    [-72.6416015625, 45.81372579098662],
                    [-72.63490676879883, 45.81587939239973],

                    [-72.55027770996094, 45.886423557648435],
                    [-72.54547119140625, 45.8909640131969],
                    [-72.53094434738159, 45.8986550563925],
                    [-72.52995729446411, 45.89973022416613],
                    [-72.52869129180908, 45.90050672127712]
                ]
            }
        },
        number:  [
            { number: '3', output: true, props: {} },
            { number: '4', output: true, props: {} },
            { number: '5', output: true, props: {} },
            { number: '6', output: true, props: {} },
            { number: '7', output: true, props: {} },
            { number: '9', output: true, props: {} },
            { number: '11', output: true, props: {} },
            { number: '10', output: true, props: {} },
            { number: '12', output: true, props: {} }
        ]
    }];

    const res = interpolize({ segs, nextDelta: 0 }, { debug: true });

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-no-raise.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-no-raise.json'));
    t.end();
});

test('Interpolize - Do not drop low', (t) => {
    const segs = [{
        network: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[-72.52744674682617, 45.900282732840324], [-72.65018463134764, 45.79816953017265]]
            }
        },
        address: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [-72.65104293823242, 45.80846108136044],
                    [-72.64297485351562, 45.80810210576385],
                    [-72.6416015625, 45.81372579098662],
                    [-72.63490676879883, 45.81587939239973],

                    [-72.55027770996094, 45.886423557648435],
                    [-72.54547119140625, 45.8909640131969],
                    [-72.53094434738159, 45.8986550563925],
                    [-72.52995729446411, 45.89973022416613],
                    [-72.52869129180908, 45.90050672127712]
                ]
            }
        },
        number:  [
            { number: '3', output: true, props: {} },
            { number: '4', output: true, props: {} },
            { number: '5', output: true, props: {} },
            { number: '6', output: true, props: {} },
            { number: '7', output: true, props: {} },
            { number: '9', output: true, props: {} },
            { number: '11', output: true, props: {} },
            { number: '10', output: true, props: {} },
            { number: '12', output: true, props: {} }
        ]
    }];

    const res = interpolize({ segs, prevDelta: 0 }, { debug: true });

    delete res.id;

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-no-drop.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-no-drop.json'));
    t.end();
});

test('Interpolize - genFeat', (t) => {

    // No points on network
    let feature = interpolize.genFeat({ network: { geometry: 'dummy' } }, false, {}, []);
    t.equal(Object.keys(feature.properties).length, 1, 'No properties added');
    t.equal(feature.properties['carmen:intersections'].length, 0, 'No intersections added');
    t.equal(feature.geometry.geometries[0], 'dummy', 'Geometry unaltered');

    // No points, but intersections!
    feature = interpolize.genFeat({ network: { geometry: 'dummy' } }, false, {}, ['Foo Street']);
    t.equal(Object.keys(feature.properties).length, 1, 'No properties added');
    t.deepEqual(feature.properties['carmen:intersections'], ['Foo Street'], 'Intersections preserved');
    t.equal(feature.geometry.geometries[0], 'dummy', 'Geometry unaltered');

    // Numbers w/ output: true
    feature = interpolize.genFeat({
        network: {
            geometry: {
                coordinates: [[0,1], [0,9]]
            }
        },
        address: {
            geometry: {
                coordinates: [[0,1], [0,2], [0,3], [0,4], [0,5], [0,6], [0,7], [0,8], [0,9]]
            }
        },
        number: [1,2,3,4,5,6,7,8,9].map((v) => { return { number: v, output: true };})
    }, {
        parityl: 'E',
        lstart: { number: 2 },
        lend: { number: 10 },
        parityr: 'O',
        rstart: { number: 1 },
        rend: { number: 11 }
    }, {}, []);
    t.equal(Object.keys(feature.properties).length, 10, 'Has properties added');
    t.equal(feature.properties['carmen:intersections'].length, 0);
    t.equal(feature.properties['carmen:rangetype'], 'tiger');
    t.deepEqual(feature.properties['carmen:parityl'], ['E', null]);
    t.deepEqual(feature.properties['carmen:lfromhn'], [2, null]);
    t.deepEqual(feature.properties['carmen:ltohn'], [10, null]);
    t.deepEqual(feature.properties['carmen:parityr'], ['O', null]);
    t.deepEqual(feature.properties['carmen:rfromhn'], [1, null]);
    t.deepEqual(feature.properties['carmen:rtohn'], [11, null]);
    t.equal(feature.properties['carmen:addressnumber'][1].length, 9, 'Has address numbers');
    t.equal(feature.properties.address_props.length, 9, 'Has address props');

    // Numbers w/ output: false
    feature = interpolize.genFeat({
        network: {
            geometry: {
                coordinates: [[0,1], [0,9]]
            }
        },
        address: {
            geometry: {
                coordinates: [[0,1], [0,2], [0,3], [0,4], [0,5], [0,6], [0,7], [0,8], [0,9]]
            }
        },
        number: [1,2,3,4,5,6,7,8,9].map((v) => { return { number: v, output: false };})
    }, {
        parityl: 'E',
        lstart: { number: 2 },
        lend: { number: 10 },
        parityr: 'O',
        rstart: { number: 1 },
        rend: { number: 11 }
    }, {}, []);
    t.equal(Object.keys(feature.properties).length, 8, 'Has some properties added');
    t.equal(feature.properties['carmen:intersections'].length, 0);
    t.equal(feature.properties['carmen:rangetype'], 'tiger');
    t.deepEqual(feature.properties['carmen:parityl'], ['E']);
    t.deepEqual(feature.properties['carmen:lfromhn'], [2]);
    t.deepEqual(feature.properties['carmen:ltohn'], [10]);
    t.deepEqual(feature.properties['carmen:parityr'], ['O']);
    t.deepEqual(feature.properties['carmen:rfromhn'], [1]);
    t.deepEqual(feature.properties['carmen:rtohn'], [11]);

    // Numbers w/ mixed output
    feature = interpolize.genFeat({
        network: {
            geometry: {
                coordinates: [[0,1], [0,9]]
            }
        },
        address: {
            geometry: {
                coordinates: [[0,1], [0,2], [0,3], [0,4], [0,5], [0,6], [0,7], [0,8], [0,9]]
            }
        },
        number: [1,2,3,4,5,6,7,8,9].map((v) => { return { number: v, output: (v % 3 === 0) };})
    }, {
        parityl: 'E',
        lstart: { number: 2 },
        lend: { number: 10 },
        parityr: 'O',
        rstart: { number: 1 },
        rend: { number: 11 }
    }, {}, []);
    t.equal(Object.keys(feature.properties).length, 10, 'Has properties added');
    t.equal(feature.properties['carmen:intersections'].length, 0);
    t.equal(feature.properties['carmen:rangetype'], 'tiger');
    t.deepEqual(feature.properties['carmen:parityl'], ['E', null]);
    t.deepEqual(feature.properties['carmen:lfromhn'], [2, null]);
    t.deepEqual(feature.properties['carmen:ltohn'], [10, null]);
    t.deepEqual(feature.properties['carmen:parityr'], ['O', null]);
    t.deepEqual(feature.properties['carmen:rfromhn'], [1, null]);
    t.deepEqual(feature.properties['carmen:rtohn'], [11, null]);
    t.equal(feature.properties['carmen:addressnumber'][1].length, 3, 'Has address numbers');
    t.equal(feature.properties.address_props.length, 3, 'Has address props');

    t.end();
});

test('calculateInterpolationParams - Ignore addresses above mediam * 10 away from line', (t) => {
    let limit = { min: 1000000, max: 0 };
    let params = interpolize.calculateInterpolationParams({
        network: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[-64.27054524421692, 44.54747368148878], [-64.26584601402283, 44.548261225872096]]
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
            { number: '8', output: true, props: {} },
            { number: '10', output: true, props: {} },
            { number: '12', output: true, props: {} },
            { number:'14', output: true, props: {} },
            { number: '16000', output: true, props: {} }
        ]
    }, limit);
    t.equal(limit.max, 14);
    t.equal(params.distEnd.length, 4);
    t.equal(params.distStart.length, 4);

    limit = { min: 1000000, max: 0 };
    params = interpolize.calculateInterpolationParams({
        network: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [[-64.27054524421692, 44.54747368148878], [-64.26584601402283, 44.548261225872096]]
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
                    [-64.26933288574217, 44.55552448238052],
                    [-64.26747679710388, 44.54839885389387],
                    [-64.26645755767822, 44.548635879168515]
                ]
            }
        },
        number:  [
            { number: '8', output: true, props: {} },
            { number: '10', output: true, props: {} },
            { number: '1200', output: true, props: {} },
            { number: '14', output: true, props: {} },
            { number: '16', output: true, props: {} }
        ]
    }, limit);
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
    const address = {
        'geometry': {
            'type': 'MultiPoint',
            'coordinates': [
                [-75.99238, 37.82787],
                [-75.99277, 37.82780],
                [-75.99269, 37.82771],
                [-75.99305, 37.82774],
                [-75.99299, 37.82764]
            ]
        }
    };
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
    res = interpolize.calculateInterpolationParams({ network: networkWestward, address, number: numberAsc }, limit);
    t.equal(res.sequence, true);
    t.equal(res.leftside, 1);

    limit = { max: 0, min: 100000 };
    res = interpolize.calculateInterpolationParams({ network: networkWestward, address, number: numberDesc }, limit);
    t.equal(res.sequence, false);
    t.equal(res.leftside, 1);

    limit = { max: 0, min: 100000 };
    res = interpolize.calculateInterpolationParams({ network: networkEastward, address, number: numberAsc }, limit);
    t.equal(res.sequence, false);
    t.equal(res.leftside, 1);

    limit = { max: 0, min: 100000 };
    res = interpolize.calculateInterpolationParams({ network: networkEastward, address, number: numberDesc }, limit);
    t.equal(res.sequence, true);
    t.equal(res.leftside, 1);
    t.end();
});

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

test('generateInterpolationRange - overlap', (t) => {

    let r;
    r = interpolize.generateInterpolationRange({
        distStart: [
            { number: 110, side: 0, distOnLine: 2, geometry: { properties: {} } }
        ],
        distEnd: [
            { number: 11, side: 0, distOnLine: 3, geometry: { properties: {} } },
            { number: 106, side: 0, distOnLine: 3, geometry: { properties: {} } }
        ],
        parity: { totall: 3, lo: 0, le: 3, totalr: 0, ro: 0, re: 0 },
        leftside: 0,
        streetdist: 5,
        sequence: true,
        overlap: [['lend', 11]]
    });
    t.equal(r.lend.number, 106);

    r = interpolize.generateInterpolationRange({
        distStart: [
            { number: 1100, side: 0, distOnLine: 1, geometry: { properties: {} } },
            { number: 111, side: 1, distOnLine: 1.1, geometry: { properties: {} } },
            { number: 112, side: 0, distOnLine: 1.2, geometry: { properties: {} } }
        ],
        distEnd: [
            { number: 116, side: 0, distOnLine: 3, geometry: { properties: {} } },
            { number: 101, side: 1, distOnLine: 3, geometry: { properties: {} } },
            { number: 118, side: 0, distOnLine: 4, geometry: { properties: {} } }
        ],
        parity: { totall: 4, lo: 0, le: 4, totalr: 2, ro: 2, re: 0 },
        leftside: 0,
        streetdist: 5,
        sequence: true,
        overlap: [['lstart', 1100]]
    });
    t.equal(r.lstart.number, 112);

    t.end();

});

test('checkInterpolationRanges - simple out of range', (t) => {

    let r;
    r = interpolize.checkInterpolationRanges([
        {
            properties: {
                'carmen:lfromhn': [null],
                'carmen:ltohn': [null],
                'carmen:parityl': [null],
                'carmen:rfromhn': [100],
                'carmen:rtohn': [108],
                'carmen:parityr': ['E']
            },
            rangeOptions: { sequence: true }
        },
        {
            properties: {
                'carmen:lfromhn': [null],
                'carmen:ltohn': [null],
                'carmen:parityl': [null],
                'carmen:rfromhn': [110],
                'carmen:rtohn': [11],
                'carmen:parityr': ['E']
            },
            rangeOptions: { sequence: true }
        },
        {
            properties: {
                'carmen:lfromhn': [null],
                'carmen:ltohn': [null],
                'carmen:parityl': [null],
                'carmen:rfromhn': [120],
                'carmen:rtohn': [128],
                'carmen:parityr': ['E']
            },
            rangeOptions: { sequence: true }
        }
    ]);
    t.deepEqual(r, [[],[['rend', 11]],[]]);

    r = interpolize.checkInterpolationRanges([
        {
            properties: {
                'carmen:lfromhn': [null],
                'carmen:ltohn': [null],
                'carmen:parityl': [null],
                'carmen:rfromhn': [100],
                'carmen:rtohn': [108],
                'carmen:parityr': ['E']
            },
            rangeOptions: { sequence: true }
        },
        {
            properties: {
                'carmen:lfromhn': [null],
                'carmen:ltohn': [null],
                'carmen:parityl': [null],
                'carmen:rfromhn': [110],
                'carmen:rtohn': [121],
                'carmen:parityr': ['E']
            },
            rangeOptions: { sequence: true }
        },
        {
            properties: {
                'carmen:lfromhn': [null],
                'carmen:ltohn': [null],
                'carmen:parityl': [null],
                'carmen:rfromhn': [120],
                'carmen:rtohn': [128],
                'carmen:parityr': ['E']
            },
            rangeOptions: { sequence: true }
        }
    ]);
    t.deepEqual(r, [[],[],[]]);
    // TODO it should be -> t.deepEqual(r, [[],[['rend', 121]],[]]);
    t.end();
});

test('checkInterpolationRanges - in range', (t) => {

    const r = interpolize.checkInterpolationRanges([
        {
            properties: {
                'carmen:lfromhn': [null],
                'carmen:ltohn': [null],
                'carmen:parityl': [null],
                'carmen:rfromhn': [100],
                'carmen:rtohn': [108],
                'carmen:parityr': ['E']
            },
            rangeOptions: { sequence: true }
        },
        {
            properties: {
                'carmen:lfromhn': [null],
                'carmen:ltohn': [null],
                'carmen:parityl': [null],
                'carmen:rfromhn': [110],
                'carmen:rtohn': [118],
                'carmen:parityr': ['E']
            },
            rangeOptions: { sequence: true }
        },
        {
            properties: {
                'carmen:lfromhn': [null],
                'carmen:ltohn': [null],
                'carmen:parityl': [null],
                'carmen:rfromhn': [120],
                'carmen:rtohn': [128],
                'carmen:parityr': ['E']
            },
            rangeOptions: { sequence: true }
        }
    ]);
    t.deepEqual(r, [[],[],[]]);
    t.end();
});

test('isInRange', (t) => {
    t.equal(interpolize.isInRange(1,2,null), true);
    t.equal(interpolize.isInRange(null,2,3), true);
    t.equal(interpolize.isInRange(1,2,3), true);
    t.equal(interpolize.isInRange(1,0,3), false);
    t.equal(interpolize.isInRange(1,4,3), false);
    t.equal(interpolize.isInRange(3,2,1), true);
    t.equal(interpolize.isInRange(3,0,1), false);
    t.equal(interpolize.isInRange(3,4,1), false);
    t.end();
});

const test = require('tape');
const interpolize = require('../lib/interpolize');
const turf = require('@turf/turf');
const fs = require('fs');

test('LSB forward', (t) => {
    let LSB = interpolize.lsb(
        [-79.37625288963318,38.83449282408381],
        [-79.37467575073241,38.83594698648804]
    )
    t.equal(LSB, 1);
    t.end();
});

test('LSB reverse', (t) => {
    let LSB = interpolize.lsb(
        [-79.37467575073241,38.83594698648804],
        [-79.37625288963318,38.83449282408381]
    )
    t.equal(LSB, 1);
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
    let street = {
        type: "Feature",
        properties: { street: "Battleridge Place" },
        geometry: {
            type: "LineString",
            coordinates: [
                [-77.21062123775481,39.17687343078357],
                [-77.21064805984497,39.1773849237293]
            ]
        }
    }

    let address = {
        type: "Feature",
        properties: {
            street: "Battleridge Place",
            numbers: ["8","10","9","11"]
        },
        geometry: {
            type: "MultiPoint",
            coordinates: [
                [-77.21054881811142,39.1769482836422],
                [-77.21056759357452,39.17731007133552],
                [-77.2107258439064,39.176966996844406],
                [-77.21077680587769,39.177320467506085]
            ]
        }
    }

    let res = interpolize(street, address);
    t.deepEquals(res.properties, {
        'carmen:text': 'Battleridge Place',
        'carmen:center': [ -77.2106346487999, 39.17712917725643 ],
        'carmen:rangetype': 'tiger',
        'carmen:parityl': 'O',
        'carmen:lfromhn': '9',
        'carmen:ltohn': '11',
        'carmen:parityr': 'E',
        'carmen:rfromhn': '8',
        'carmen:rtohn': '10'
    }, 'has expected properties');
    t.end();
});

test('Interpolize - Addr past line end', (t) => {
    let street = {
        type: "Feature",
        properties: {
            street: ["Battleridge", "Place"],
            'carmen:text': 'Battleridge Place'
        },
        geometry: {
            type: "LineString",
            coordinates: [
                [-77.21062123775481,39.17687343078357],
                [-77.21064805984497,39.1773849237293]
            ]
        }
    }

    let address = {
        type: "Feature",
        properties: {
            street: ["Battleridge", "Place"],
            numbers: ["8","10","9","11","13","12"]
        },
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
    }

    let res = interpolize(street, address, { debug: true });

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-pastline.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-pastline.json'));
    t.end();
});

test('Interpolize - Addr past line end - opposite', (t) => {
    let street = {
        type: "Feature",
        properties: {
            street: ["Battleridge", "Place"],
            'carmen:text': 'Battleridge Place'
        },
        geometry: {
            type: "LineString",
            coordinates: [
                [-77.21062123775481,39.17687343078357],
                [-77.21064805984497,39.1773849237293]
            ]
        }
    }

    let address = {
        type: "Feature",
        properties: {
            street: ["Battleridge", "Place"],
            numbers: ["8","10","9","11","13","12"]
        },
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
    }

    let res = interpolize(street, address, { debug: true });

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-pastline-opp.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-pastline-opp.json'));
    t.end();
});

test('Interpolize - Addr past line end - bend', (t) => {
    let street = {
        type: "Feature",
        properties: {
            street: ["Battleridge", "Place"],
            'carmen:text': 'Battleridge Place'
        },
        geometry: {
            type: "LineString",
            coordinates: [
                [ -77.21002042293549, 39.17696283835544 ],
                [ -77.20934987068176, 39.17688382701869 ],
                [ -77.20870077610016, 39.177050166571725 ]
            ]
        }
    }

    let address = {
        type: "Feature",
        properties: {
            street: ["Battleridge", "Place"],
            numbers: [ "2", "4", "1", "3"]
        },
        geometry: {
            type: "MultiPoint",
            coordinates: [
                [ -77.20983803272247, 39.17702937414912 ],
                [ -77.20847547054291, 39.177740471511456 ],
                [ -77.20990777015686, 39.17674659659119 ],
                [ -77.20825552940369, 39.1777238377372 ]
            ]
        }
    }

    let res = interpolize(street, address, { debug: true });

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/itp-pastline-bend.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(res, require('./fixtures/itp-pastline-bend.json'));
    t.end();
});

test('Interpolize - Addr past line end - bend - reverse', (t) => {
    let street = {
        type: "Feature",
        properties: {
            street: ["Battleridge", "Place"],
            'carmen:text': 'Battleridge Place'
        },
        geometry: {
            type: "LineString",
            coordinates: [
                [ -77.20870077610016, 39.177050166571725 ],
                [ -77.20934987068176, 39.17688382701869 ],
                [ -77.21002042293549, 39.17696283835544 ]
            ]
        }
    }

    let address = {
        type: "Feature",
        properties: {
            street: ["Battleridge", "Place"],
            numbers: [ "2", "4", "1", "3"]
        },
        geometry: {
            type: "MultiPoint",
            coordinates: [
                [ -77.20983803272247, 39.17702937414912 ],
                [ -77.20847547054291, 39.177740471511456 ],
                [ -77.20990777015686, 39.17674659659119 ],
                [ -77.20825552940369, 39.1777238377372 ]
            ]
        }
    }

    let res = interpolize(street, address, { debug: true });

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
    let street = {
        type: "Feature",
        properties: {
            'carmen:text': 'Tommy Bell Pl'
        },
        geometry: {
            type: "LineString",
            coordinates: [
                [ -77.19249486923218, 39.090421398604306 ],
                [ -77.19209790229797, 39.09155388949448 ],
                [ -77.19150245189667, 39.091428983303274 ]
            ]
        }
    }

    let address = {
        type: "Feature",
        properties: {
            'carmen:text': 'Tommy Bell Pl',
            numbers: [ "2", "4", "6", "8", "10", "12", "1", "3", "5", "7", "9" ]
        },
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
    }

    let res = interpolize(street, address, { debug: true });

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/left-hook.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }

    t.deepEquals(res, require('./fixtures/left-hook.json'));
    t.end();
});


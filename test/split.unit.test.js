'use strict';

const test = require('tape');
const turf = require('@turf/turf');
const { Split } = require('../lib/map/split');

test('Attach points to line', (t) => {
    const network = turf.featureCollection([turf.lineString([
        [-77.03365445137024, 38.89877350122629],
        [-77.03362226486205, 38.89641047208325]
    ])]);
    const coords = [
        [-77.03396022319794, 38.897909292974276],
        [-77.03331649303436, 38.898510482436876],
        [-77.0334130525589, 38.896919824235354]
    ];
    const props = [2, 1, 3];

    t.deepEqual(Split.attachPoints(network, coords, props), [
        { coords: [-77.03331649303436, 38.898510482436876], dist: 0.02893479619937134, location: 0.029558270297311683, props: 1, segment: 0 },
        { coords: [-77.03396022319794, 38.897909292974276], dist: 0.02747843094101002, location: 0.09581162246877092, props: 2, segment: 0 },
        { coords: [-77.0334130525589, 38.896919824235354], dist: 0.01870470269785991, location: 0.20633234694843797, props: 3, segment: 0 }
    ]);
    t.end();
});

test('Refuse to split multiline string into segments', (t) => {
    const network = turf.featureCollection([turf.lineString([
        [-77.03365445137024, 38.89877350122629],
        [-77.03362226486205, 38.89641047208325]
    ])]);

    t.throws(() => { Split.splitSegments({ network }); }, 'Require LineString');
    t.end();
});

test('Do not split short network into sub-segments', (t) => {
    const network = turf.featureCollection([turf.lineString([
        [-77.03365445137024, 38.89877350122629],
        [-77.03362226486205, 38.89641047208325]
    ])]);

    const cluster = {
        network: network.features[0],
        addressPoints: Split.attachPoints(network, [
            [-77.03396022319794, 38.897909292974276],
            [-77.03331649303436, 38.898510482436876],
            [-77.0334130525589, 38.896919824235354]
        ], [2, 1, 3]),
        intersectionPoints: []
    };
    const result = Split.splitSegments(cluster);
    t.equal(result.length, 1, 'Did not split segment');
    t.end();
});

test('Split long network into sub-segments', (t) => {
    const network = turf.featureCollection([turf.lineString([
        [-77.03641176223755, 38.92910179895564],
        [-77.0355212688446, 38.92708198494835],
        [-77.03518867492676, 38.92108897519732],
        [-77.03475952148438, 38.92060483810483],
        [-77.03469514846802, 38.91911901743697],
        [-77.03448057174683, 38.91813401804748],
        [-77.03458786010742, 38.90135353865269],
        [-77.0336651802063, 38.90132014070886],
        [-77.03365445137024, 38.89212675943535]
    ])]);

    const cluster = {
        network: network.features[0],
        addressPoints: Split.attachPoints(network, [
            [-77.0334130525589,  38.896919824235354],
            [-77.03396022319794, 38.897909292974276],
            [-77.03331649303436, 38.898510482436876],
            [-77.03479170799254, 38.91460710726654],
            [-77.03479170799254, 38.91469893438498]
        ], [1, 2, 3, 4, 5]),
        intersectionPoints: []
    };
    const result = Split.splitSegments(cluster);
    t.equal(result.length, 2, 'Split segment based on distance');
    t.end();
});

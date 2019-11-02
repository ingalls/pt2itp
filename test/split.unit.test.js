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
        { dist: 0.02893479619937134, location: 0.029558270297311683, props: 1, segment: 0, idx: 1 },
        { dist: 0.02747843094101002, location: 0.09581162246877092, props: 2, segment: 0, idx: 0 },
        { dist: 0.01870470269785991, location: 0.20633234694843797, props: 3, segment: 0, idx: 2 }
    ]);
    t.end();
});

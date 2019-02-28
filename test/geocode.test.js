const test = require('tape');

const geocode = require('../lib/util/geocode');
const tokens = require('../lib/util/tokenize');

const db = require('./lib/db');
db.init(test);

test('geocode#isPass', (t) => {
    let query = [
        '200 Broadway',
        [-71.308992,41.495267],
        {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                place_name: '200 Broadway St',
                properties: {},
                geometry: {
                    type: 'Point',
                    coordinates: [-71.308992,41.495267]
                }
            }]
        }, {
            tokens: tokens.createReplacer(['en'])
        },
        function(err, res) {
            t.error(err);
            t.notok(res);

            t.end();
        }
    ]

    geocode.isPass(...query);
});

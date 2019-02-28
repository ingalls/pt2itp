const test = require('tape');

const geocode = require('../lib/util/geocode');
const tokens = require('../lib/util/tokenize');

const db = require('./lib/db');
db.init(test);

test('geocode#isPass.suffix', (t) => {
    geocode.testConfig({ geocoder_stack: ['us', 'xx'] });
    let query = [
        '200 101st Avenue',
        [-71.308992,41.495267],
        {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                place_name: '200 101 Ave',
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
            t.error(err)
            t.notok(res);
            t.end();
        }
    ]

    geocode.isPass(...query);
});

test('geocode#isPass.suffix', (t) => {
    geocode.testConfig({ geocoder_stack: ['fr'] });
    let query = [
        '200 101st Avenue',
        [-71.308992,41.495267],
        {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                place_name: '200 101 Ave',
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
            t.error(err)
            t.deepEquals(res, [ 'TEXT', { query: '200 101st av', queryPoint: '-71.308992,41.495267', addressText: '200 101 av', returnedPoint: '-71.308992,41.495267' } ]);
            t.end();
        }
    ]

    geocode.isPass(...query);
});

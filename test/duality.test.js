var duality = require('../lib/duality');
var test = require('tape');
var fs = require('fs');

test('checks types', function(t) {
    t.throws(function() {
        duality({ type: 'LineString' })
    }, 'Must be Feature');

    t.throws(function() {
        duality({ type: 'Feature' })
    }, 'Must have geometry');

    t.throws(function() {
        duality({ type: 'Feature', geometry: { type: 'Point' } })
    }, 'Must be MultiLineString');

    t.end();
});

test('Simple Duality', function(t) {
    var res = duality({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'MultiLineString',
            coordinates: [[[ 151.2131541967392, -33.909451060139666 ], [ 151.2134063243866, -33.908088725234904 ] ],[ [ 151.213296353817, -33.90809095129009 ], [ 151.21302545070645, -33.90940653973529 ]]] 
        }
    });

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/duality.simple.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }

    var fixture = require('./fixtures/duality.simple.json');
    t.deepEquals(res, fixture);
    t.end();
});

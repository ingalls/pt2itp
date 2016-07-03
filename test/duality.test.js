var duality = require('../lib/duality');
var test = require('tape');
var fs = require('fs');

test('Simple Duality', function(t) {
    var res = buffer({
        type: 'LineString',
        coordinates: [ [ 153.02594661712646, -27.391440164073067 ], [ 153.0263113975525, -27.389068173784242 ] ]
    }, 0.1);

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/duality.simple.json', JSON.stringify(res, null, 4));
        t.fail('had to update fixture');
    }

    var fixture = require('./fixtures/duality.simple.json');
    t.deepEquals(res, fixture);
    t.end();
});

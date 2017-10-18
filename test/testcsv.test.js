const test = require('tape');
const testcsv = require('../lib/testcsv');

const testidx = "/Users/mapbox/Developer/us_ri-address-both-0d603c2a171017011038-0d603c2a39/us_ri-address-both-0d603c2a171017011038-0d603c2a39.mbtiles";

test('testcsv', (t) => {

	testcsv({index: testidx, query:'greenview'} , (err, res) => {
        t.error(err);
        t.ok(res.features.length > 0);

	})
	t.end();
});

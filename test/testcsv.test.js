const test = require('tape');
const testcsv = require('../lib/testcsv');


/*test('edge cases - empty string', (t) => {
    t.deepEqual(tokenize.main(''), []);
    t.end();
});
*/

/*40, 80, "Main street" \n*/

const testobj = { _: 
   [ '/Users/mapbox/.nvm/versions/node/v6.10.2/bin/node',
     '/usr/local/bin/pt2itp',
     'testcsv' ],
  'test-ephermal': false,
  index: '/Users/mapbox/Developer/us_ri-address-both-0d603c2a171017011038-0d603c2a39/us_ri-address-both-0d603c2a171017011038-0d603c2a39.mbtiles',
  i: '/Users/mapbox/Developer/us_ri-address-both-0d603c2a171017011038-0d603c2a39/us_ri-address-both-0d603c2a171017011038-0d603c2a39.mbtiles',
  query: 'Greenview St' };

test('testcsv', (t) => {
	testcsv(testobj , (err, res) => {
        console.log('err',err);
        console.log('res',res);
	})
	t.end();
});


/*
    tape('test address index for alphanumerics', (t) => {
        c.geocode('9B FAKE STREET', { limit_verify: 1 }, (err, res) => {
            t.ifError(err);
            t.equals(res.features[0].place_name, '9b fake street', 'found 9b fake street');
            t.equals(res.features[0].relevance, 1.00);
            t.end();
        });
    });

*/
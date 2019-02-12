const post = require('../lib/post/internal').post;
const test = require('tape');

test('Post: Internal', (t) => {
    t.equals(post(), undefined);
    t.deepEquals(post({
        type: 'Feature',
        properties: {
            'internal:nid': 123,
            'other': true
        },
        geometry: {
            type: 'Point',
            coordinates: [0.0, 0.0]
        }
    }), {
        type: 'Feature',
        properties: {
            'other': true
        },
        geometry: {
            type: 'Point',
            coordinates: [0.0, 0.0]
        }
    });

    t.end();
});

'use strict';

const post = require('../lib/post/text').post;
const test = require('tape');

test('Post: Text', (t) => {
    t.deepEquals(post(), undefined, 'return unprocessable 1');

    t.deepEquals(post({
        properties: undefined
    }), {
        properties: undefined
    }, 'return unprocessable 2');

    t.deepEquals(post({
        properties: {
            'carmen:text': [{ display: 'Main Street', tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] }],
            'carmen:text_xx': [{ display: 'Spring Rd', tokenized: [{ token: 'spring', token_type: null }, { token: 'rd', token_type: 'Way' }] }]
        }
    }), {
        properties: {
            'carmen:text': 'Main Street',
            'carmen:text_xx': 'Spring Rd'
        }
    }, 'preserve basic feature');

    const result = post({
        properties: {
            'carmen:text': [
                { display: '204 Haywood Rd', tokenized: [{ token: '204', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '201 Haywood Rd', tokenized: [{ token: '201', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '202 Haywood Rd', tokenized: [{ token: '202', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '203 Haywood Rd', tokenized: [{ token: '203', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '208 Haywood Rd', tokenized: [{ token: '208', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '209 Haywood Rd', tokenized: [{ token: '209', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '210 Haywood Rd', tokenized: [{ token: '210', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '211 Haywood Rd', tokenized: [{ token: '211', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '212 Haywood Rd', tokenized: [{ token: '212', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '213 Haywood Rd', tokenized: [{ token: '213', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '214 Haywood Rd', tokenized: [{ token: '214', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '215 Haywood Rd', tokenized: [{ token: '215', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '216 Haywood Rd', tokenized: [{ token: '216', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '217 Haywood Rd', tokenized: [{ token: '217', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '218 Haywood Rd', tokenized: [{ token: '218', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] }
            ]
        }
    });

    t.deepEquals(result, {
        properties: {
            'carmen:text': '204 Haywood Rd,201 Haywood Rd,202 Haywood Rd,203 Haywood Rd,208 Haywood Rd,209 Haywood Rd,210 Haywood Rd,211 Haywood Rd,212 Haywood Rd,213 Haywood Rd'
        }
    }, 'truncate excessive synonyms');

    t.equals(result.properties['carmen:text'].split(',').length, 10, 'only 10 synonyms');

    t.end();
});

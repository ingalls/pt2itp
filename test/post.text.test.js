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
            'carmen:text': [{ display: 'Main Street', priority: 0, freq: 1, tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] }],
            'carmen:text_xx': [{ display: 'Spring Rd', priority: 0, freq: 1, tokenized: [{ token: 'spring', token_type: null }, { token: 'rd', token_type: 'Way' }] }]
        }
    }), {
        properties: {
            'carmen:text': 'Main Street',
            'carmen:text_xx': 'Spring Rd'
        }
    }, 'preserve basic feature');

    t.deepEquals(post({
        properties: {
            'carmen:text': [
                { freq: 12, display: 'Main Street', priority: 0, tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] },
                { freq: 2, display: 'Some Other St', priority: 0, tokenized: [{ token: 'some', token_type: null }, { token: 'other', token_type: null }, { token: 'st', token_type: 'Way' }] },
                { freq: 1, display: 'Main Street', priority: 0, tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] }
            ],
            'carmen:text_xx': [
                { freq: 1, display: 'Spring Rd', priority: 0, tokenized: [{ token: 'spring', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { freq: 1, display: 'Spring Rd', priority: 0, tokenized: [{ token: 'spring', token_type: null }, { token: 'rd', token_type: 'Way' }] }
            ]
        }
    }), {
        properties: {
            'carmen:text': 'Main Street,Some Other St',
            'carmen:text_xx': 'Spring Rd'
        }
    }, 'dedupe identical strings');

    t.deepEquals(post({
        properties: {
            'carmen:text': [
                { freq: 12, display: 'Main St', priority: 0, tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] },
                { freq: 1, display: 'Some Other St', priority: 0, tokenized: [{ token: 'some', token_type: null }, { token: 'other', token_type: null }, { token: 'st', token_type: 'Way' }] },
                { freq: 12, display: 'Main Street', priority: 0, tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] }
            ],
            'carmen:text_xx': [
                { freq: 1, display: 'Spring Road', priority: 0, tokenized: [{ token: 'spring', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { freq: 1, display: 'Spring Rd', priority: 0, tokenized: [{ token: 'spring', token_type: null }, { token: 'rd', token_type: 'Way' }] }
            ],
            'carmen:text_es': [
                { freq: 1, display: 'Pta Something', priority: 1, tokenized: [{ token: 'pta', token_type: null }, { token: 'something', token_type: null }] },
                { freq: 2, display: 'Spring Road', priority: 0, tokenized: [{ token: 'spring', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { freq: 12, display: 'Puerta Something', priority: 0, tokenized: [{ token: 'puerta', token_type: null }, { token: 'something', token_type: null }] }
            ]
        }
    }), {
        properties: {
            'carmen:text': 'Main Street,Some Other St',
            'carmen:text_xx': 'Spring Road',
            'carmen:text_es': 'Pta Something,Puerta Something,Spring Road'

        }
    }, 'dedupe tokens, single language');

    t.deepEquals(post({
        properties: {
            'carmen:text': [
                { display: '204 Haywood Rd', freq: 1, priority: 0, tokenized: [{ token: '204', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '201 Haywood Rd', freq: 1, priority: 0, tokenized: [{ token: '201', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '202 Haywood Rd', freq: 1, priority: 0, tokenized: [{ token: '202', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '203 Haywood Rd', freq: 1, priority: 0, tokenized: [{ token: '203', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '208 Haywood Rd', freq: 1, priority: 0, tokenized: [{ token: '208', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '209 Haywood Rd', freq: 1, priority: 0, tokenized: [{ token: '209', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '210 Haywood Rd', freq: 1, priority: 0, tokenized: [{ token: '210', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '211 Haywood Rd', freq: 1, priority: 0, tokenized: [{ token: '211', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '212 Haywood Rd', freq: 1, priority: 0, tokenized: [{ token: '212', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '213 Haywood Rd', freq: 1, priority: 0, tokenized: [{ token: '213', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '214 Haywood Rd', freq: 1, priority: 0, tokenized: [{ token: '214', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '215 Haywood Rd', freq: 1, priority: 0, tokenized: [{ token: '215', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '216 Haywood Rd', freq: 1, priority: 0, tokenized: [{ token: '216', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '217 Haywood Rd', freq: 1, priority: 0, tokenized: [{ token: '217', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] },
                { display: '218 Haywood Rd', freq: 1, priority: 0, tokenized: [{ token: '218', token_type: null }, { token: 'haywood', token_type: null }, { token: 'rd', token_type: 'Way' }] }
            ]
        }
    }), {
        properties: {
            'carmen:text': '204 Haywood Rd,201 Haywood Rd,202 Haywood Rd,203 Haywood Rd,208 Haywood Rd,209 Haywood Rd,210 Haywood Rd,211 Haywood Rd,212 Haywood Rd,213 Haywood Rd'
        }
    }, 'dedupe tokens, excessive synonyms');

    t.end();
});

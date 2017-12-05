const post = require('../lib/post/dedupe-text').post;
const test = require('tape');

test('Post: Dedupe', (t) => {
    t.deepEquals(post(), undefined, 'return unprocessable 1');

    t.deepEquals(post({
        properties: undefined
    }), {
        properties: undefined
    }, 'return unprocessable 2');

    t.deepEquals(post({
        properties: {
            'carmen:text': 'Main Street',
            'carmen:text_xx': 'Spring Rd'
        }
    }), {
        properties: {
            'carmen:text': 'Main Street',
            'carmen:text_xx': 'Spring Rd'
        }
    }, 'preserve basic feature');

    t.deepEquals(post({
        properties: {
            'carmen:text': 'Main Street,Some Other St,Main Street',
            'carmen:text_xx': 'Spring Rd,Spring Rd'
        }
    }), {
        properties: {
            'carmen:text': 'Main Street,Some Other St',
            'carmen:text_xx': 'Spring Rd'
        }
    }, 'dedupe identical strings');

    t.deepEquals(post({
        properties: {
            'carmen:text': 'Main St,Some Other St,Main Street',
            'carmen:text_xx': 'Spring Road,Spring Rd',
            'carmen:text_es': 'Pta Something,Spring Road,Puerta Something'
        }
    }, { tokens: 'en' }), {
        properties: {
            'carmen:text': 'Main Street,Some Other St',
            'carmen:text_xx': 'Spring Road',
            'carmen:text_es': 'Pta Something,Spring Road,Puerta Something'

        }
    }, 'dedupe tokens, single language');

    t.deepEquals(post({
        properties: {
            'carmen:text': 'Main St,Some Other St,Main Street',
            'carmen:text_xx': 'Spring Road,Spring Rd',
            'carmen:text_es': 'Pta Something,Spring Road,Puerta Something'
        }
    }, { tokens: ['en', 'es'] }), {
        properties: {
            'carmen:text': 'Main Street,Some Other St',
            'carmen:text_xx': 'Spring Road',
            'carmen:text_es': 'Puerta Something,Spring Road'

        }
    }, 'dedupe tokens, multi language');

    t.deepEquals(post({
        properties: {
            'carmen:text': '204 Haywood Rd,201 Haywood Rd,202 Haywood Rd,203 Haywood Rd,208 Haywood Rd,209 Haywood Rd,210 Haywood Rd,211 Haywood Rd,212 Haywood Rd,213 Haywood Rd,214 Haywood Rd,215 Haywood Rd,216 Haywood Rd,217 Haywood Rd,218 Haywood Rd',
            'carmen:text_xx': '204 Haywood Rd,201 Haywood Rd,202 Haywood Rd,203 Haywood Rd,208 Haywood Rd,209 Haywood Rd,210 Haywood Rd,211 Haywood Rd,212 Haywood Rd,213 Haywood Rd,214 Haywood Rd,215 Haywood Rd,216 Haywood Rd,217 Haywood Rd,218 Haywood Rd'
        }
    }, { tokens: ['en', 'es'] }), {
        properties: {
            'carmen:text': '204 Haywood Rd,201 Haywood Rd,202 Haywood Rd,203 Haywood Rd,208 Haywood Rd,209 Haywood Rd,210 Haywood Rd,211 Haywood Rd,212 Haywood Rd,213 Haywood Rd',
            'carmen:text_xx': '204 Haywood Rd,201 Haywood Rd,202 Haywood Rd,203 Haywood Rd,208 Haywood Rd,209 Haywood Rd,210 Haywood Rd,211 Haywood Rd,212 Haywood Rd,213 Haywood Rd'
        }
    }, 'dedupe tokens, excessive synonyms');

    t.end();
});

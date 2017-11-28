const post = require('../lib/post/discard-empty-text').post;
const test = require('tape');

test('Post: Dedupe', (t) => {
    t.deepEquals(post(), false, 'return unprocessable 1');

    t.deepEquals(post({
        properties: undefined
    }), false, 'return unprocessable 2');

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
            'carmen:text': '',
            'carmen:text_xx': 'Spring Rd,Spring Rd'
        }
    }), false, 'false on empty string');

    t.deepEquals(post({
        properties: {
            'carmen:text': ' '
        }
    }), false, 'false on empty trimmed string');

    t.end();
});

const tokenize = require('../lib/tokenize').main;
const diacritics = require('diacritics').remove;
const test = require('tape');

test('Uses replacement tokens', (t) => {
    t.deepEqual(diacritics(tokenize('7 Greenview Rd', undefined).join(' ')), '7 greenview rd', 'handles undefined token replacer');
    t.end();
});
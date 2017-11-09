const tokenize = require('../lib/tokenize').main;
const diacritics = require('diacritics').remove;
const test = require('tape');

test('Handles replacer argument', (t) => {
    t.deepEqual(tokenize('2 Greenview Rd', undefined), [ '2', 'greenview', 'rd' ], 'handles undefined token replacer');
    t.deepEqual(tokenize('2 Greenview Rd', null), [ '2', 'greenview', 'rd' ], 'handles null token replacer');
    t.throws(() => { tokenize('2 Greenview Rd', 'undefined') }, 'Replacer must be a hashmap', 'throws an error given non-object (\'undefined\') token replacer');
    t.throws(() => { tokenize('2 Greenview Rd', 'null') }, 'Replacer must be a hashmap', 'throws an error given non-object (\'null\') token replacer');
    t.end();
});
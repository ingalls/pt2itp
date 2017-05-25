const tokenize = require('../lib/tokenize');
const test = require('tape');
const fs = require('fs');

test('tokenizes basic strings', (t) => {
    t.deepEqual(tokenize.main('foo'), ['foo']);
    t.deepEqual(tokenize.main('foo bar'), ['foo', 'bar']);
    t.deepEqual(tokenize.main('foo-bar'), ['foo', 'bar'], 'splits on - (non-numeric)');
    t.deepEqual(tokenize.main('foo+bar'), ['foo', 'bar'], 'splits on +');
    t.deepEqual(tokenize.main('foo_bar'), ['foo', 'bar'], 'splits on _');
    t.deepEqual(tokenize.main('foo:bar'), ['foo', 'bar'], 'splits on :');
    t.deepEqual(tokenize.main('foo;bar'), ['foo', 'bar'], 'splits on ;');
    t.deepEqual(tokenize.main('foo|bar'), ['foo', 'bar'], 'splits on |');
    t.deepEqual(tokenize.main('foo}bar'), ['foo', 'bar'], 'splits on }');
    t.deepEqual(tokenize.main('foo{bar'), ['foo', 'bar'], 'splits on {');
    t.deepEqual(tokenize.main('foo[bar'), ['foo', 'bar'], 'splits on [');
    t.deepEqual(tokenize.main('foo]bar'), ['foo', 'bar'], 'splits on ]');
    t.deepEqual(tokenize.main('foo(bar'), ['foo', 'bar'], 'splits on (');
    t.deepEqual(tokenize.main('foo)bar'), ['foo', 'bar'], 'splits on )');
    t.deepEqual(tokenize.main('foo b.a.r'), ['foo', 'bar'], 'collapses .');
    t.deepEqual(tokenize.main('foo\'s bar'), ['foos', 'bar'], 'collapses apostraphe');
    t.deepEqual(tokenize.main('69-150'), ['69-150']);
    t.deepEqual(tokenize.main('4-10'), ['4-10']);
    t.deepEqual(tokenize.main('5-02A'), ['5-02a']);
    t.deepEqual(tokenize.main('23-'), ['23']);
    t.deepEqual(tokenize.main('San José'), ['san', 'josé']);
    t.deepEqual(tokenize.main('Chamonix-Mont-Blanc'), ['chamonix','mont','blanc']);
    t.deepEqual(tokenize.main('Москва'), ['москва']);
    t.deepEqual(tokenize.main('京都市'), ['京都市']);
    t.end();
});

test('Uses replacement tokens', (t) => {
    t.deepEqual(tokenize.main('foo', null), ['foo'], 'handles null token replacer');
    t.deepEqual(tokenize.main('foo', {}), ['foo'], 'handles empty args');
    t.deepEqual(tokenize.main('foo', { tokens: [] }), ['foo'], 'handles empty tokens array');
    t.deepEqual(tokenize.main('barter', { 'barter': 'foo' }), ['foo'], 'basic single replacement');
    t.end();
});

test('edge cases - empty string', (t) => {
    t.deepEqual(tokenize.main(''), []);
    t.end();
});

test('test for global tokens', (t) => {
    let tokens = {'\\b(.+)(strasse|str|straße)\\b': "$1 str"};
    let query = 'talstrasse';
    let tokensRegex = tokenize.createGlobalReplacer(tokens);
    let replace = tokenize.replaceToken(tokensRegex, query);
    t.deepEqual('tal str', replace, 'handles global tokens - Strasse');
    t.end();
});


test('test for global tokens', (t) => {
    let tokens = {'\\bPost Office\\b': "Po"};
    let query = 'Post Office 25';
    let tokensRegex = tokenize.createGlobalReplacer(tokens);
    let replace = tokenize.replaceToken(tokensRegex, query);
    t.deepEqual('Po 25', replace, 'handles global tokens - Post Office');
    t.end();
});

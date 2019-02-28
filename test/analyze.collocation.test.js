const collocation = require('../lib/analyze/collocation');
const FrequencyDistribution = collocation.FrequencyDistribution;
const BiGramCollocationTable = collocation.BiGramCollocationTable;
const TriGramCollocationTable = collocation.TriGramCollocationTable;
const test = require('tape');
const fs = require('fs');

const testArray = ["the", "cat", "chased", "the", "mouse"];
const testEntries = [["the", 2], ["cat", 1], ["chased", 1], ["mouse", 1]];
const testMap = new Map(testEntries);

const db = require('./lib/db');
db.init(test);

test('FrequencyDistribution.arrayToCounts', (t) => {
    freqDist = new FrequencyDistribution();
    t.deepEqual(
        freqDist.arrayToCounts(testArray),
        testMap
    );

    t.end();
});

test('FrequencyDistribution init', (t) => {
    const freqDistFromArray = new FrequencyDistribution(testArray);
    const freqDistFromMap = new FrequencyDistribution(testMap);

    t.deepEqual(freqDistFromArray, freqDistFromMap, 'constructing FrequencyDistribution from array or map should not differ');
    t.deepEqual(freqDistFromArray.n(), freqDistFromMap.n(), 'N should be the same for array or map');
    t.deepEqual(freqDistFromArray.binCount(), freqDistFromMap.binCount(), 'bin count should be the same for array or map');

    t.ok(new FrequencyDistribution(), 'ok to init FrequencyDistribution without data');

    t.end();

});

test('FrequencyDistribution key functions', (t) => {
    const freqDist = new FrequencyDistribution(testArray);

    t.deepEqual(freqDist.makeKey('two'), 'two', 'makeKey for string');
    t.deepEqual(freqDist.unmakeKey('two'), 'two', 'unmakeKey for string');

    t.deepEqual(freqDist.makeKey(2), '2', 'makeKey for number');
    t.deepEqual(freqDist.unmakeKey('2'), 2, 'unmakeKey for number');

    t.deepEqual(
        freqDist.makeKey(['first', 'second', 'third']),
        'first|second|third',
        'makeKey(Array)'
    );

    t.deepEqual(
        freqDist.unmakeKey('first|second|third'),
        ['first', 'second', 'third'],
        'makeKey(Array)'
    );

    const testObject = {a:2, b: ['a','b',3], c: { c1: 2, c2: "two", c3: ['x', 'y', 26.5] }, d: 'dee'};
    const stringifiedTestObject = '{"a":2,"b":["a","b",3],"c":{"c1":2,"c2":"two","c3":["x","y",26.5]},"d":"dee"}';

    t.deepEqual(
        freqDist.makeKey(testObject),
        stringifiedTestObject,
        'makeKey(string)'
    );

    t.deepEqual(
        freqDist.unmakeKey(stringifiedTestObject),
        testObject,
        'makeKey(string)'
    );

    t.end();
});

test('FrequencyDistribution API', (t) => {
    const freqDist = new FrequencyDistribution(testArray);

    t.deepEqual([...freqDist.keys()], ['the', 'cat', 'chased', 'mouse'], 'keys()');
    t.deepEqual([...freqDist.entries()], testEntries, 'entries()');

    t.deepEqual(freqDist.has('cat'), true, 'has()');
    t.deepEqual(freqDist.has('dog'), false, 'has()');

    t.deepEqual(freqDist.get('cat'), 1, 'get()');
    t.deepEqual(freqDist.get('the'), 2, 'get()');

    freqDist.set(['the', 'cat'], 999);
    t.deepEqual(freqDist.get(['the', 'cat']), 999, 'set()');

    freqDist.increment(['the', 'cat'], 1);
    t.deepEqual(freqDist.get(['the', 'cat']), 1000, 'increment()');

    t.end();
});


const testTokens = [
    "the", "cat", "chased", "the", "mouse",
    "and", "then", "a", "dog", "chased", "the", "cat"
];

const expectedUniGramCounts = new Map([
    [ 'the', 3 ],
    [ 'cat', 2 ],
    [ 'chased', 2 ],
    [ 'mouse', 1 ],
    [ 'and', 1 ],
    [ 'then', 1 ],
    [ 'a', 1 ],
    [ 'dog', 1 ]
]);

const expectedBiGramCounts = new Map([
    [ 'the|cat', 2 ],
    [ 'cat|chased', 1 ],
    [ 'chased|the', 2 ],
    [ 'the|mouse', 1 ],
    [ 'mouse|and', 1 ],
    [ 'and|then', 1 ],
    [ 'then|a', 1 ],
    [ 'a|dog', 1 ],
    [ 'dog|chased', 1 ]
]);

const expectedTriGramCounts = new Map([
    [ 'the|cat|chased', 1 ],
    [ 'cat|chased|the', 1 ],
    [ 'chased|the|mouse', 1 ],
    [ 'the|mouse|and', 1 ],
    [ 'mouse|and|then', 1 ],
    [ 'and|then|a', 1 ],
    [ 'then|a|dog', 1 ],
    [ 'a|dog|chased', 1 ],
    [ 'dog|chased|the', 1 ],
    [ 'chased|the|cat', 1 ],
]);


test('FrequencyDistribution stats', (t) => {
    const freqDist = new FrequencyDistribution(testArray);

    t.deepEqual(freqDist.n(), 5, 'N should be 5');
    t.deepEqual(freqDist.binCount(), 4, 'bin count should be 4');
    t.deepEqual(freqDist.absoluteFrequency('the'), 2, 'absolute frequency of "the" sb 2');
    t.deepEqual(freqDist.relativeFrequency('the'), 0.4, 'relative frequency of "the" sb 2/5 = 0.4');

    freqDist.update(["and", "then", "a"]);
    t.deepEqual(freqDist.absoluteFrequency('the'), 2, 'after update, still 2 "the"s');
    t.deepEqual(freqDist.relativeFrequency('the'), 0.25, 'after update, relative frequency is 2/8 = 0.25');
    t.deepEqual(freqDist.binCount(), 7, 'after update, bin count is 7');

    freqDist.update(["dog", "chased", "the", "cat"]);
    t.deepEqual(freqDist.absoluteFrequency('the'), 3, 'after next update, now 3 "the"s');
    t.deepEqual(freqDist.binCount(), 8, 'after next update, bin count is 8');

    const expectedCounts = new Map([
        [ 'the', 3 ],
        [ 'cat', 2 ],
        [ 'chased', 2 ],
        [ 'mouse', 1 ],
        [ 'and', 1 ],
        [ 'then', 1 ],
        [ 'a', 1 ],
        [ 'dog', 1 ]
    ]);

    t.deepEqual(freqDist.frequencies, expectedCounts);
    t.end();

});


test('BiGramCollocationTable', (t) => {

    bigrams = new BiGramCollocationTable();

    bigrams.update(testTokens);

    t.deepEqual(
        bigrams.unigram_fd.frequencies,
        expectedUniGramCounts,
        'expected unigram frequencies'
    );

    t.deepEqual(
        bigrams.bigram_fd.frequencies,
        expectedBiGramCounts,
        'expected bigram frequencies'
    );
    t.end();
});

test('TriGramCollocationTable', (t) => {

    trigrams = new TriGramCollocationTable();

    trigrams.update(testTokens);

    t.deepEqual(
        trigrams.unigram_fd.frequencies,
        expectedUniGramCounts,
        'expected unigram frequencies'
    );

    t.deepEqual(
        trigrams.bigram_fd.frequencies,
        expectedBiGramCounts,
        'expected bigram frequencies'
    );

    t.deepEqual(
        trigrams.trigram_fd.frequencies,
        expectedTriGramCounts,
        'expected trigram frequencies'
    );

    t.end();
});

test('Collocation Merges', (t) => {
    const testTokens_a = testTokens.slice(0,5);
    const testTokens_b = testTokens.slice(5);

    bigram_a = new BiGramCollocationTable();
    bigram_a.update(testTokens_a);

    bigram_b = new BiGramCollocationTable();
    bigram_b.update(testTokens_b);

    bigram_a.merge(bigram_b);


    t.deepEqual(
        bigram_a.unigram_fd.frequencies,
        expectedUniGramCounts,
        'after merging two bigram tables, expected unigram frequencies'
    );

    t.deepEqual(
        bigram_a.bigram_fd.frequencies,
        expectedBiGramCounts,
        'after merging two bigram tables, expected bigram frequencies'
    );

    trigram_a = new TriGramCollocationTable();
    trigram_a.update(testTokens_a);

    trigram_b = new TriGramCollocationTable();
    trigram_b.update(testTokens_b);

    trigram_a.merge(trigram_b);

    t.deepEqual(
        trigram_a.unigram_fd.frequencies,
        expectedUniGramCounts,
        'after merging two trigram tables, expected unigram frequencies'
    );

    t.deepEqual(
        trigram_a.bigram_fd.frequencies,
        expectedBiGramCounts,
        'after merging two trigram tables, expected bigram frequencies'
    );

    t.deepEqual(
        trigram_a.trigram_fd.frequencies,
        expectedTriGramCounts,
        'after merging two trigram tables, expected trigram frequencies'
    );

    t.end();
});


test('BiGramCollocationTable Metrics', (t) => {
    const bigrams = new BiGramCollocationTable();
    bigrams.update(testTokens);

    const expectedContingency = [
        2, // n_ii, or freq of ["the",      "cat"     ]
        0, // n_oi, or freq of [not("the"), "cat"     ]
        1, // n_io, or freq of ["the",      not("cat")]
        9 // n_oo, of freq of [not("the"), not("cat")]
    ];

    t.deepEqual(
        bigrams.getContingency(['the', 'cat']),
        [2, 0, 1, 9],
        'BiGramCollocationTable.getContingency'
    );

    t.deepEqual(
        bigrams.getExpectedFrequencies([2, 0, 1, 9]),
        [ 0.5, 1.5, 2.5, 7.5],
        'BiGramCollocationTable.getExpectedFrequencies'
    );

    t.deepEqual(
        bigrams.likelihoodRatio(['the', 'cat']),
        6.994384003022435,
        'BiGramCollocationTable.likelihoodRatio'
    );

    const expectedScores = [
        { w1: 'the', w2: 'cat', frequency: 2, likelihoodRatio: 6.994384003022435 },
        { w1: 'cat', w2: 'chased', frequency: 1, likelihoodRatio: 1.5392208227225637 },
        { w1: 'chased', w2: 'the', frequency: 2, likelihoodRatio: 6.994384003022435 },
        { w1: 'the', w2: 'mouse', frequency: 1, likelihoodRatio: 3.064978583578977 },
        { w1: 'mouse', w2: 'and', frequency: 1, likelihoodRatio: 6.884063593347854 },
        { w1: 'and', w2: 'then', frequency: 1, likelihoodRatio: 6.884063593347854 },
        { w1: 'then', w2: 'a', frequency: 1, likelihoodRatio: 6.884063593347854 },
        { w1: 'a', w2: 'dog', frequency: 1, likelihoodRatio: 6.884063593347854 },
        { w1: 'dog', w2: 'chased', frequency: 1, likelihoodRatio: 4.1114748711080775 }
    ]

    t.deepEqual(
        [...bigrams.score_ngrams('likelihoodRatio')],
        expectedScores,
        'BiGramCollocationTable.score_ngrams'
    );


    t.end();
});


test('TriGramCollocationTable Metrics', (t) => {
    const trigrams = new TriGramCollocationTable();
    trigrams.update(testTokens);

    const expectedContingency = [
        1, // n_iii, or freq of ["chased",      "the",      "cat"      ]
        1, // n_oii, or freq of [not("chased"), "the",      "cat"      ]
        0, // n_ioi, or freq of ["chased",      not("the"), "cat"      ]
        0, // n_ooi, or freq of [not("chased"), not("the"), "cat"      ]
        1, // n_iio, or freq of ["chased",      "the",      not("cat") ]
        0, // n_oio, or freq of [not("chased"), "the",      not("cat") ]
        0, // n_ioo, or freq of ["chased",      not("the"), not("cat") ]
        9 // n_ooo, or freq of [not("chased"), not("the"), not("cat") ]
    ];

    t.deepEqual(
        trigrams.getContingency(['chased', 'the', 'cat']),
        expectedContingency,
        'TriGramCollocationTable.getContingency'
    );

    const expectedExpectedFrequencies = [
        0.08333333333333333,
        0.4166666666666667,
        0.25,
        1.25,
        0.4166666666666667,
        2.0833333333333335,
        1.25,
        6.25
    ];

    t.deepEqual(
        trigrams.getExpectedFrequencies(expectedContingency),
        expectedExpectedFrequencies,
        'TriGramCollocationTable.getExpectedFrequencies'
    );

    t.deepEqual(
        trigrams.likelihoodRatio(['chased', 'the', 'cat']),
        22.55289644036095,
        'TriGramCollocationTable.likelihoodRatio'
    );

    const expectedScores = [
        { w1: 'the', w2: 'cat', w3: 'chased', frequency: 1, likelihoodRatio: 13.134429852599089 },
        { w1: 'cat', w2: 'chased', w3: 'the', frequency: 1, likelihoodRatio: 13.134429852599089 },
        { w1: 'chased', w2: 'the', w3: 'mouse', frequency: 1, likelihoodRatio: 16.658788311195764 },
        { w1: 'the', w2: 'mouse', w3: 'and', frequency: 1, likelihoodRatio: 14.923563265390252 },
        { w1: 'mouse', w2: 'and', w3: 'then', frequency: 1, likelihoodRatio: 20.65219078004357 },
        { w1: 'and', w2: 'then', w3: 'a', frequency: 1, likelihoodRatio: 20.65219078004357 },
        { w1: 'then', w2: 'a', w3: 'dog', frequency: 1, likelihoodRatio: 20.65219078004357 },
        { w1: 'a', w2: 'dog', w3: 'chased', frequency: 1, likelihoodRatio: 16.49330769668389 },
        { w1: 'dog', w2: 'chased', w3: 'the', frequency: 1, likelihoodRatio: 16.658788311195764 },
        { w1: 'chased', w2: 'the', w3: 'cat', frequency: 1, likelihoodRatio: 22.55289644036095 }
    ];

    t.deepEqual(
        [...trigrams.score_ngrams('likelihoodRatio')],
        expectedScores,
        'TriGramCollocationTable.score_ngrams'
    );

    t.end();
});


test('Short Sequences', (t) => {
    const bigrams = new BiGramCollocationTable();
    bigrams.update([['the']]);
    t.end();
});

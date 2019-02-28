const convert = require('../native/index.node').convert;
const test = require('tape');
const path = require('path');
const os = require('os');

const db = require('./lib/db');
db.init(test);

test('Convert - FeatureCollection', (t) => {
    convert({
        input: String(path.resolve(__dirname, 'fixtures/convert.FeatureCollection')),
        output: String(path.resolve(os.tmpdir(), 'convert.FeatureCollection.json'))
    });

    let res = require(path.resolve(os.tmpdir(), 'convert.FeatureCollection.json'));

    t.equals(res.type, 'FeatureCollection');
    t.equals(res.features.length, 24);

    res.features.forEach((feat) => {
        t.equals(feat.type, 'Feature');
    });

    t.end();
});

test('Convert - Feature', (t) => {
    convert({
        input: path.resolve(__dirname, 'fixtures/convert.Feature'),
        output: path.resolve(os.tmpdir(), 'convert.Feature.json')
    });

    let res = require(path.resolve(os.tmpdir(), 'convert.Feature.json'));

    t.equals(res.type, 'FeatureCollection');
    t.equals(res.features.length, 10);

    res.features.forEach((feat) => {
        t.equals(feat.type, 'Feature');
    });

    t.end();
});

test('Convert - Raw', (t) => {
    convert({
        input: path.resolve(__dirname, 'fixtures/convert.Raw'),
        output: path.resolve(os.tmpdir(), 'convert.Raw.json')
    });

    let res = require(os.tmpdir() + '/' + 'convert.Raw.json');

    t.equals(res.type, 'FeatureCollection');
    t.equals(res.features.length, 10);

    res.features.forEach((feat) => {
        t.equals(feat.type, 'Feature');
    });

    t.end();
});

test('Convert - Raw With Record Separator', (t) => {
    convert({
        input: path.resolve(__dirname, 'fixtures/convert.RawWithRecordSeparator'),
        output: path.resolve(os.tmpdir(), 'convert.RawWithRecordSeparator.json')
    });

    let res = require(os.tmpdir() + '/' + 'convert.RawWithRecordSeparator.json');

    t.equals(res.type, 'FeatureCollection');
    t.equals(res.features.length, 10);

    res.features.forEach((feat) => {
        t.equals(feat.type, 'Feature');
    });

    t.end();
});

'use strict';

const test = require('tape');
const spawn = require('tape-spawn');

const db = require('./lib/db');
db.init(test);

test('help - main', (t) => {
    const st = spawn(t, `${__dirname}/../index.js`);

    st.stdout.match(/usage: index.js <command> \[--version\] \[--help\]/);
    st.end();
});

test('help - convert', (t) => {
    const st = spawn(t, `${__dirname}/../index.js convert --help`);

    st.stdout.match(/Convert a Line-Delimited GeoJSON Features into a single FeatureCollection/);
    st.end();
});

test('help - strip', (t) => {
    const st = spawn(t, `${__dirname}/../index.js strip --help`);

    st.stdout.match(/Strip out Address Points from map mode \(ITP\) output/);
    st.end();
});

test('help - conflate', (t) => {
    const st = spawn(t, `${__dirname}/../index.js conflate --help`);

    st.stdout.match(/Given a new address file, apply it to an existing address file, deduping and conflating where possible/);
    st.end();
});

test('help - map', (t) => {
    const st = spawn(t, `${__dirname}/../index.js map --help`);

    st.stdout.match(/Given a road network and a set of address points as line delimited geojson; output an interpolation network/);
    st.end();
});

test('help - stat', (t) => {
    const st = spawn(t, `${__dirname}/../index.js stat --help`);

    st.stdout.match(/Generate stats about addresses in the computed ITP file/);
    st.end();
});

test('help - debug', (t) => {
    const st = spawn(t, `${__dirname}/../index.js debug --help`);

    st.stdout.match(/Start up an interactive web server to visualize how matches were made between network\/addresses/);
    st.end();
});

test('help - test', (t) => {
    const st = spawn(t, `${__dirname}/../index.js test --help`);

    st.stdout.match(/Take Carmen Indexes and test them for completeness against the original input address data/);
    st.end();
});

test('help - testcsv', (t) => {
    const st = spawn(t, `${__dirname}/../index.js testcsv --help`);

    st.stdout.match(/Take Carmen Indexes and test them against a given CSV file/);
    st.end();
});

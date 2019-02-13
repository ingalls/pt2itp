const worker = require('../index');

const test = require('tape');
const spawn = require('tape-spawn');
const path = require('path');
const fs = require('fs');
const pg = require('pg');

test('help - main', (t) => {
    let st = spawn(t, `${__dirname}/../index.js`);

    st.stdout.match(/usage: index.js <command> \[--version\] \[--help\]/);
    st.end();
});

test('help - analyze', (t) => {
    let st = spawn(t, `${__dirname}/../index.js analyze --help`);

    st.stdout.match(/Analyses text in the address_cluster and network_cluster tables/);
    st.end();
});

test('help - convert', (t) => {
    let st = spawn(t, `${__dirname}/../index.js convert --help`);

    st.stdout.match(/Convert a Line-Delimited GeoJSON Features into a single FeatureCollection/);
    st.end();
});

test('help - strip', (t) => {
    let st = spawn(t, `${__dirname}/../index.js strip --help`);

    st.stdout.match(/Strip out Address Points from map mode \(ITP\) output/);
    st.end();
});

test('help - conflate', (t) => {
    let st = spawn(t, `${__dirname}/../index.js conflate --help`);

    st.stdout.match(/Given a new address file, apply it to an existing address file, deduping and conflating where possible/);
    st.end();
});

test('help - map', (t) => {
    let st = spawn(t, `${__dirname}/../index.js map --help`);

    st.stdout.match(/Given a road network and a set of address points as line delimited geojson; output an interpolation network/);
    st.end();
});

test('help - stat', (t) => {
    let st = spawn(t, `${__dirname}/../index.js stat --help`);

    st.stdout.match(/Generate stats about addresses in the computed ITP file/);
    st.end();
});

test('help - debug', (t) => {
    let st = spawn(t, `${__dirname}/../index.js debug --help`);

    st.stdout.match(/Start up an interactive web server to visualize how matches were made between network\/addresses/);
    st.end();
});

test('help - test', (t) => {
    let st = spawn(t, `${__dirname}/../index.js test --help`);

    st.stdout.match(/Take Carmen Indexes and test them for completeness against the original input address data/);
    st.end();
});

test('help - testcsv', (t) => {
    let st = spawn(t, `${__dirname}/../index.js testcsv --help`);

    st.stdout.match(/Take Carmen Indexes and test them against a given CSV file/);
    st.end();
});

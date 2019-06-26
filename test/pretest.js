#! /usr/bin/env node

'use strict';

const files = [
    'counties.geojson',
    'us_dc_addr.geojson',
    'us_dc_str.geojson'
];

const Q = require('d3-queue').queue;
const fs = require('fs');
const request = require('request');

if (require.main === module) {
    return get();
}

function get() {
    const q = new Q();

    for (const file of files) {
        try {
            fs.accessSync('/tmp/counties');
        } catch (err) {
            q.defer((file, done) => {
                const output = fs.createWriteStream(`/tmp/${file}`).on('close', done);
                request(`https://mapbox.s3.amazonaws.com/pt2itp/fixtures/${file}`).pipe(output);
            }, file);
        }
    }

    q.awaitAll((err) => {
        if (err) throw err;
    });
}

function has() {
    for (const file of files) {
        try {
            fs.accessSync(`/tmp/${file}`);
        } catch (err) {
            throw new Error(`Missing ${file}`);
        }
    }

    return true;
}

module.exports = {
    get: get,
    has: has
};

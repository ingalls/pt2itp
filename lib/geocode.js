#!/usr/bin/env node

const path = require('path');
const Carmen = require('@mapbox/carmen');
const MBTiles = require('@mapbox/mbtiles');
const tokens = require('@mapbox/geocoder-abbreviations');
const diacritics = require('diacritics').remove;
const turf = require('@turf/turf');
const tokenize = require('./tokenize').main;

/**
 * Return true or false if the query passed the matching criteria with the result
 * @param {string} query The query geocoded
 * @param {Array} pt an array of the format [lon,lat] representing the known coords of the query
 * @param {Object} res The GeoJSON FeatureCollection returned by carmen
 * @param {Object} opts Geocoding metadata
 * @param {function} done Callback fxn
 * @return {function}
 */
function isPass(query, pt, res, opts, done) {
    let cleanQuery = diacritics(tokenize(query, opts.tokens).join(' '));

    if (!res.features.length) {
        if (opts.stats) opts.stats.fail++;
        return done(null, ['NO RESULTS', { query: cleanQuery, queryPoint: pt.join(',')}]);
    }

    let matched = diacritics(tokenize(res.features[0].place_name, opts.tokens).join(' '));

    let dist = false;
    if (res.features[0].geometry.type === 'Point') {
        dist = turf.distance(res.features[0].geometry.coordinates, pt, 'kilometers');
    }

    if (matched !== cleanQuery) {
        if (opts.stats) opts.stats.fail++;
        return done(null, ['TEXT', { query: cleanQuery, queryPoint: pt.join(','), addressText: matched }]);
    } else if (dist && dist > 1) {
        if (opts.stats) opts.stats.fail++;
        return done(null, ['DIST', { distance: dist.toFixed(2), returnedPoint: res.features[0].geometry.coordinates.join(','), query: query, queryPoint: pt.join(',') }]);
    } else if (dist === false) { //Usually a street level result
        if (opts.stats) opts.stats.fail++;
        return done(null, ['DIST', { distance: 'false', queryPoint: pt.join(',') } ]);
    }

    return done();
}

/**
 * Instantiate a new carmen object to be able to geocode against
 * @param {Object} param parameters object
 * @return {Object} Carmen Instance
 */
function localCarmen(param) {
    if (!param.index) throw new Error('param.index not specified');

    const opts = {
        address: new MBTiles(path.resolve(param.index), () => {})
    };

    if (param.getInfo.metadata) param.getInfo = param.getInfo.metadata; //Necessary for internal use

    delete param.getInfo.tiles;
    delete param.getInfo.geocoder_data;
    delete param.getInfo.geocoder_format;

    opts.address.getInfo = (cb) => {
        return cb(null, param.getInfo);
    };

    let carmen = new Carmen(opts, { tokens: tokens().global });
    return carmen;
}

if (require.main === module) {
    let argv = require('minimist')(process.argv, {
        string: [
            'query',
            'index',
            'config',
            'proximity'
        ],
        alias: {
            query: 'q',
            index: 'i',
            config: 'c',
            proximity: 'p'
        }
    });
    if (!argv.query) {
        console.error('--query=<QUERY> argument required');
        process.exit(1);
    } else if (!argv.index) {
        console.error('--index=<INDEX.mbtiles> argument required');
        process.exit(1);
    } else if (!argv.config) {
        console.error('--config=<CONFIG.json> argument required');
        process.exit(1);
    }

    let c = localCarmen({ index: argv.index, getInfo: require(path.resolve(argv.config)) });

    let opts = {};
    if (argv.proximity)
        opts.proximity = argv.proximity.split(',').map(parseFloat);

    c.geocode(argv.query, opts, (err, res) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        console.log(JSON.stringify(res, null, 2));
    });
}

module.exports = localCarmen;
module.exports.isPass = isPass;

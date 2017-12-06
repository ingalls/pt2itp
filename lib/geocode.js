#!/usr/bin/env node

const path = require('path');
const Carmen = require('@mapbox/carmen');
const MBTiles = require('@mapbox/mbtiles');
const tokens = require('@mapbox/geocoder-abbreviations');
const sstat = require('simple-statistics');
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
    let cleanQuery = tokenize(diacritics(query), opts.tokens);

    if (!res.features.length) {
        if (opts.stats) opts.stats.fail++;
        return done(null, ['NO RESULTS', { query: cleanQuery, queryPoint: pt.join(',')}]);
    }

    let name = res.features[0].matching_place_name ? res.features[0].matching_place_name : res.features[0].place_name;
    let matched = tokenize(diacritics(name), opts.tokens);

    let dist = false;
    if (res.features[0].geometry.type === 'Point') {
        dist = turf.distance(res.features[0].geometry.coordinates, pt, 'kilometers');
    }

    matchedCount = [];
    for (let token in cleanQuery) {
        if (matched.indexOf(token)) matchedCount++;
    }

    if (opts.stats.itp && res.features[0].geometry.interpolated)
        opts.stats.itp.total += 1;

    if (matchedCount / matched.length < 0.70) {
        if (opts.stats) opts.stats.fail++;
        return done(null, ['TEXT', { query: cleanQuery.join(' '), queryPoint: pt.join(','), addressText: matched.join(' ') }]);
    } else if (dist && dist > 1 && !res.features[0].geometry.interpolated) {
        if (opts.stats) opts.stats.fail++;
        if (opts.stats.dists) {
            if (!opts.stats.dists['DIST']) opts.stats.dists['DIST'] = [];
            opts.stats.dists['DIST'].push(dist);
        }
        return done(null, ['DIST', { distance: dist.toFixed(2), returnedPoint: res.features[0].geometry.coordinates.join(','), query: query, queryPoint: pt.join(',') }]);
    } else if (dist && dist > 1 && res.features[0].geometry.interpolated) {
        if (opts.stats)
            opts.stats.fail++;
        if (opts.stats.itp)
            opts.stats.itp.fail += 1;
        if (opts.stats.dists) {
            if (!opts.stats.dists['DIST (ITP)']) opts.stats.dists['DIST (ITP)'] = [];
            opts.stats.dists['DIST (ITP)'].push(dist);
        }
        return done(null, ['DIST (ITP)', { distance: dist.toFixed(2), returnedPoint: res.features[0].geometry.coordinates.join(','), query: query, queryPoint: pt.join(',') }]);
    } else if (dist === false) {
        if (opts.stats) opts.stats.fail++;
        return done(null, ['DIST (STREET)', { distance: 'false', queryPoint: pt.join(','), query: query, addressText: matched.join(' ') } ]);
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

    let opts = {
        autocomplete: false
    };
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

/**
 * Report summary statistics for collected DIST failures
 * @param {Object} stats a stat-holding object that possesses a dist member
 */
function distReport(stats) {
    if (!stats.dists) {
        throw new Error('no stats.dists object found, cannot run distReport');
    }
    Object.keys(stats.dists).forEach((d) => {
        let skew;
        (stats.dists[d].length >= 3) ? skew = sstat.sampleSkewness(stats.dists[d]).toFixed(2) : skew = null;
        let mean = sstat.mean(stats.dists[d]).toFixed(2);
        let median = sstat.median(stats.dists[d]).toFixed(2);
        let stddev = sstat.standardDeviation(stats.dists[d]).toFixed(2);
        console.error(`${d} - mean: ${mean} / median: ${median} / skew: ${skew} / standard dev: ${stddev}`);
    });
}

module.exports = localCarmen;
module.exports.isPass = isPass;
module.exports.distReport = distReport;

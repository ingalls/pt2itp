#!/usr/bin/env node

const path = require('path');
const Carmen = require('@mapbox/carmen');
const MBTiles = require('@mapbox/mbtiles');
const tokens = require('@mapbox/geocoder-abbreviations');

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

    // Only override getInfo if provided
    if (param.getInfo) {
        if (param.getInfo.metadata) {
            param.getInfo = param.getInfo.metadata;
        }

        delete param.getInfo.tiles;
        delete param.getInfo.geocdoer_data;
        delete param.getInfo.geocoder_format;

        opts.address.getInfo = (cb) => {
            return cb(null, param.getInfo);
        };
    }

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

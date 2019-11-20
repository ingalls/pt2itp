'use strict';

const { dedupe_syn } = require('../../native/index.node');

/**
 * Exposes a post function to transform the intersections data to an array of strings
 * @param {Object} feat     GeoJSON Feature to generate properties for
 * @param {Array} opts      Post options
 * @return {Object}         Output GeoJSON feature to write to output
 */
function post(feat) {
    if (!feat) return feat;

    if (!Array.isArray(feat.properties['carmen:intersections'])) return feat;

    for (let i = 0; i < feat.properties['carmen:intersections'].length; i++) {
        if (!Array.isArray(feat.properties['carmen:intersections'][i])) continue;

        // Call dedupe_syn which reformats the street information into strings
        for (let j = 0; j < feat.properties['carmen:intersections'][i].length; j++) {
            feat.properties['carmen:intersections'][i][j] = dedupe_syn(feat.properties['carmen:intersections'][i][j]);
        }
    }

    return feat;
}

module.exports.post = post;

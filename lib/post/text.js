'use strict';

const { dedupe_syn } = require('../../native/index.node');

/**
 * Exposes a post function to dedupe synonyms on features
 * And also ensure that synonyms do not exceed the 10 Synonym limit
 * @param {Object} feat     GeoJSON Feature to dedupe
 * @return {Object}         Output GeoJSON feature to write to output
 */
function post(feat, opts = {}) {
    if (!feat || !feat.properties || !feat.properties['carmen:text']) return feat;

    Object.keys(feat.properties)
        .filter((k) => { return k.indexOf('carmen:text') === 0; })
        .forEach((k) => {
            let names = dedupe_syn(feat.properties[k]);

            if (k === 'carmen:text' && names.length === 0) return;

            if (names.length > 10) {
                if (opts.warn) {
                    opts.warn.write(`WARN: too many synonyms - truncating!: ${feat.properties[k]}\n`);
                }

                names = names.splice(0, 10);
            }
            feat.properties[k] = names.join(',');
        });

    return feat;
}

module.exports.post = post;

'use strict';

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
            feat.properties[k] = opts.label(feat.properties[k]);

            if (feat.properties[k].split(',').length > 10) {
                if (opts.warn) {
                    opts.warn.write(`WARN: too many synonyms - truncating!: ${feat.properties[k]}\n`);
                }

                feat.properties[k] = feat.properties[k].split(',').splice(0, 10).join(',');
            }
        });

    if (feat.properties['carmen:text'].split(',').length === 0) return;

    return feat;
}

module.exports.post = post;

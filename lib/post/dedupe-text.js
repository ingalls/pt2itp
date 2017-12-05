const tokenize = require('../tokenize');
const tokens = require('@mapbox/geocoder-abbreviations');

/**
 * Exposes a post function to dedupe synonyms on features
 * And also ensure that synonyms do not exceed the 10 Synonym limit
 * @param {Object} feat     GeoJSON Feature to dedupe
 * @return {Object}         Output GeoJSON feature to write to output
 */
function post(feat, opts) {
    if (!feat || !feat.properties) return feat;
    opts = opts || {};
    opts.tokens = opts.tokens || ['en'];
    if (!Array.isArray(opts.tokens)) opts.tokens = [opts.tokens];
    let replacer = tokenize.createReplacer(opts.tokens);

    /**
    * convenience function for tokenize.main
    **/
    function localTokenize(t) {
        return tokenize.main(t, replacer).join(' ');
    }

    Object.keys(feat.properties)
        .filter((k) => { return k.indexOf('carmen:text') === 0; })
        .forEach((k) => {
            // record the longest form of each token-equivalent synonym
            let longestForms = {};
            feat.properties[k].split(',').forEach((synonym) => {
                let tokenizedSynonym = localTokenize(synonym, opts.tokens);
                if (!longestForms[tokenizedSynonym])
                    longestForms[tokenizedSynonym] = synonym;
                else
                    longestForms[tokenizedSynonym] = (synonym.length > longestForms[tokenizedSynonym].length) ? synonym : longestForms[tokenizedSynonym];
            });

            let observedText = {};
            feat.properties[k] = feat.properties[k].split(',').reduce((prev, cur) => {
                let tokenizedCur = localTokenize(cur, opts.tokens);
                if (!observedText[tokenizedCur]) {
                    observedText[tokenizedCur] = true;
                    prev.push(longestForms[tokenizedCur]);
                }
                return prev;
            }, [])

            if (feat.properties[k].length > 10) {
                console.error(`ok - WARN too many synonyms - truncating!: {}`, feat.properties[k].join(','));
                feat.properties[k] = feat.properties[k].splice(0, 10);
            }

            feat.properties[k] = feat.properties[k].join(',');
        });

    return feat;
}

module.exports.post = post;

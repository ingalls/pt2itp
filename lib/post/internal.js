/**
 * Remove all inst. of internal: props
 * @param {Object} feat     GeoJSON Feature to modify
 * @return {Object}         Output GeoJSON feature to write to output
 */
function post(feat, opts = {}) {
    if (!feat || !feat.properties) return feat;

    Object.keys(feat.properties)
        .filter((k) => { return k.indexOf('internal:') === 0; })
        .forEach((k) => {
            delete feat.properties[k]
        });

    return feat;
}

module.exports.post = post;

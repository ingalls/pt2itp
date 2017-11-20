/**
 * Exposes a post function to add a numeric id value
 * @param {Object} feat     GeoJSON Feature to add an id to
 * @return {Object}         Output GeoJSON feature to write to output
 */
function post(feat) {
    if (!feat) return feat;

    feat.id = Math.floor((Math.random() * 2147483647) + 1);

    return feat;
}

module.exports.post = post;

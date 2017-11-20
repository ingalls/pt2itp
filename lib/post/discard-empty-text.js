/**
 * Exposes a post function to filter out features with empty text
 * @param {Object} feat     GeoJSON Feature for examination
 * @return {Object}         Output GeoJSON feature to write to output or false to drop feature
 */
function post(feat) {
    if (!feat ||
        !feat.properties ||
        !feat.properties['carmen:text'] ||
        (typeof feat.properties['carmen:text'] !== 'string') ||
        (feat.properties['carmen:text'].trim().length === 0))
        return false;
    return feat;
}

module.exports.post = post;

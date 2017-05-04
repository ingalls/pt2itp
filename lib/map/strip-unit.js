module.exports.map = map;

/**
 * Exposes a map function to convert/filter address numbers to integers
 * And remove generally invalid coords
 *
 * @param {Object} feat     GeoJSON feature to convert/filter
 * @return {Object|false}   Converted GeoJSON feature or false if it cannot be converted.
 */

function map(feat) {
    //Skip points & Polygons
    if (feat.geometry.type !== 'Point') return false;
    if (!feat.properties || !feat.properties.number) return false;
    if (!feat.properties || !feat.properties.street) return false;

    if (!feat.geometry.coordinates instanceof Array || feat.geometry.coordinates.length !== 2) {
        return false;
    }
    if (isNaN(feat.geometry.coordinates[0]) || feat.geometry.coordinates[0] < -180 || feat.geometry.coordiantes[0] > 180) {
        return false;
    }
    if (isNaN(feat.geometry.coordinates[1]) || feat.geometry.coordinates[1] < -90 || feat.geometry.coordinates[1] > 90) {
        return false;
    }

    if (typeof feat.properties.number !== 'string') feat.properties.number = String(feat.properties.number);

    if ((/^\d+[a-z]?$/.test(feat.properties.number) || /^(\d+)-(\d+)[a-z]?$/.test(feat.properties.number) || /^(\d+)([nsew])(\d+)[a-z]?$/.test(feat.properties.number))) {
        return feat;
    }

    return false;
}

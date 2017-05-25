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
    if (feat.geometry.type !== 'Point') return new Error('Feat must be a Point geom');
    if (!feat.properties) return new Error('Feat must have properties object');
    if (!feat.properties.number) return new Error('Feat must have number property');
    if (!feat.properties.street) return new Error('Feat must have street property');
    if (!feat.properties.street.trim().length) return new Error('Feat must have non-empty street property');

    if (!feat.geometry.coordinates instanceof Array || feat.geometry.coordinates.length !== 2) return new Error('Feat must have 2 element coordinates array');

    if (isNaN(feat.geometry.coordinates[0]) || feat.geometry.coordinates[0] < -180 || feat.geometry.coordinates[0] > 180) return new Error('Feat exceeds +/-180deg coord bounds');
    if (isNaN(feat.geometry.coordinates[1]) || feat.geometry.coordinates[1] < -85  || feat.geometry.coordinates[1] > 85) return new Error('Feat exceeds +/-85deg coord bounds');

    if (typeof feat.properties.number !== 'string') feat.properties.number = String(feat.properties.number);
    feat.properties.number = feat.properties.number.toLowerCase();

    if (!/^\d+[a-z]?$/.test(feat.properties.number) && !/^(\d+)-(\d+)[a-z]?$/.test(feat.properties.number) && !/^(\d+)([nsew])(\d+)[a-z]?$/.test(feat.properties.number)) return new Error('Feat is not a supported address/unit type');

    if (feat.properties.number.length > 10) return new Error('Number should not exceed 10 chars');

    return feat;
}

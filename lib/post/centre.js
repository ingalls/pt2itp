const turf = require('@turf/turf');
const cover = require('@mapbox/tile-cover');
const tilebelt = require('@mapbox/tilebelt');

/**
 * Exposes a post function to add a calculated centroid value
 * @param {Object} feat     GeoJSON Feature to add centroid to
 * @return {Object}         Output GeoJSON feature to write to output
 */
function post(feat) {
    if (!feat) return feat;

    //Address Cluster Centroid first fallback to network
    let centre = turf.pointOnSurface(feat.geometry.geometries[feat.geometry.geometries[1] ? 1 : 0]);

    let tiles = [];
    for (let geom of feat.geometry.geometries) {
        tiles = tiles.concat(cover.tiles(geom, { min_zoom: 14, max_zoom: 14 }));
    }

   if (!centre || !verifyCentre(centre.geometry.coordinates, tiles)) {
        let bbox = tilebelt.tileToBBOX(tiles[0]);
        centre = [ (bbox[2] + bbox[0]) / 2, (bbox[3] + bbox[1]) / 2 ];
    } else {
        centre = centre.geometry.coordinates;
    }

    feat.properties['carmen:center'] = centre;

    return feat;
}

/**
 * Ensure the calculated centre falls within the given coverage tiles
 * @param {Array} center center coordinates
 * @param {Array} tiles Array of mercator tiles to ensure the centroid is within
 */
function verifyCentre(center, tiles) {
    let found = false;
    let i = 0;
    while (!found && i < tiles.length) {
        let bbox = tilebelt.tileToBBOX(tiles[i]);
        if (center[0] >= bbox[0] && center[0] <= bbox[2] && center[1] >= bbox[1] && center[1] <= bbox[3]) {
            found = true;
        }
        i++;
    }
    return found;
}

module.exports.post = post;
module.exports.verifyCentre = verifyCentre;

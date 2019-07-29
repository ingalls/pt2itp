'use strict';

/**
 * Exposes a post function to add a numeric id value
 * @param {Object} feat     GeoJSON Feature to generate properties for
 * @param {Array} opts      Post options
 * @return {Object}         Output GeoJSON feature to write to output
 */
function post(feat, opts) {
    if (!feat) return feat;

    const output_intersections = opts.args.intersections ? opts.args.intersections : false;

    if (!output_intersections || !feat.properties['carmen:intersections']) {
        delete feat.properties['carmen:intersections'];
        return feat;
    }

    const intersections = feat.properties['carmen:intersections'].map((intersection) => {
        if (feat.properties['internal:nid'] === intersection.a_id) {
            return {
                street: intersection.b_street,
                geom: intersection.geom
            };
        } else if (feat.properties['internal:nid'] === intersection.b_id) {
            return {
                street: intersection.a_street,
                geom: intersection.geom
            };
        }
    });

    if (!intersections.length) {
        delete feat.properties['carmen:intersections'];
        return feat;
    }

    feat.geometry.geometries.push({
        type: 'MultiPoint',
        coordinates: []
    });


    const final = [];

    for (const intersection of intersections) {
        if (!intersection || !intersection.street) continue;
        const streets = intersection.street.map((name) => name.display);
        for (const st of streets) {
            if (final.indexOf(st) === -1) {
                final.push(st);
                feat.geometry.geometries[feat.geometry.geometries.length - 1].coordinates.push(intersection.geom.coordinates);
            }
        }
    }

    if (!final.length) {
        delete feat.properties['carmen:intersections'];
    } else {
        feat.properties['carmen:intersections'] = [];

        for (let i = 0; i < feat.geometry.geometries.length - 1; i++) {
            feat.properties['carmen:intersections'].push(null);
        }

        feat.properties['carmen:intersections'].push(final);

        if (feat.properties['carmen:addressnumber']) {
            feat.properties['carmen:addressnumber'].push(null);
        }

        ['carmen:parityl', 'carmen:lfromhn', 'carmen:ltohn', 'carmen:parityr', 'carmen:rfromhn', 'carmen:rtohn'].forEach((prop) => {
            if (feat.properties[prop]) {
                feat.properties[prop].push(null);
            }
        });
    }

    return feat;
}

module.exports.post = post;

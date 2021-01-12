'use strict';

/**
 * Exposes a post function to add a numeric id value
 * @param {Object} feat     GeoJSON Feature to generate properties for
 * @param {Array} opts      Post options
 * @return {Object}         Output GeoJSON feature to write to output
 */
function post(feat, opts) {
    if (!feat) return feat;

    const desired_props = opts.args.props ? opts.args.props : [];

    if (desired_props.length === 0 || !feat.properties.address_props) {
        delete feat.properties.address_props;
        return feat;
    }

    for (const desired_prop of desired_props) {
        const max = {
            occurance: null,
            count: 0
        };
        const occurances = {};
        const current_vals = [];

        // Generate Flat array of properties & Occurrence Count
        for (const prop of feat.properties.address_props) {
            occurances[prop[desired_prop]] = occurances[prop[desired_prop]] ? occurances[prop[desired_prop]] + 1 : 1;

            if (occurances[prop[desired_prop]] > max.count) {
                max.count = occurances[prop[desired_prop]];
                max.occurance = prop[desired_prop];
            }

            current_vals.push(prop[desired_prop]);
        }

        if (max.count === 0) continue;

        if (max.occurance !== undefined && max.occurance !== null) {
            feat.properties[desired_prop] = max.occurance;
        }

        for (let val_it = 0; val_it < current_vals.length; val_it++) {

            if (
                (max.occurance === null || max.occurance === undefined)
                && (current_vals[val_it] === null || current_vals[val_it] === undefined)
            ) {
                continue;
            } else if (current_vals[val_it] !== max.occurance) {
                if (!feat.properties['carmen:addressprops']) {
                    feat.properties['carmen:addressprops'] = {};
                }

                if (!feat.properties['carmen:addressprops'][desired_prop]) {
                    feat.properties['carmen:addressprops'][desired_prop] = {};
                }

                if (current_vals[val_it] === undefined) {
                    current_vals[val_it] = null;
                }

                feat.properties['carmen:addressprops'][desired_prop][val_it] = current_vals[val_it];
            }
        }
    }

    delete feat.properties.address_props;

    return feat;
}

module.exports.post = post;

'use strict';

const { dedupe_syn } = require('../../native/index.node');
const turf = require('@turf/turf');

module.exports = {
    addressPointsFeature,
    intersectionFeature,
    mergeFeatures
};

/**
 * Generate MultiPoint GeoJSON feature for intersections
 *
 * @param {AttachedPoints} intersectionPoints
 * @param {Number} feature_id
 * @return {Object} GeoJSON MultiPoint feature
 */
function intersectionFeature(intersectionPoints, feature_id) {
    const coordinates = [];
    const properties = {
        'carmen:intersections': []
    };

    // Duplicates are very common, so we need to track what we've added.
    const added = new Set();

    for (let i = 0; i < intersectionPoints.length; i++) {
        let key = '';
        if  (intersectionPoints[i].props.a_id === feature_id)  {
            key = 'b_street';
        } else if (intersectionPoints[i].props.b_id === feature_id) {
            key = 'a_street';
        } else {
            continue;
        }
        for (const street of dedupe_syn(intersectionPoints[i].props[key])) {
            // TODO is this too rigorous? Existing code only checks street
            const k = `${street}:${intersectionPoints[i].coords.join(',')}`;
            if (!added.has(k)) {
                added.add(k);
                properties['carmen:intersections'].push(street);
                coordinates.push(intersectionPoints[i].coords);
            }
        }
    }

    return turf.multiPoint(coordinates, properties);
}

/**
 * Generate MultiPoint GeoJSON feature for addressPoints
 *
 * @param {AttachedPoints} addressPoints
 * @return {Object} GeoJSON MultiPoint feature
 */
function addressPointsFeature(addressPoints) {
    const coordinates = [];
    const properties = {
        'carmen:addressnumber': [],
        address_props: []
    };
    for (let i = 0; i < addressPoints.length; i++) {
        if (addressPoints[i].props.output === false) continue;
        coordinates.push(addressPoints[i].coords);
        properties['carmen:addressnumber'].push(addressPoints[i].props.number);
        properties.address_props.push(addressPoints[i].props.props);
    }

    return turf.multiPoint(coordinates, properties);
}

/**
 * Merge address point, interpolation range and intersection feature into a single
 * GeometryCollection
 *
 * @param {Object} itps GeoJSON MultiLineString
 * @param {Object|undefined} pts GeoJSON MultiPoint
 * @param {Object|undefined} intersections GeoJSON MultiPoint, Intersections can be disabled and will undefined here.
 * @return {Object} GeoJSON GeometryCollection
 */
function mergeFeatures(itps, pts, intersections) {

    const feature = {
        type: 'Feature',
        properties: {
            'carmen:text': itps.properties['carmen:text'],
            'carmen:rangetype': 'tiger'
        },
        geometry: {
            type: 'GeometryCollection',
            geometries: []
        }
    };

    const props = [
        'carmen:parityl',
        'carmen:lfromhn',
        'carmen:ltohn',
        'carmen:parityr',
        'carmen:rfromhn',
        'carmen:rtohn',
        'carmen:addressnumber'
    ];
    if (intersections !== undefined && intersections.properties['carmen:intersections'].length > 0 )
        props.push('carmen:intersections');

    for (const k of props) feature.properties[k] = [];

    for (const f of [itps, pts, intersections]) {
        if (f === undefined) continue;
        feature.geometry.geometries.push(f.geometry);
        for (const k of props) {
            feature.properties[k].push(f.properties[k] === undefined ? null : f.properties[k]);
        }
    }

    // Final feature will have this transformed by `lib/post/props.js`
    if (pts && pts.properties.address_props) feature.properties.address_props = pts.properties.address_props;

    if (itps && itps.debug) feature.debug = itps.debug;

    return feature;
}

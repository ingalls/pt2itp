'use strict';

const intersection = require('turf-line-slice-at-intersection');
const turf = require('@turf/turf');
const _ = require('lodash');

/**
 * @class Explode
 */

class Explode {

    /**
     * Instantiate a new Explode class
     *
     * @param {Object} settings Arguments object
     * @param {numeric} settings.degTolerance is the max angle between segments that can be matched. Default 45deg.
     * @param {boolean} settings.noIntersect disables self intersection checking
     */
    constructor(settings = {}) {
        this.settings = settings;

        if (!this.settings.degTolerance) this.settings.degTolerance = 45;
        if (!this.settings.noIntersect) this.settings.noIntersect = false;
    }

    /**
     * Accepts a feature collection of MultiLineStrings - one for each identically named street.
     * It then lines them up in the array so the start and end of each segment are adjacent
     * and where there is no end=>beginning match it splits it into a separate MultiLineString
     *
     * @param {Object} streets GeoJSON FeatureCollection of network segments to explode
     * @return {Object} GeoJSON FeatureCollection with exploded network segments
     */
    join(streets) {
        if (streets.type !== 'FeatureCollection') throw new Error('Must be FeatureCollection or MultiLineString Feature');

        const results = {
            type: 'FeatureCollection',
            features: []
        };

        streets.features.sort(this.sortStreets);

        // Iterate through each MultiLineString - each should be a uniquely named street
        for (let feat_it = 0; feat_it < streets.features.length; feat_it++) {
            if (streets.features[feat_it].geometry.type !== 'MultiLineString') {
                results.features.push(streets.features[feat_it]);
            } else if (streets.features[feat_it].geometry.coordinates.length === 1) {
                results.features.push(turf.lineString(streets.features[feat_it].geometry.coordinates[0], streets.features[feat_it].properties));
            } else {
                // Get the first LineString segment of the multi and set it as the working copy
                let working = streets.features[feat_it].geometry.coordinates.splice(0,1)[0];

                // Iterate through all of the remaining features to find adjacent LineStrings
                for (let line_it = 0; line_it < streets.features[feat_it].geometry.coordinates.length; line_it++) {
                    // Coords for current tmp LineString being inspected
                    const coords = streets.features[feat_it].geometry.coordinates[line_it];

                    // Working start / Working end bearing
                    const wsBearing = turf.bearing(turf.point(working[0]), turf.point(working[1]));
                    const weBearing = turf.bearing(turf.point(working[working.length - 2]), turf.point(working[working.length - 1]));

                    // Coords start / Coords end bearing
                    const csBearing = turf.bearing(turf.point(coords[0]), turf.point(coords[1]));
                    // Bearing of last segment of coords line
                    const ceBearing = turf.bearing(turf.point(coords[coords.length - 2]), turf.point(coords[coords.length - 1]));

                    const intersects = this.hasIntersect(working, coords);

                    if (this.settings.noIntersect || !intersects) {

                        // <-c- . -w-> && <-w- . -c->
                        if (_.isEqual(working[0],coords[0]) && (wsBearing > 0 ? this.btn(csBearing + 180, wsBearing, this.settings.degTolerance) : this.btn(csBearing - 180, wsBearing, this.settings.degTolerance))) {
                            working = streets.features[feat_it].geometry.coordinates.splice(line_it, 1)[0].reverse().concat(working);
                            line_it = -1;

                        // -c-> . -w-> && <-w- . <-c-
                        } else if (_.isEqual(working[0],coords[coords.length - 1]) && this.btn(ceBearing, wsBearing, this.settings.degTolerance)) {
                            working = streets.features[feat_it].geometry.coordinates.splice(line_it, 1)[0].concat(working);
                            line_it = -1;

                        // -w-> . -c-> && <-c- . <-w-
                        } else if (_.isEqual(working[working.length - 1],coords[0]) && this.btn(csBearing, weBearing, this.settings.degTolerance)) {
                            working = working.concat(streets.features[feat_it].geometry.coordinates.splice(line_it, 1)[0]);
                            line_it = -1;

                        // -w-> . <-c- && -c-> . <-w-
                        } else if (_.isEqual(working[working.length - 1],coords[coords.length - 1]) && (weBearing > 0 ? this.btn(ceBearing + 180, weBearing, this.settings.degTolerance) : this.btn(ceBearing - 180, weBearing, this.settings.degTolerance))) {
                            working = working.concat(streets.features[feat_it].geometry.coordinates.splice(line_it, 1)[0].reverse());
                            line_it = -1;
                        }
                    }

                    // line_it is the last segment in the MultiLineString
                    if (line_it === streets.features[feat_it].geometry.coordinates.length - 1) {
                        if (this.dedup(working).length < 2) continue;

                        results.features.push(turf.lineString(this.dedup(working), streets.features[feat_it].properties));

                        if (streets.features[feat_it].geometry.coordinates.length !== 0) {
                            working = streets.features[feat_it].geometry.coordinates.splice(0,1)[0];

                            if (streets.features[feat_it].geometry.coordinates.length === 0) {
                                const dedupedWorking = this.dedup(working);
                                if (dedupedWorking.length > 1)
                                    results.features.push(turf.lineString(this.dedup(working), streets.features[feat_it].properties));
                            } else {
                                line_it = -1;
                            }
                        }
                    }
                }
            }
        }


        return results;
    }

    /**
     * Split LineStrings into segments broken at each intersection
     * and then further split to a max length of 500m
     *
     * @param {Object} streets GeoJSON FeatureCollection of streets to split
     * @param {Array} intersections
     * @returns {Array} GeoJSON FeatureCollection
     */
    split(streets, intersections = []) {
        if (!streets) return streets;

        // Resultant Intersection Linestrings
        let intersection_result = {
            type: 'FeatureCollection',
            features: []
        };

        intersections = turf.combine(turf.featureCollection(intersections));

        if (intersections.features.length) {
            intersections = intersections.features[0];

            for (const str of streets.features) {
                intersection_result.features = intersection_result.features.concat(turf.lineSplit(str, intersections).features);
            }
        } else {
            intersection_result = streets;
        }

        // Resultant distance LineStrings
        const dist_result = {
            type: 'FeatureCollection',
            features: []
        };

        for (const feat of intersection_result.features) {
            const dist = turf.lineDistance(feat);

            for (let dist_it = 0; dist_it < dist; dist_it += 0.5) {
                // Omit features with basically 0 line distance
                const newLn = turf.lineSliceAlong(feat, dist_it, dist_it + 0.5);

                if (turf.lineDistance(newLn) >= 0.001) dist_result.features.push(newLn);
            }
        }

        return dist_result;
    }

    /**
     * Sort streets from longest to shortest, breaking ties using coordinates
     * @param {Object} a GeoJSON Feature
     * @param {Object} b GeoJSON Feature
     * @return {Number} sort order
     */
    sortStreets(a, b) {
        if (a.geometry.type !== 'MultiLineString') return -1;
        if (b.geometry.type !== 'MultiLineString') return 1;

        const aDist = turf.lineDistance(a);
        const bDist = turf.lineDistance(b);

        if (aDist > bDist) return -1;
        if (aDist < bDist) return 1;

        if (a.geometry.coordinates.length > b.geometry.coordinates.length) return -1;
        if (a.geometry.coordinates.length < b.geometry.coordinates.length) return 1;

        return 0;
    }

    /**
     * Does the working LineString intersect with the proposed coord segment addition
     * @param {Array} working Working collection of non-intersecting coords
     * @param {Array} coords Coordinate segment to test for intersect against working
     * @return {boolean}
     */
    hasIntersect(working, coords) {
        const intersects = intersection(turf.lineString(working), turf.lineString(coords));

        // Remove geometries that aren't actually intersections
        intersects.features = intersects.features.filter((a) => {

            // Small geometries can be invalidly split into a LineString with a single point
            if (a.geometry.coordinates.length === 1) return false;

            return true;
        });

        return intersects.features.length > 1 ? true : false;
    }

    /**
     * Dedupe all adjacent coordinates in an array
     * @param {Array} coords Array of coordinates
     * @return {Array} Deduped coordinate array
     */
    dedup(coords) {
        const processed = [];
        for (let i = 0; i < coords.length; i++) {
            if (! _.isEqual(coords[i], coords[i + 1])) {
                processed.push(coords[i]);
            }
        }
        return processed;
    }

    /**
     * Test if two coordinate angles are within a given tolerance value taking into account wrapping coordinates
     * @param {numeric} n Angle to test
     * @param {numeric} wDeg Degree to test against
     * @param {numeric} tol  Tolerance value
     * @return {boolean}
        */
    btn(n, wDeg, tol) {
        let a = wDeg - tol;
        let b = wDeg + tol;

        n = (360 + (n % 360)) % 360;
        a = (3600000 + a) % 360;
        b = (3600000 + b) % 360;

        if (a < b) return a <= n && n <= b;
        return a <= n || n <= b;
    }
}

module.exports = Explode;

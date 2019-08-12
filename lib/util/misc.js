'use strict';

const turf = require('@turf/turf');

/**
 * @class Misc
 */
class Misc {
    constructor() { }

    /**
     * Calculate the Determinant on a 2 dimensional plane
     * @param {Array} start Coordinates of start of segment
     * @param {Array} end Coordinates of end of segment
     * @param {Array} query Coordinates to calculate det against
     * @return {number}
     */
    det2D(start, end, query) {
        return (end[0] - start[0]) * (query[1] - start[1]) - (end[1] - start[1]) * (query[0] - start[0]);
    }

    /**
     * Return 1 or -1 if the number is above or below 0
     * @param {number} num number to test
     * @return {number}
     */
    sign(num) {
        return typeof num === 'number' ? num ? num < 0 ? -1 : 1 : num === num ? 0 : NaN : NaN;
    }

    /**
     * Round the given num to the next highest given power
     * @param {number} num Value to round
     * @param {number} pow Power to round up to
     * @return {number}
     */
    toHighest(num, pow = 1) {
        return Math.ceil(num / pow) * pow;
    }

    /**
     * Round the given num to the next lowest given power
     * @param {number} num Value to round
     * @param {number} pow Power to round down to
     * @return {number}
     */
    toLowest(num, pow = 1) {
        return Math.floor(num / pow) * pow;
    }

    /**
     * Find the closest value in an array to a given target
     * @param {Array} array Array of values to search against
     * @param {number} target Find the closest number in the array to the target
     * @return {number}
     */
    closest(array, target) {
        return array.sort((a, b) => Math.abs(target - a) - Math.abs(target - b))[0];
    }

    /**
     * Detect cases where there are duplicate addresses outside of the threshold (1km) within a single address cluster
     *
     * Note: Assumes ordered input!
     *
     * @param {Array} number
     * @param {Array} coords
     * @return {Boolean|Number}
     */
    static hasDupAddressWithin(number, coords) {
        for (let num_it = 0; num_it < number.length - 1; num_it++) {
            if (String(number[num_it + 1]) !== String(number[num_it])) continue; // No duplicate numbers

            if (turf.distance(turf.point(coords[num_it]), turf.point(coords[num_it + 1])) > 1) {
                return number[num_it];
            }
        }
        return false;
    }
}

module.exports = Misc;

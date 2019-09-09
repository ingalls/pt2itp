'use strict';

module.exports = interpolize;
module.exports.lsb = lsb;
module.exports.segment = segment;
module.exports.genFeat = genFeat;
module.exports.itpSort = itpSort;
module.exports.dropLow = dropLow;
module.exports.raiseHigh = raiseHigh;
module.exports.diff = diff;

const Misc = require('../util/misc');

const turf = require('@turf/turf');
const _ = require('lodash');
const misc = new Misc();

/**
 * Main Interpolize endpoint, take a given address/network cluster and add interpolated data to linestring and output carmen formateted indexable features
 * @param {Array} splits array of address/network clusters that share the same name and geometric proximity
 * @param {Object} argv Argument Object
 * @param {boolean} argv.debug Output debug information on features
 * @return {Object} GeoJSON Feature GeometryCollection of combined PT and calculated ITP
 */
function interpolize(splits, argv = {}) {
    // Storing these values allows us to push the lower and upper bounds of the calculated ITP.
    // For example if an ITP starts with 32 => assume it starts at 0 if it ends at 87 assume 101, etc
    let max = -1;
    let min = Infinity;

    let itps = [];

    for (const split of splits) {
        const intersections = split.intersections;

        if (!split.address || !split.number) {
            if (turf.lineDistance(split.network) < 0.001)
                continue;
            const feat = genFeat(split, null, argv);
            if (feat)
                itps.push(feat);
            continue;
        }

        if (split.address.geometry.coordinates.length !== split.number.length) throw new Error('address coordinates & number arrays must be parallel (length equal)');

        let dist = [];

        const streetdist = turf.lineDistance(split.network);

        // true if beginning of linestring is lowest number
        // false if beginning of linestring is highest number
        let sequence;
        const seqcalc = [false, false]; // tmp var used to calculate sequence [closest start, closest end]

        const distsFromLine = [];

        // generate coorelation between every address and its position on the line
        for (let address_it = 0; address_it < split.address.geometry.coordinates.length; address_it++) {
            const addr = turf.point([
                split.address.geometry.coordinates[address_it][0],
                split.address.geometry.coordinates[address_it][1]
            ]);

            // Generate closest point on line to addr
            const linept = turf.pointOnLine(split.network, addr);

            const res = {
                'distOnLine': turf.lineDistance(turf.lineSlice(turf.point(split.network.geometry.coordinates[0]), linept, split.network)),
                'distFromLine': turf.distance(addr, linept),
                'distFromOrigin': turf.distance(turf.point(split.network.geometry.coordinates[0]), addr),
                'distFromEnd': turf.distance(turf.point(split.network.geometry.coordinates[split.network.geometry.coordinates.length - 1]), addr),
                'geometry': addr,
                'number': parseInt(split.number[address_it].number),
                'output': split.number[address_it].output,
                'props': split.number[address_it].props,
                'side': null
            };

            distsFromLine.push(res.distFromLine);

            const seg = segment(split.network, res.distOnLine);
            res.side = misc.sign(misc.det2D(seg[0], seg[1], split.address.geometry.coordinates[address_it]));

            if (!seqcalc[0] || seqcalc[0].distFromOrigin > res.distFromOrigin) {
                seqcalc[0] = res;
            }
            if (!seqcalc[1] || seqcalc[1].distFromEnd > res.distFromEnd) {
                seqcalc[1] = res;
            }

            dist.push(res);
        }

        const distFromLineLimit = distsFromLine[Math.floor(distsFromLine.length / 2)] * 10; // Median * n

        const cleared = [];
        // Quarenting addresses that are above the threshold
        for (const res of dist) {
            if (res.distFromLine < distFromLineLimit) {
                if (parseInt(res.number) < min) min = parseInt(res.number);
                if (parseInt(res.number) > max) max = parseInt(res.number);

                cleared.push(res);
            }
        }

        dist = cleared;

        if (seqcalc[0].number > seqcalc[1].number) sequence = false;
        else sequence = true;

        const leftside = lsb(split.network.geometry.coordinates[0], split.network.geometry.coordinates[1]);

        const distStart = _.cloneDeep(dist.sort((a, b) => {
            if (a.distOnLine !== 0 && b.distOnLine !== 0) { // handle cases where both addresses are to the direct left/right of the line
                const dista = a.distOnLine + a.distFromOrigin;
                const distb = b.distOnLine + a.distFromOrigin;
                if (dista < distb) return -1;
                if (dista > distb) return 1;
                return 0;

            } else if (a.distOnLine === 0 && b.distOnLine !== 0) { // a is off the beginning of the line, b is l/r of the line
                return -1;
            } else if (b.distOnLine === 0 && a.distOnLine !== 0) { // b is off the beginning of the line, a is l/r of the line
                return 1;
            } else if (sequence && a.number < b.number) { // both a/b are off the end of the line
                return -1;
            } else if (!sequence && a.number > b.number) {
                return -1;
            } else {
                return 0;
            }
        }));

        const distEnd = _.cloneDeep(dist.sort((a, b) => {
            if ((streetdist - a.distOnLine) !== 0 && (streetdist - b.distOnLine) !== 0) { // handle cases where both addresses are to the direct left/right of the line
                const dista = (streetdist - a.distOnLine) + a.distFromEnd;
                const distb = (streetdist - b.distOnLine) + a.distFromEnd;
                if (dista < distb) return -1;
                if (dista > distb) return 1;
                return 0;
            } else if ((streetdist - a.distOnLine) === 0 && (streetdist - b.distOnLine) !== 0) { // a is off the beginning of the line, b is l/r of the line
                return -1;
            } else if ((streetdist - b.distOnLine) === 0 && (streetdist - a.distOnLine) !== 0) { // b is off the beginning of the line, a is l/r of the line
                return 1;
            } else if (sequence && a.number > b.number) { // both a/b are off the end of the line
                return -1;
            } else if (!sequence && a.number < b.number) {
                return -1;
            } else {
                return 0;
            }
        }));

        // calculate number of odd/even on each side
        const parity = {
            totall: 0,
            lo: 0,
            le: 0,
            totalr: 0,
            ro: 0,
            re: 0
        };

        dist.forEach((d) => {
            // don't count addr off the end of the line in parity as if the road bends (past the line geom)
            // the l/r calc could be incorrect
            if (d.distFromOrigin !== 0 && (streetdist - d.distFromEnd) !== 0) {
                if (d.side === leftside && d.number % 2 === 0) parity.le++;
                if (d.side === leftside && d.number % 2 === 1) parity.lo++;
                if (d.side !== leftside && d.number % 2 === 0) parity.re++;
                if (d.side !== leftside && d.number % 2 === 1) parity.ro++;
            }
        });

        parity.totall = parity.lo + parity.le;
        parity.totalr = parity.ro + parity.re;

        const rangeOptions = { distStart, distEnd, parity, leftside, streetdist, sequence };
        const genFeatOptions = { split, argv, intersections };

        const range = generateInterpolationRanges(rangeOptions);
        let feature = genFeat(split, range, argv, intersections);

        feature = argv.debug ? setDebug(range, feature) : feature;
        feature.rangeOptions = rangeOptions;
        feature.genFeatOptions = genFeatOptions;
        itps.push(feature);
    }

    // Sort ITP output to start with lowest number and end with highest/no ITP values
    itps.sort(itpSort);

    itps = checkInterpolationRanges(itps).sort(itpSort);

    // If max or min didn't change from inf values don't try to change actual min/max

    if (max === -1 && min === Infinity) return join(itps, argv);
    const d = diff(max, min);

    // Drop Lower Values on L/R side to include more potential addresses ie 22 => 0
    const leftIdx = firstNonNull(itps, 'carmen:lfromhn');
    if (leftIdx >= 0) {
        if (itps[leftIdx].properties['carmen:lfromhn'][0] < itps[leftIdx].properties['carmen:ltohn'][0]) {
            itps[leftIdx].properties['carmen:lfromhn'][0] = dropLow(itps[leftIdx].properties['carmen:lfromhn'][0], d);
        } else {
            itps[leftIdx].properties['carmen:ltohn'][0] = dropLow(itps[leftIdx].properties['carmen:ltohn'][0], d);
        }
    }

    const rightIdx = firstNonNull(itps, 'carmen:rfromhn');
    if (rightIdx >= 0) {
        if (itps[rightIdx].properties['carmen:rfromhn'][0] < itps[rightIdx].properties['carmen:rtohn'][0]) {
            itps[rightIdx].properties['carmen:rfromhn'][0] = dropLow(itps[rightIdx].properties['carmen:rfromhn'][0], d);
        } else {
            itps[rightIdx].properties['carmen:rtohn'][0] = dropLow(itps[rightIdx].properties['carmen:rtohn'][0], d);
        }
    }

    // Raise Upper Values on L/R side
    const leftEnd = lastNonNull(itps, 'carmen:lfromhn');
    if (leftEnd >= 0) {
        if (itps[leftEnd].properties['carmen:lfromhn'][0] > itps[leftEnd].properties['carmen:ltohn'][0]) {
            itps[leftEnd].properties['carmen:lfromhn'][0] = raiseHigh(itps[leftEnd].properties['carmen:lfromhn'][0], d);
        } else {
            itps[leftEnd].properties['carmen:ltohn'][0] = raiseHigh(itps[leftEnd].properties['carmen:ltohn'][0], d);
        }
    }

    const rightEnd = lastNonNull(itps, 'carmen:rfromhn');
    if (rightEnd >= 0) {
        if (itps[rightEnd].properties['carmen:rfromhn'][0] > itps[rightEnd].properties['carmen:rtohn'][0]) {
            itps[rightEnd].properties['carmen:rfromhn'][0] = raiseHigh(itps[rightEnd].properties['carmen:rfromhn'][0], d);
        } else {
            itps[rightEnd].properties['carmen:rtohn'][0] = raiseHigh(itps[rightEnd].properties['carmen:rtohn'][0], d);
        }
    }

    return join(itps, argv);
}

/**
 * Set debug properties
 * @param {object} result  features with ranges calculated
 * @param {object} resFeat generated carmen feature
 * @return {object}        generated feature with debug property assigned
 */
function setDebug(result, resFeat) {
    const debug = {
        type: 'featurecollection',
        features: []
    };

    ['lstart', 'lend', 'rstart', 'rend'].forEach((prop) => {
        if (result[prop]) debug.features.push(result[prop].geometry);
    });

    if (debug.features.length) resFeat.debug = debug;
    return resFeat;
}

/**
 * Combined multiple PT/ITP features into a single Feature
 * @param {Array} itps Each object in the array should be an ITP/PT combined Feature
 * @param {Object} argv Argument Object
 * @param {boolean} argv.debug Output debug information on features
 * @return {Object} GeoJSON Feature GeometryCollection of combined PT and calculated ITP
 */
function join(itps, argv) {
    if (!itps.length) return;

    const itp = {
        type: 'Feature',
        properties: {
            address_props: [],
            'carmen:intersections': [],
            'carmen:addressnumber': [null, []],
            'carmen:rangetype': 'tiger',
            'carmen:parityl': [[], null],
            'carmen:lfromhn': [[], null],
            'carmen:ltohn': [[], null],
            'carmen:parityr': [[], null],
            'carmen:rfromhn': [[], null],
            'carmen:rtohn': [[], null]
        },
        geometry: {
            type: 'GeometryCollection',
            geometries: [{
                type: 'MultiLineString',
                coordinates: []
            }, {
                type: 'MultiPoint',
                coordinates: []
            }]
        }
    };

    if (argv.debug) itp.debug = [];

    for (const res of itps) {
        itp.geometry.geometries[0].coordinates.push(res.geometry.geometries[0].coordinates);

        if (argv.debug) itp.debug.push(res.debug);

        if (res.properties['carmen:rangetype']) {
            ['carmen:parityl', 'carmen:lfromhn', 'carmen:ltohn', 'carmen:parityr', 'carmen:rfromhn', 'carmen:rtohn'].forEach((prop) => {
                itp.properties[prop][0].push(res.properties[prop][0]);
            });
        } else {
            ['carmen:parityl', 'carmen:lfromhn', 'carmen:ltohn', 'carmen:parityr', 'carmen:rfromhn', 'carmen:rtohn'].forEach((prop) => {
                itp.properties[prop][0].push(null);
            });
        }

        if (res.properties['carmen:intersections']) {
            itp.properties['carmen:intersections'] = itp.properties['carmen:intersections'].concat(res.properties['carmen:intersections']);
        }

        if (res.properties['carmen:addressnumber']) {
            itp.properties.address_props = itp.properties.address_props.concat(res.properties.address_props);

            itp.properties['carmen:addressnumber'][1] = itp.properties['carmen:addressnumber'][1].concat(res.properties['carmen:addressnumber'][1]);
            itp.geometry.geometries[1].coordinates = itp.geometry.geometries[1].coordinates.concat(res.geometry.geometries[1].coordinates);
        }
    }

    // If the combined address feature doesn't contain an address cluster (the interpolated line didn't match any addresses), remove the empty address cluster properties and geometries

    if (itp.properties['carmen:addressnumber'][1].length === 0) {
        delete itp.properties['carmen:addressnumber'];
        ['carmen:parityl', 'carmen:lfromhn', 'carmen:ltohn', 'carmen:parityr', 'carmen:rfromhn', 'carmen:rtohn'].forEach((prop) => {
            itp.properties[prop].pop();
        });
        itp.geometry.geometries.pop();
    }

    return itp;
}

/**
 * Generate interpolation range properties lik the left/right start/end and parity,
 * used to build the interpolated range for each street segment.
 * @param  {object}  options            contains properties to generate interpolation ranges
 * @param  {array}   options.distStart  sorted features for the left andd right start
 * @param  {array}   options.distEnd    sorted features for the left andd right end
 * @param  {object}  options.parity     object with even/odd number information per left/right side
 * @param  {boolean} options.leftside   is the address in the left side
 * @param  {number}  options.streetdist size of the street segment
 * @param  {boolean} options.sequence   true if the address numbers increases along the segment
 * @return {object}                     contains interpolation properties
 */

function generateInterpolationRanges(options) {
    const result = {
        parityl: null,
        lstart: null,
        lend: null,
        parityr: null,
        rstart: null,
        rend: null
    };

    // calculate start l/r address
    for (let i = 0; i < options.distStart.length; i++) {
        if (options.distStart[i].distOnLine !== 0 && !result.lstart && options.distStart[i].side === options.leftside) {
            result.lstart = options.distStart[i];
        } else if (options.distStart[i].distOnLine !== 0 && !result.rstart && options.distStart[i].side !== options.leftside) {
            result.rstart = options.distStart[i];
        } else {
            if (!result.lstart) {
                if (options.parity.lo > options.parity.le && options.distStart[i].number % 2 === 1) {
                    result.lstart = options.distStart[i];
                } else if (options.parity.le > options.parity.lo && options.distStart[i].number % 2 === 0) {
                    result.lstart = options.distStart[i];
                }
            }
            if (!result.rstart) {
                if (options.parity.ro > options.parity.re && options.distStart[i].number % 2 === 1) {
                    result.rstart = options.distStart[i];
                } else if (options.parity.re > options.parity.ro && options.distStart[i].number % 2 === 0) {
                    result.rstart = options.distStart[i];
                }
            }
        }

        // if range needs to be recalculated
        if (options.exclude) {
            options.exclude.forEach((range) => {
                if (range && range[0] && range[1] && result[range[0]] && result[range[0]].number === range[1]) {
                    result[range[0]] = null;
                }
            });
        }
    }


    // calculate end l/r address
    for (let i = 0; i < options.distEnd.length; i++) {

        // if point falls on line (not off end of line) && no current left side && point is on left side
        if (options.distEnd[i].distOnLine - options.streetdist !== 0 && !result.lend && options.distEnd[i].side === options.leftside) {
            result.lend = options.distEnd[i];

            // if point falls on line (not off end of line) && no current right side && point is not on left side (right side)
        } else if (options.distEnd[i].distOnLine - options.streetdist !== 0 && !result.rend && options.distEnd[i].side !== options.leftside) {
            result.rend = options.distEnd[i];

            // if there still isn't a match fall back to finding the closest match with the correct parity
        } else {
            if (!result.lend) {
                if (options.parity.lo > options.parity.le && options.distEnd[i].number % 2 === 1) {
                    result.lend = options.distEnd[i];
                } else if (options.parity.le > options.parity.lo && options.distEnd[i].number % 2 === 0) {
                    result.lend = options.distEnd[i];
                }
            }
            if (!result.rend) {
                if (options.parity.ro > options.parity.re && options.distEnd[i].number % 2 === 1) {
                    result.rend = options.distEnd[i];
                } else if (options.parity.re > options.parity.ro && options.distEnd[i].number % 2 === 0) {
                    result.rend = options.distEnd[i];
                }
            }
        }
        // if range needs to be recalculated
        if (options.exclude) {
            options.exclude.forEach((range) => {
                if (range && range[0] && range[1] && result[range[0]] && result[range[0]].number === range[1]) result[range[0]] = null;
            });
        }
    }

    if (!result.rstart && result.rend) result.rstart = result.rend;
    if (!result.rend && result.rstart) result.rend = result.rstart;
    if (!result.lstart && result.lend) result.lstart = result.lend;
    if (!result.lend && result.lstart) result.lend = result.lstart;

    // assign debug properties
    if (result.rstart) {
        result.rstart.geometry.properties.start = true;
        result.rstart.geometry.properties.right = true;
    }
    if (result.lstart) {
        result.lstart.geometry.properties.start = true;
        result.lstart.geometry.properties.left = true;
    }
    if (result.rend) {
        result.rend.geometry.properties.end = true;
        result.rend.geometry.properties.right = true;
    }
    if (result.lend) {
        result.lend.geometry.properties.end = true;
        result.lend.geometry.properties.left = true;
    }

    // sometimes the calculated start/end point isn't the same as the calculated parity
    // in these cases +1 the number to match parity
    if (result.rstart && result.rend) {
        if (options.parity.ro / options.parity.totalr > 0.70) result.rparity = 'O';
        if (options.parity.re / options.parity.totalr > 0.70) result.rparity = 'E';

        // at lease some parity is needed to make this work
        if (!result.rparity) {
            if (result.rstart.number % 2 === 0 && result.rend.number % 2 === 0) {
                result.rparity = 'E';
            } else if (result.rstart.number % 2 === 1 && result.rend.number % 2 === 1) {
                result.rparity = 'O';
            } else { // this is completely arbitrary - in the us odd are usually left/even right
                result.rparity = 'E';
            }
        }

        if (result.rparity === 'E') {
            if (result.rstart.number % 2 !== 0) {
                result.rstart.number++;
            }
            if (result.rend.number % 2 !== 0) {
                result.rend.number++;
            }
        } else {
            if (result.rstart.number % 2 !== 1) result.rstart.number++;
            if (result.rend.number % 2 !== 1) result.rend.number++;
        }
    }

    // sometimes the calculated start/end point isn't the same as the calculated parity
    // in these cases +1 the number to match parity
    if (result.lstart && result.lend) {
        if (options.parity.lo / options.parity.totall > 0.70) result.lparity = 'O';
        if (options.parity.le / options.parity.totall > 0.70) result.lparity = 'E';

        if (!result.lparity) {
            if (result.lstart && result.lend && result.lstart.number % 2 === 0 && result.lend.number % 2 === 0) {
                result.lparity = 'E';
            } else if (result.rstart && result.rend && result.rstart.number % 2 === 1 && result.rend.number % 2 === 1) {
                result.lparity = 'O';
            } else {
                result.lparity = 'O';
            }
        }

        if (result.lparity === 'E') {
            if (result.lstart && result.lstart.number % 2 !== 0) result.lstart.number++;
            if (result.lend && result.lend.number % 2 !== 0) result.lend.number++;
        } else {
            if (result.lstart && result.lstart.number % 2 !== 1) result.lstart.number++;
            if (result.lend && result.lend.number % 2 !== 1) result.lend.number++;
        }
    }

    return result;
}

/**
 * Check if there is overlapping between the interpolation ranges.
 * If so, regenerate the overlapping interpolation range.
 * @param  {array} itps sorted array of interpolated features.
 * @return {array}      array of interpolated features with updated interpolation ranges if ranges overlapping was found.
 */
function checkInterpolationRanges(itps) {
    if (!itps) return itps;
    return itps.map((itp, i) => {
        // do not change ends of the cluster
        if (!i || i === itps.length || !itp.properties || !itp.rangeOptions) return itp;
        const lfrom = itp.properties['carmen:lfromhn'] ? itp.properties['carmen:lfromhn'][0] : null;
        const lto = itp.properties['carmen:ltohn'] ? itp.properties['carmen:ltohn'][0] : null;
        const rfrom = itp.properties['carmen:rfromhn'] ? itp.properties['carmen:rfromhn'][0] : null;
        const rto = itp.properties['carmen:rtohn'] ? itp.properties['carmen:rtohn'][0] : null;
        const sequence = itp.rangeOptions.sequence;

        // make sure we only update ranges were there is a match
        // in sequence between the left and right sides
        if (!lfrom || !lto || !rfrom || !rto || lfrom === lto || rfrom === rto) return itp;
        if (sequence && lfrom < lto && rfrom < rto) return itp;
        if (!sequence && lfrom > lto && rfrom > rto) return itp;

        const status = {};

        ['carmen:lfromhn', 'carmen:ltohn', 'carmen:rfromhn', 'carmen:rtohn'].forEach((prop) => {
            status[`pre${prop.replace(/carmen:|hn/g,'')}`] = itps[i - 1] && itps[i - 1].properties && itps[i - 1].properties[prop] ? itps[i - 1].properties[prop][0] : null;
            status[`next${prop.replace(/carmen:|hn/g,'')}`] = itps[i + 1] && itps[i + 1].properties && itps[i + 1].properties[prop] ? itps[i + 1].properties[prop][0] : null;
        });

        const lfromInRange = isInRange(status.prelfrom, lfrom, status.nextlfrom);
        const ltoInRange = isInRange(status.prelto, lto, status.nextlto);
        const rfromInRange = isInRange(status.prerfrom, rfrom, status.nextrfrom);
        const rtoInRange = isInRange(status.prerto, rto, status.nextrto);

        itp.rangeOptions.exclude = [];

        if (!lfromInRange) itp.rangeOptions.exclude.push(['lstart', lfrom]);
        if (!ltoInRange) itp.rangeOptions.exclude.push(['lend', lto]);
        if (!rfromInRange) itp.rangeOptions.exclude.push(['rstart', rfrom]);
        if (!rtoInRange) itp.rangeOptions.exclude.push(['rend', rto]);

        const range = generateInterpolationRanges(itp.rangeOptions);
        const resFeat = genFeat(itp.genFeatOptions.split, range, itp.genFeatOptions.argv, itp.genFeatOptions.intersections);

        itp = itp.genFeatOptions.argv.debug ? setDebug(range, resFeat) : resFeat;

        delete itp.rangeOptions;
        delete itp.genFeatOptions;

        return itp;
    });
}


function isInRange(previous, current, next) {
    if (!previous || !next) return true;
    if ((previous < current && next > current) || (previous > current && next < current)) return true;
    else return false;
}

/**
 * Calculated difference between min and max housenumber to push the number to the closest 10^ ie 3-9 => 1->11
 * @param {numeric} max Max civic address
 * @param {numeric} min Min civic address
 * @return {numeric} calc'd diff
 */
function diff(max, min) {
    return Math.pow(10, Math.round(Math.log10(Math.abs(max - min)))); // Diff represented in 10^n
}

/**
 * Find the first non-null element of an property in an interpolation range
 * @param {Array} itps Each object in the array should be an ITP/PT combined Feature
 * @param {string} prop Interplation proprety to look for
 * @return {number} index of non-null element or -1
 */
function firstNonNull(itps, prop) {
    for (let i = 0; i < itps.length; i++) {
        if (itps[i].properties['carmen:rangetype'] && itps[i].properties[prop][0] !== null) {
            return i;
        }
    }
    return -1;
}

/**
 * Find the last non-null element of an property in an interpolation range
 * @param {Array} itps Each object in the array should be an ITP/PT combined Feature
 * @param {string} prop Interplation proprety to look for
 * @return {number} index of non-null element or -1
 */
function lastNonNull(itps, prop) {
    for (let i = itps.length - 1; i > -1; i--) {
        if (itps[i].properties['carmen:rangetype'] && itps[i].properties[prop][0] !== null) {
            return i;
        }
    }
    return -1;
}

/**
 * Calculate how far to lower the min housenumber based on the calculated diff ie 3 => 1 as in the diff example
 * @param {numeric} low The lowest housenumber
 * @param {numeric} d The output of the diff function
 * @return {numeric}
 */
function dropLow(low, d) {
    const isEven = low % 2 === 0;

    if (d === 1) d = d * 10;

    if (low - d < -1) return isEven ? 0 : 1;
    return low - (low % d) + (isEven ? 0 : 1);
}

/**
 * Calculate how far to raise the max housenumber based on the calculated diff ie 9 => 11 as in the diff example
 * @param {numeric} high The highest housenumber
 * @param {numeric} d The output of the diff function
 * @return {numeric}
 */
function raiseHigh(high, d) {
    const isEven = high % 2 === 0;

    if (high % 10 === 0) high++; // Avoid 10 w/ d 1 gunking up
    if (d === 1) d = d * 10;

    if (high < d) return d + (isEven ? 0 : 1);

    return Math.ceil(high / d) * d + (isEven ? 0 : 1);
}

/**
 * Sort the calculated ITP Features into a stable order
 * @param {Object} aFeat GeoJSON Feature
 * @param {Object} bFeat GeoJSON Feature
 * @return {boolean}
 */
function itpSort(aFeat, bFeat) {
    let a, b;
    if (itpSortable(aFeat, 'carmen:lfromhn')) {
        a = aFeat.properties['carmen:lfromhn'][0];
    } else if (itpSortable(aFeat, 'carmen:rfromhn')) {
        a = aFeat.properties['carmen:rfromhn'][0];
    } else {
        return 1;
    }

    if (itpSortable(bFeat,'carmen:lfromhn')) {
        b = bFeat.properties['carmen:lfromhn'][0];
    } else if (itpSortable(bFeat, 'carmen:rfromhn')) {
        b = bFeat.properties['carmen:rfromhn'][0];
    } else {
        return -1;
    }

    return a - b;
}

/**
 * Helper method returns true if first array element of specific property for a geojson feature is
 * not null
 * @param {Object} feat GeoJSON Feature
 * @param {string} prop name of array property
 * @return {boolean}
 */
function itpSortable(feat, prop) {
    return feat.properties[prop] && feat.properties[prop][0] !== undefined && feat.properties[prop][0] !== null;
}

/**
 * Generate a single carmen Feature - these are then placed in an array and combined by join
 * @param {Object} split PT/ITP Split object to combine into GeoJSON Feature
 * @param {Object} result Calculated ITP values
 * @param {Object} argv Argument Object
 * @param {boolean} argv.debug Output debug information on features
 * @param {Array} intersections array of intersections
 * @return {Object} GeoJSON Feature GeometryCollection of combined PT and calculated ITP
 */
function genFeat(split, result, argv, intersections) {
    const res = {
        type: 'Feature',
        properties: {
            'carmen:intersections': intersections
        },
        geometry: {
            type: 'GeometryCollection',
            geometries: [
                split.network.geometry
            ]
        }
    };

    // Network has no points assigned to it - cannot be ITP at this stage
    if (!result) return res;

    res.properties['carmen:rangetype'] = 'tiger';
    res.properties['carmen:parityl'] = [result.lparity ? result.lparity : null];
    res.properties['carmen:lfromhn'] = [result.lstart ? result.lstart.number : null];
    res.properties['carmen:ltohn'] = [result.lend ? result.lend.number : null];
    res.properties['carmen:parityr'] = [result.rparity ? result.rparity : null];
    res.properties['carmen:rfromhn'] = [result.rstart ? result.rstart.number : null];
    res.properties['carmen:rtohn'] = [result.rend ? result.rend.number : null];

    if (split.address && split.number && split.number.some((num) => { return num.output; })) {
        ['carmen:parityl', 'carmen:lfromhn', 'carmen:ltohn', 'carmen:parityr', 'carmen:rfromhn', 'carmen:rtohn'].forEach((prop) => {
            res.properties[prop].push(null);
        });

        res.properties['carmen:addressnumber'] = [null, []];
        res.geometry.geometries.push({
            type: 'MultiPoint',
            coordinates: []
        });

        res.properties.address_props = [];

        for (let num_it = 0; num_it < split.number.length; num_it++) {
            if (!split.number[num_it].output) continue;

            res.properties.address_props.push(split.number[num_it].props);
            res.properties['carmen:addressnumber'][1].push(split.number[num_it].number);
            res.geometry.geometries[1].coordinates.push([
                split.address.geometry.coordinates[num_it][0],
                split.address.geometry.coordinates[num_it][1]
            ]);
        }
    }

    return res;
}

/**
 * Given a line and a distance, find the coords of the matching segment
 * @param {Object} line GeoJSON feature
 * @param {numeric} dist Distance along line to find matching segment
 * @return {Array} Closest segment
 */
function segment(line, dist) {
    const coords = line.geometry.coordinates;

    let travelled = 0;
    for (let i = 0; i < coords.length; i++) {
        if (dist >= travelled && i === coords.length - 1) {
            break;
        } else if (travelled >= dist) {
            if (i === 0) return [coords[0], coords[1]];
            else return [coords[i - 1], coords[i]];
        } else {
            travelled += turf.distance(turf.point(coords[i]), turf.point(coords[i + 1]));
        }
    }
    // Last segment
    return [coords[coords.length - 2], coords[coords.length - 1]];
}

/**
 * Left Side binary - Returns 1 or 0 for which is the left side
 * @param {Array} start Start coordinate
 * @param {Array} end End coordinate
 * @return {numeric}
 */
function lsb(start, end) {
    return misc.sign(misc.det2D(
        start,
        end,
        turf.destination(
            turf.center(turf.lineString([start, end])),
            0.01,
            turf.bearing(turf.point(start), turf.point(end)) - 90,
            { units: 'miles' }).geometry.coordinates
    ));
}

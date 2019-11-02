'use strict';

module.exports = {
    interpolize
};
module.exports.checkInterpolationRanges = checkInterpolationRanges;
module.exports.calculateInterpolationParams = calculateInterpolationParams;
module.exports.generateInterpolationRange = generateInterpolationRange;
module.exports.isInRange = isInRange;
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
 *
 * @param {Object[]} splits array of address/network clusters that share the same name and geometric proximity
 * @param {Object} argv Argument Object
 * @param {boolean} argv.debug Output debug information on features
 * @return {Object} GeoJSON MultiLineString of calculated ITP
 */
function interpolize(splits, argv = {}) {
    // const prevDelta = splits.prevDelta;
    // const nextDelta = splits.nextDelta;
    const prevDelta = undefined;
    const nextDelta = undefined;
    if (!Array.isArray(splits) && Array.isArray(splits.segs)) {
        console.warn('Using deprecated interface');
        // throw new Error('Using deprecated interface to interpolize');
        splits = splits.segs;
    }

    // Storing these values allows us to push the lower and upper bounds of the calculated ITP.
    // For example if an ITP starts with 32 => assume it starts at 0 if it ends at 87 assume 101
    const limits = {
        max: 0, // Ignore 0 addresses, dependion on dropLow to fill them in if needed as they are often false postives. (This value was prevously -1)
        min: 1000000 // Ignore addresses above 1 million for inclusion in raiseHigh to avoid excessively large ranges
    };

    let itps = [];

    for (const split of splits) {
        if (!split.addressPoints || split.addressPoints.length === 0) continue;
        if (turf.lineDistance(split.network) < 0.001) continue;

        const rangeOptions = calculateInterpolationParams(split, limits);
        const range = generateInterpolationRange(rangeOptions);
        itps.push({
            range,
            network: split.network
        });
    }

    return genInterpolationFeature(itps, argv);

    // TODO  move into genInterpolationFeature?
    // feature = argv.debug ? setDebug(range, feature) : feature;

    // TODO review w/ resorting later
    // // Note: rangeOptions and genFeatOptions will be present on some iterpolation ranges
    // // but not others depending on whether or not they are re-calculated below. We should
    // // tidy this up at some point and not expose this state.
    // feature.rangeOptions = rangeOptions;
    // feature.selectedRange = range;
    // feature.genFeatOptions = { split, argv, intersections: split.intersections  };

    // TODO review
    // Sort ITP output to start with lowest number and end with highest/no ITP values
    // itps.sort(itpSort);

    // Check generated interpolation for overlapping ranges, tidy them up and re-sort.
    // let reSort = false;
    // checkInterpolationRanges(itps).forEach((overlap, i) => {
    //     if (overlap.length === 0) return;
    //     const itp = itps[i];
    //     reSort = true;

    //     itp.rangeOptions.overlap = overlap;
    //     const range = generateInterpolationRange(itp.rangeOptions);
    //     const resFeat = genFeat(itp.genFeatOptions.split, range, itp.genFeatOptions.argv, itp.genFeatOptions.intersections);
    //     resFeat.selectedRange = range;
    //     itps[i] = itp.genFeatOptions.argv.debug ? setDebug(range, resFeat) : resFeat;
    // });
    // if (reSort) itps.sort(itpSort);

    // If max or min didn't change from inf values don't try to change actual min/max
    // if (
    //     // If max or min didn't change from their initial values don't try to change actual min/max
    //     (limits.max === 0 && limits.min === 1000000)

    //     // Otherwise if we have addresses > than the 1 million threshold, skip the drop/raise
    //     || limits.max > 1000000
    // ) return join(itps, argv);

    // const d = diff(limits.max, limits.min);

    // if (prevDelta === undefined) itps = addExtendedRange(itps, d, true);
    // if (nextDelta === undefined) itps = addExtendedRange(itps, d, false);

    // return join(itps, argv);
}

/**
 * Creates ranges at the start and end of the network
 * according to the dropped and raised numbers
 * @param  {Object}  itps      Array of interpolated addresses
 * @param  {Number}  diff      Difference of lower/upper bounds
 * @param  {Boolean} isStart   If the range is at the beggining of the segment or not.
 * @return {Object}            Array of interpolated addresses
 */
function addExtendedRange(itps, diff, isStart) {
    // Add range at the beginnig with the L/R lowered number.
    const leftSide = buildExtSide(itps, diff, isStart, true);
    const rightSide = buildExtSide(itps, diff, isStart, false);

    if (!leftSide && !rightSide) return itps;

    const isSameIdx = leftSide && rightSide && leftSide.idx === rightSide.idx;

    if (isSameIdx || leftSide) {
        const spliceIdx = leftSide.idx + (isStart ? 0 : 1);
        itps.splice(spliceIdx, 0, generateRange(itps[leftSide.idx], leftSide, isSameIdx ? rightSide : null));
    }

    if (!isSameIdx && rightSide) {
        const spliceIdx = rightSide.idx + (isStart ? 0 : 1);
        itps.splice(spliceIdx, 0, generateRange(itps[rightSide.idx], null, rightSide));
    }

    return itps;
}

/**
 * Generate L/R range properties of a new range.
 * @param  {Object}  itps    Array of interpolated addresses
 * @param  {Number}  diff    Difference of lower/upper bounds
 * @param  {Boolean} isStart If the range is at the beggining of the segment or not.
 * @param  {Boolean} isLeft  If it is building the left or right side.
 * @return {Object}          Contains the fromhn, tohn and geometry props to build the L/R side.
 */
function buildExtSide(itps, diff, isStart, isLeft) {
    let idx;

    // Get the index of the the first/last nonNull address number
    if (isStart) idx = firstNonNull(itps, isLeft ? 'carmen:lfromhn' : 'carmen:rfromhn');
    else idx = lastNonNull(itps, isLeft ? 'carmen:lfromhn' : 'carmen:rfromhn');

    if (idx < 0) return;

    const sideOpt = {
        idx: idx,
        segment: null
    };

    const fromProp = isLeft ? 'carmen:lfromhn' : 'carmen:rfromhn';
    const toProp = isLeft ? 'carmen:ltohn' : 'carmen:rtohn';

    const itp = itps[sideOpt.idx];
    const fromhn = itp.properties[fromProp][0];
    const tohn = itp.properties[toProp][0];

    const isAscending = (isStart && fromhn < tohn) || (!isStart && fromhn > tohn);

    // Do not raise/lower number if the segment's length is less than 10 meters
    const segment = getEdgeSegment(itp, isAscending ? fromhn : tohn);

    if (!segment) return;

    // Drop Lower/ Raise High Values on L/R side to include more potential addresses ie 22 => 0
    const extNumber = isStart ? dropLow(isAscending ? fromhn : tohn, diff) : raiseHigh(isAscending ? fromhn : tohn, diff);
    if (!extNumber || extNumber === (isAscending ? fromhn : tohn)) return;

    sideOpt[fromProp] = isAscending ? extNumber : tohn;
    sideOpt[toProp] = isAscending ? fromhn : extNumber;
    sideOpt.segment = segment;

    return sideOpt;
}

/**
 * Generate the segment for the extended range if the address point
 * is within the 10m from the end/start edge
 * @param  {Object} range to be raised/dropped
 * @param  {Number} number address number raised/dropped
 * @return {Object}        segment geometry for the new range
 */
function getEdgeSegment(itp, number) {
    const line = itp.geometry.geometries[0];
    const options = itp.selectedRange;

    // Find the range option of the number
    let rangeOpt;
    if (options.lstart && options.lstart.number === number) rangeOpt = options.lstart;
    else if (options.lend && options.lend.number === number) rangeOpt = options.lend;
    else if (options.rstart && options.rstart.number === number) rangeOpt = options.rstart;
    else if (options.rend && options.rend.number === number) rangeOpt = options.rend;
    if (!rangeOpt) return;

    const isStart = rangeOpt.geometry.properties.start;
    const distance = Math.abs((isStart ? 0 : rangeOpt.lineLength) - rangeOpt.pointOnLine.properties.location);
    // Do not create the segment if the number point is within 10m from the edge
    if (distance <= 0.01) return;

    const startPoint = turf.point(line.coordinates[isStart ? 0 : line.coordinates.length - 1]);
    return turf.lineSlice(startPoint, rangeOpt.pointOnLine, line);
}

/**
 * Create the extended range feature by assigning the properties
 * for the left/right side as well as the geometry.
 * @param  {Object} itp       range dropped/raised
 * @param  {Object} leftSide  range properties for the left side
 * @param  {Object} rightSide range properties for the right side
 * @return {Object}           range feature for the extended range
 */
function generateRange(itp, leftSide, rightSide) {
    const isBoth = leftSide && rightSide;
    const range = {
        type: 'Feature',
        properties: {
            address_props: [],
            'carmen:intersections': [],
            'carmen:addressnumber': [null, []],
            'carmen:rangetype': 'tiger',
            'carmen:parityl': [isBoth || leftSide ? itp.properties['carmen:parityl'][0] : null, null],
            'carmen:lfromhn': [isBoth || leftSide ? leftSide['carmen:lfromhn'] : null, null],
            'carmen:ltohn': [isBoth || leftSide ? leftSide['carmen:ltohn'] : null, null],
            'carmen:parityr': [isBoth || rightSide ? itp.properties['carmen:parityr'][0] : null, null],
            'carmen:rfromhn': [isBoth || rightSide ? rightSide['carmen:rfromhn'] : null, null],
            'carmen:rtohn': [isBoth || rightSide ? rightSide['carmen:rtohn'] : null, null]
        },
        geometry: {
            type: 'GeometryCollection',
            geometries: [{
                type: 'MultiLineString',
                coordinates: (isBoth || leftSide ? leftSide : rightSide).segment.geometry.coordinates
            },
            { type: 'MultiPoint', coordinates: [] }
            ]
        },
        debug: itp.debug
    };

    return range;
}

/**
 * Combined multiple PT/ITP features into a single Feature
 * @param {Array} itps Each object in the array should be an ITP/PT combined Feature
 * @param {Object} argv Argument Object
 * @param {boolean} argv.debug Output debug information on features
 * @return {Object} GeoJSON Feature GeometryCollection of combined PT and calculated ITP
 */
function join(itps, argv) {
    throw new Error('Using deprecated interpolize.join method');
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
 * @typedef InterpolationParameters
 *
 * @property  {Object[]} distStart    sorted features for the left and right start
 * @property  {Object[]} distEnd      sorted features for the left and right end
 * @property  {Object}   parity       object with even/odd number information per left/right side
 * @property  {Number}   leftside     0 or 1 for left or right side.
 * @property  {Number}   streetdist   size of the street segment
 * @property  {Boolean}  sequence     true if the address numbers increases along the segment
 * @property  {Array[]|null}  overlap range components (lfrom/lto/rfrom/rto) that overlap with the previous/next range
 */

/**
 * Calculate the metrics used to extrapolate a interpolation range
 *
 * @param {object} split
 * @param {object} split.network - GeoJSON linestring feature
 * @param {object} split.address - GeoJSON multipoint feature
 * @param {object[]} split.number
 * @param {object} limits
 * @param {Number} limits.min
 * @param {Number} limits.max
 * @return {InterpolationParameters}
 */
function calculateInterpolationParams(split, limits) {

    let dist = [];

    const streetdist = turf.lineDistance(split.network);

    // true if beginning of linestring is lowest number
    // false if beginning of linestring is highest number
    let sequence;
    const seqcalc = [false, false]; // tmp var used to calculate sequence [closest start, closest end]

    const distsFromLine = [];

    // Calculate distances for every address and its position on the line
    for (let i = 0; i < split.addressPoints.length; i++) {
        const point = split.addressPoints[i];
        const addr = turf.point(point.coords);

        const res = {
            'distOnLine': point.location,
            'distFromLine': point.dist,
            'distFromOrigin': turf.distance(turf.point(split.network.geometry.coordinates[0]), addr),
            'distFromEnd':  turf.distance(turf.point(split.network.geometry.coordinates[split.network.geometry.coordinates.length - 1]), addr),
            'geometry': addr,
            'number': parseInt(point.props.number),
            'output': point.props.output,
            'props': point.props.props, // blerg, need to rename the point.props, probably don't need point.number either
            'side': null,
            'pointOnLine': linept,
            'lineLength': turf.length(split.network)
        };

        distsFromLine.push(point.dist);

        const seg = segment(split.network, res.distOnLine);
        res.side = misc.sign(misc.det2D(seg[0], seg[1], point.coords));

        if (!seqcalc[0] || seqcalc[0].distFromOrigin > res.distFromOrigin) {
            seqcalc[0] = res;
        }
        if (!seqcalc[1] || seqcalc[1].distFromEnd > res.distFromEnd) {
            seqcalc[1] = res;
        }

        dist.push(res);
    }

    // Filter addresses that are above the a (median * 10) distance threshold.
    // TODO move this earlier.
    distsFromLine.sort((a, b) => a - b);
    const distFromLineLimit = distsFromLine[Math.floor(distsFromLine.length / 2)] * 10;

    const cleared = [];
    for (const res of dist) {
        if (res.distFromLine < distFromLineLimit) {
            if (parseInt(res.number) < limits.min) limits.min = res.number;
            if (parseInt(res.number) > limits.max) limits.max = res.number;

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

    return { distStart, distEnd, parity, leftside, streetdist, sequence };
}

/**
 * Generate interpolation range properties like the left/right start/end and parity,
 * used to build the interpolated range for each street segment.
 *
 * @param  {InterpolationParameters}  options contains properties to generate interpolation ranges
 * @return {object}                   contains interpolation properties
 */
function generateInterpolationRange(options) {
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

        // Null out overlapping ranges so they are populated on the next iteration.
        if (options.overlap) {
            for (const range of options.overlap) {
                const k = range[0];
                const number = range[1];
                if (result[k] && result[k].number === number) result[k] = null;
            }
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

        // Null out overlapping ranges so they are populated on the next iteration.
        if (options.overlap) {
            for (const range of options.overlap) {
                const k = range[0];
                const number = range[1];
                if (result[k] && result[k].number === number) result[k] = null;
            }
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
        if (options.parity.ro / options.parity.totalr > 0.70) result.parityr = 'O';
        if (options.parity.re / options.parity.totalr > 0.70) result.parityr = 'E';

        // at lease some parity is needed to make this work
        if (!result.parityr) {
            if (result.rstart.number % 2 === 0 && result.rend.number % 2 === 0) {
                result.parityr = 'E';
            } else if (result.rstart.number % 2 === 1 && result.rend.number % 2 === 1) {
                result.parityr = 'O';
            } else { // this is completely arbitrary - in the us odd are usually left/even right
                result.parityr = 'E';
            }
        }

        if (result.parityr === 'E') {
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
        if (options.parity.lo / options.parity.totall > 0.70) result.parityl = 'O';
        if (options.parity.le / options.parity.totall > 0.70) result.parityl = 'E';

        if (!result.parityl) {
            if (result.lstart && result.lend && result.lstart.number % 2 === 0 && result.lend.number % 2 === 0) {
                result.parityl = 'E';
            } else if (result.rstart && result.rend && result.rstart.number % 2 === 1 && result.rend.number % 2 === 1) {
                result.parityl = 'O';
            } else {
                result.parityl = 'O';
            }
        }

        if (result.parityl === 'E') {
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
 *
 * @param  {object[]} itps sorted array of interpolated features.
 * @return {Array[]}      array of overlapping range descriptions
 */
function checkInterpolationRanges(itps) {
    if (!itps) return itps;
    // Current implementation is very simplistic and designed only to catch extremely wrong points
    // with the expectation that they occur rarely. If the previous range was invalid we make no
    // assumptions that it can be use to detect errors in the current range, because we use the
    // previous range as a baseline in our comparison.
    let prevInvalid = [false, false];

    return itps.map((itp, i) => {
        if (i === 0  || i === (itps.length - 1) || !itp.properties || !itp.rangeOptions) {
            // Do not change ends of the cluster or if a range wasn't requested or generated.
            prevInvalid = [false, false];
            return [];
        }

        const lfrom = propAtIdx(itp, 'carmen:lfromhn');
        const lto = propAtIdx(itp, 'carmen:ltohn');
        const rfrom = propAtIdx(itp, 'carmen:rfromhn');
        const rto = propAtIdx(itp, 'carmen:rtohn');

        // Note we don't record enough information to ensure a range boundry can be selected that
        // is valid, just that the current one is not.
        const overlap = [];

        if (prevInvalid[0]) {
            prevInvalid[0] = false;
        } else if (lfrom && lto && lfrom !== lto) {
            const lfromInRange = isInRange(propAtIdx(itps[i - 1], 'carmen:lfromhn'), lfrom, propAtIdx(itps[i + 1],'carmen:lfromhn'));
            const ltoInRange = isInRange(propAtIdx(itps[i - 1], 'carmen:ltohn'), lto, propAtIdx(itps[i + 1],'carmen:ltohn'));
            if (!lfromInRange) overlap.push(['lstart', lfrom]);
            if (!ltoInRange) overlap.push(['lend', lto]);
            prevInvalid[0] = !lfromInRange || !lfromInRange;
        }

        if (prevInvalid[1]) {
            prevInvalid[1] = false;
        } else if (rfrom && rto && rfrom !== rto) {
            const rfromInRange = isInRange(propAtIdx(itps[i - 1], 'carmen:rfromhn'), rfrom, propAtIdx(itps[i + 1],'carmen:rfromhn'));
            const rtoInRange = isInRange(propAtIdx(itps[i - 1], 'carmen:rtohn'), rto, propAtIdx(itps[i + 1],'carmen:rtohn'));
            if (!rfromInRange) overlap.push(['rstart', rfrom]);
            if (!rtoInRange) overlap.push(['rend', rto]);
            prevInvalid[1] = !rfromInRange || !rfromInRange;
        }

        return overlap;
    });
}

/**
 * Helper to get first value in a from a property array, or null
 *
 * @param {object} feature GeoJSON
 * @param {string} property name
 * @param {number} i defaults to 0
 * @return {null|number|string}
 */
function propAtIdx(feature, property, i = 0) {
    return feature.properties[property] ? feature.properties[property][i] : null;
}

/**
 * Determine if an number is between its neighbors
 * @param {number} previous
 * @param {number} current
 * @param {number} next
 * @return {boolean} true if current is between previous and next, false otherwise
 */
function isInRange(previous, current, next) {
    if (!previous || !next) return true;
    if (previous < next) {
        return (current > previous && current < next);
    } else {
        return (current > next && current < previous);
    }
}

/**
 * Calculated difference between min and max housenumber to push the number * to the closest 10^ ie 3-9 => 1->11
 * @param {numeric} max Max civic address
 * @param {numeric} min Min civic address
 * @return {numeric} calc'd diff
 */
function diff(max, min) {
    const diff = Math.pow(10, Math.round(Math.log10(Math.abs(max - min)))); // Diff represented in 10^n

    // Diff values are more conservative after the 1000 limit
    return diff > 1000 ? diff / 10 : diff;
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
 * Generate a GeoJSON MultiLineString for interpolation ranges
 *
 * @param {Object[]} itps
 *
 * @return {Object} GeoJSON MultiLineString
 */
function genInterpolationFeature(itps) {
    const coordinates = [];
    const properties = {
        'carmen:rangetype': 'tiger',
        'carmen:parityl': [],
        'carmen:lfromhn': [],
        'carmen:ltohn': [] ,
        'carmen:parityr': [],
        'carmen:rfromhn': [],
        'carmen:rtohn': []
    };
    for (let i = 0; i < itps.length; i++) {
        coordinates.push(itps[i].network.geometry.coordinates);
        const result = itps[i].range;
        properties['carmen:parityl'].push(result.parityl ? result.parityl : null);
        properties['carmen:lfromhn'] .push(result.lstart ? result.lstart.number : null);
        properties['carmen:ltohn'].push(result.lend ? result.lend.number : null);
        properties['carmen:parityr'].push(result.parityr ? result.parityr : null);
        properties['carmen:rfromhn'].push(result.rstart ? result.rstart.number : null);
        properties['carmen:rtohn'].push(result.rend ? result.rend.number : null);
    }
    return turf.multiLineString(coordinates, properties);
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
function genFeat(split, result, argv) {
    throw new Error('genFeat is deprecated');
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
    res.properties['carmen:parityl'] = [result.parityl ? result.parityl : null];
    res.properties['carmen:lfromhn'] = [result.lstart ? result.lstart.number : null];
    res.properties['carmen:ltohn'] = [result.lend ? result.lend.number : null];
    res.properties['carmen:parityr'] = [result.parityr ? result.parityr : null];
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

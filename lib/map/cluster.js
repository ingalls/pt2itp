'use strict';

const turf = require('@turf/turf');
const Misc = require('../util/misc');

/**
 * Attempt to break a single NetworkCluster into n network clusters where there are dup addresses
 *
 * --Dup accross segments -- (TYPE: ClusterDup)
 * Output:        | Input:
 * --1--   --2--  | --1a-- --1b--
 * 1 2 3   3 2 1  | 1 2 3   3 2 1
 *
 *
 * -- Dup within Segment -- (TYPE SegDup)
 * Output:        | Input:
 * --1--   --2--  | ------1------
 * 1 2 3   3 2 1  | 1 2 3   3 2 1
 *
 * Note: This uses the misc.hasDupAddresswithin test and as such assumes ordered numbers within each segment
 *
 * @param {Segment[]} segs Array of addr/number/lnstring segments to attempt to split
 * @param {number} id Optional network_cluster id for debugging
 * @return {Segment[]} New segments array
 */
function breakCluster(segs, id) {
    // Classify into SegDup or Clusterdup
    const segDup = []; // Parallel array to segs of whether it contains a dup (bool)
    for (let seg_it = 0; seg_it < segs.length; seg_it++) {
        const seg = segs[seg_it];

        if (!seg.number) {
            segDup[seg_it] = false;
        } else if (Misc.hasDupAddressWithin(seg.number.map((prop) => { return prop.number; }), seg.address.geometry.coordinates)) {
            segDup[seg_it] = true;
        } else {
            segDup[seg_it] = false;
        }
    }

    // Attempt to handle and split a ClusterDup
    // TODO: This currently only handles segs with a length of 2, a full implmentation to handle
    //  segs > 2 has yet to be written
    if (!segDup.some((dup) => { return dup; }) && segs.length === 2) {
        return segs.map((seg) => {
            return {
                number: seg.number,
                address: seg.address.geometry.coordinates,
                network: turf.featureCollection([seg.network]),
                intersections: seg.intersections
            };
        });
    } else if (!segDup.some((dup) => { return dup; })) {
        if (this.warn) {
            this.warn.write(`WARN: detected unhandled ClusterDup on network_cluster.id: ${id}\n`);
        }
    }

    const orphanSegs = []; // Segs that needs to be matched based on prox. at the end with segments in newSegs
    let newSegs = []; // Break apart cluster into new clusters

    // Attempt to handle and split a SegDup
    for (let seg_it = 0; seg_it < segs.length; seg_it++) {
        const seg = segs[seg_it];

        // If the seg doesn't have addresses, or has addresses with no dups,
        // don't attempt to break it, set it aside in orphanSegs for later
        if (!segDup[seg_it] || !seg.address || turf.lineDistance(seg.network) < 1) {
            orphanSegs.push(seg);
            continue;
        }

        // Dist array contains an ordering of the address points based on distance to origin
        const dist = [];
        for (let addr_it = 0; addr_it < seg.number.length; addr_it++) {
            const addr = turf.point(seg.address.geometry.coordinates[addr_it]);
            const linept = turf.pointOnLine(seg.network, addr);

            const res = {
                distOnLine: turf.lineDistance(turf.lineSlice(turf.point(seg.network.geometry.coordinates[0]), linept, seg.network)),
                distFromLine: turf.distance(addr, linept),
                geometry: addr,
                number: parseInt(seg.number[addr_it].number),
                original: seg.number[addr_it],
                output: seg.number[addr_it].output
            };

            dist.push(res);
        }

        // Sort from origin => end
        dist.sort((a, b) => {
            if (a.distOnLine < b.distOnLine) return -1;
            if (a.distOnLine > b.distOnLine) return 1;
            if (a.distOnLine === b.distOnLine) return a.distFromLine - b.distFromLine;
        });

        // Calculate the dist delta for the segments, basically an array with a +1, 0, or -1 to show the relationship
        // with the previous address. IE: [1, 3, 5, 9, 9, 5, 3] => [1, 1, 1, 1, 0, -1, -1 ]
        const distDelta = [];
        for (let d_it = 1; d_it < dist.length; d_it++) {
            const deltaNum = dist[d_it].number - dist[d_it - 1].number;
            distDelta.push([dist[d_it].distOnLine, deltaNum > 0 ? 1 : -1]);
        }

        let breaks = []; // Array indices to break on

        this.detectCliffs(breaks, dist, distDelta);

        this.detectPeaks(breaks, dist, distDelta);

        if (!breaks.length) {
            orphanSegs.push(seg);
            continue;
        }

        breaks = breaks.sort((a, b) => a - b);

        // For Each break start at the previous (or 0th) element and return the address/network/numbers in between
        for (let brk_it = 0; brk_it < breaks.length; brk_it++) {
            const brk = breaks[brk_it];

            const isFirst = breaks[brk_it - 1] ? false : true;

            const brk_dist_start = isFirst ? 0 : dist[breaks[brk_it - 1]].distOnLine + (dist[breaks[brk_it - 1] + 1].distOnLine - dist[breaks[brk_it - 1]].distOnLine) / 2;
            const brk_dist_end = dist[brk].distOnLine + (dist[brk + 1].distOnLine - dist[brk].distOnLine) / 2;

            const newSeg = {
                address: turf.multiPoint(dist.slice(isFirst ? 0 : breaks[brk_it - 1] + 1, brk + 1).map((d) => {
                    return d.geometry.geometry.coordinates;
                })).geometry.coordinates,
                number: dist.slice(isFirst ? 0 : breaks[brk_it - 1] + 1, brk + 1).map((d) => {
                    return d.original;
                }),
                network: brk_dist_start !== brk_dist_end ? turf.lineSliceAlong(seg.network, brk_dist_start, brk_dist_end) : false,
                intersections: []
            };

            // Mark segment as having cliff/peak
            if (brk > 0) {
                newSeg.prevDelta = dist[brk].number - dist[brk - 1].number;
            }
            if (brk < dist.length) {
                newSeg.nextDelta = dist[brk + 1].number - dist[brk].number;
            }

            newSegs.push(newSeg);
        }

        // Push remaining portion of segment
        const brk = breaks[breaks.length - 1];
        const brk_dist_start = dist[brk].distOnLine + (dist[brk + 1].distOnLine - dist[brk].distOnLine) / 2;
        const brk_dist_end = turf.length(seg.network);

        newSegs.push({
            address: turf.multiPoint(dist.slice(brk + 1).map((d) => {
                return d.geometry.geometry.coordinates;
            })).geometry.coordinates,
            number: dist.slice(brk + 1).map((d) => {
                return d.original;
            }),
            network: brk_dist_start !== brk_dist_end ? turf.lineSliceAlong(seg.network, brk_dist_start, brk_dist_end) : false,
            intersections: [],
            prevDelta: dist[brk].number - dist[brk - 1].number
        });
    }


    // Q: Won't this mean we return w/o processing any orphan segments?
    if (!newSegs.length) return false;

    newSegs = newSegs.map((seg) => {
        if (seg.network) {
            seg.network = turf.featureCollection([seg.network]);
        } else {
            seg.network = turf.featureCollection([]);
        }

        return seg;
    });

    for (const oSeg of orphanSegs) {
        const closest = {
            dist: false,
            ele: false
        };

        for (let n_it = 0; n_it < newSegs.length; n_it++) {
            const nseg = newSegs[n_it];

            if (!nseg.network.features.length) continue;

            const d = turf.distance(turf.center(oSeg.network), turf.center(nseg.network));

            if (!closest.dist || closest.dist > d) {
                closest.dist = d;
                closest.ele = n_it;
            }
        }

        newSegs[closest.ele].network ? newSegs[closest.ele].network.features.push(oSeg.network) : newSegs[closest.ele].network = { type: 'FeatureCollection', features: [oSeg.network] };
        if (oSeg.address && oSeg.number) {
            newSegs[closest.ele].address = newSegs[closest.ele].address.concat(oSeg.address.geometry.coordinates);
            newSegs[closest.ele].number = newSegs[closest.ele].number.concat(oSeg.number);
        }
    }

    return newSegs;
}

/**
 * Address Cliff Detection - 1 2 3 1 2 3
 *
 * @param {Number[]} breaks - Array of positions to break the segment
 * @param {Array[]} dist
 * @param {Array[]} distDelta
 */
function detectCliffs(breaks, dist, distDelta) {
    let floating_min = 0;
    let floating_max = 0;
    let floating_delta = null;
    for (let i = 0; i < dist.length - 1; i++) {
        if (!floating_delta) floating_delta = distDelta[i][1];

        // Anytime the dist delta changes, check it for an address cliff
        if (floating_delta !== distDelta[i][1] && dist[i].number < (floating_max - floating_min) * 0.25) {
            breaks.push(i);
            floating_min = 0;
            floating_max = 0;
            floating_delta = null;
        } else {
            if (dist[i].number < floating_min) floating_min = dist[i].number;
            if (dist[i].number > floating_max) floating_max = dist[i].number;
        }
    }
}

/**
 * Address Hump Detecton - 1 2 3 3 2 1
 *
 * @param {Number[]} breaks - Array of positions to break the segment
 * @param {Array[]} dist
 * @param {Array[]} distDelta - Array of value pairs - distance delta, directional number delta
 *                              which is normally -1, 0 or 1.
 */
function detectPeaks(breaks, dist, distDelta) {

    const avg_window = Math.min(Math.ceil(dist.length / 10), 10);

    // Perform a moving average filter to reduce random noise and allow identification as a next step
    const avg = this.movingAverage(distDelta, avg_window);

    let floating_sin = avg[0] > 0;
    for (let i = 1; i < avg.length; i++) {
        if (floating_sin === avg[i] > 0) continue;

        let curr_break = null;

        // Determine exact beginning of new avg - this loop checks if the actual number is before the avg crosses the x axis
        for (let j = i - 1; j >= Math.max(0, i - Math.ceil(avg_window / 2)); j--) {
            if (floating_sin !== distDelta[j] > 0) curr_break = j;
        }

        if (floating_sin !== distDelta[i] > 0) curr_break = i;

        // and if no value is found, check if it crosses after
        if (!curr_break) {
            for (let j = i + 1; j <= Math.min(avg.length, i + Math.ceil(avg_window / 2)); j++) {
                if (floating_sin !== distDelta[j] > 0) curr_break = j;
            }
        }

        if (curr_break) {
            breaks.push(curr_break);
            floating_sin = avg[i] > 0;
        }
    }
}

/**
 * Generate moving average
 *
 * @param {Array[]} distDelta - Array of value pairs - distance delta, directional number delta
 *                              which is normally -1, 0 or 1.
 * @param {Number} avg_window - Width of the window to calculate the average, must be a integer.
 * @return {Number[]}         - Array of averages
 */
function movingAverage(distDelta, avg_window) {
    const len = distDelta.length;
    const avg = [];
    if (len === 0) return avg;

    let sum = distDelta[0][1];
    avg.push(sum);
    for (let i = 1; i < len; i++) {
        let width = avg_window;
        if (i >= avg_window) {
            sum -= distDelta[i - avg_window][1];
        } else {
            width = i + 1;
        }
        sum += distDelta[i][1];
        avg.push(sum / width);
    }
    return avg;
}

module.exports = {
    break: breakCluster,
    detectCliffs,
    detectPeaks,
    movingAverage
};

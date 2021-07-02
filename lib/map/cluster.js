'use strict';

/**
 * Address Cliff Detection - 1 2 3 1 2 3
 *
 * @param {Number[]} breaks - Array of positions to break the segment
 * @param {AttachedPoints[]} dist - array of address points
 * @param {Array[]} distDelta - Array of value pairs - distance delta, directional number delta
 *                              which is normally -1, 0 or 1.
 */
function detectCliffs(breaks, dist, distDelta) {
    let pointCount = 0;
    let floating_min = 0;
    let floating_max = 0;
    let floating_delta = null;
    for (let i = 0; i < dist.length - 1; i++) {
        if (!floating_delta) floating_delta = distDelta[i][1];
        pointCount++;

        const number = parseInt(dist[i].props.number);

        // Anytime the dist delta changes, check it for an address cliff
        if (floating_delta !== distDelta[i][1]
          && outOfRange(dist, i, i + 1, floating_min, floating_max)
          && pointCount > 5) {
            breaks.push(i);
            pointCount = 0;
            floating_min = 0;
            floating_max = 0;
            floating_delta = null;
        } else {
            if (number < floating_min) floating_min = number;
            if (number > floating_max) floating_max = number;
        }
    }
}

/**
 * Determines if the number difference is sufficiently far away from
 * given range.
 *
 * @param {AttachedPoints[]} addressPoints - array of address points
 * @param {Number} aIdx - first address point index to look at
 * @param {Number} bIdx - second address point index to look at
 * @param {Number} floatingMin - current min number of the observed range
 * @param {Number} floatingMax - current max number of the observed range
 * @returns {Boolean}
 */
function outOfRange(addressPoints, aIdx, bIdx, floatingMin, floatingMax) {
    if (!addressPoints[aIdx] || !addressPoints[bIdx]) return false;
    const aNum = parseInt(addressPoints[aIdx].props.number);
    const bNum = parseInt(addressPoints[bIdx].props.number);
    return ((Math.abs(aNum - bNum)) > (floatingMax - floatingMin) * 0.25);
}

/**
 * Address Hump Detecton - 1 2 3 3 2 1
 *
 * @param {Number[]} breaks - Array of positions to break the segment
 * @param {AttachedPoints[]} dist - array of address points
 * @param {Array[]} distDelta - Array of value pairs - distance delta, directional number delta
 *                              which is normally -1, 0 or 1.
 */
function detectPeaks(breaks, dist, distDelta) {
    const peaks = [];
    for (let i = 0; i <= breaks.length; i++) {
        let start, end;
        // use entire dist array
        if (breaks.length === 0) {
            start = 0;
            end = dist.length - 1;
        // use last segment
        } else if (i === breaks.length) {
            start = breaks[breaks.length - 1];
            end = dist.length - 1;
        // use current break
        } else {
            start = i === 0 ? 0 : breaks[i - 1];
            end = breaks[i];
        }

        const avg_window = Math.min(Math.ceil((end - start + 1) / 10), 10);

        const distSlice = distDelta.slice(start, end);

        // Perform a moving average filter to reduce random noise and allow identification as a next step
        const avg = movingAverage(distSlice, avg_window);

        let pointCount = 0;
        let floating_sin = avg[0] > 0;
        for (let j = 1; j < avg.length; j++) {
            if (floating_sin === avg[j] > 0 || pointCount < 5) {
                pointCount++;
                continue;
            }

            let curr_break = null;

            // Determine exact beginning of new avg - this loop checks if the actual number is before the avg crosses the x axis
            for (let k = j - 1; k >= Math.max(0, j - Math.ceil(avg_window / 2)); k--) {
                if (floating_sin !== distSlice[k] > 0) curr_break = k;
            }

            if (floating_sin !== distSlice[j] > 0) curr_break = j;

            // and if no value is found, check if it crosses after
            if (!curr_break) {
                for (let k = j + 1; k <= Math.min(avg.length, j + Math.ceil(avg_window / 2)); k++) {
                    if (floating_sin !== distSlice[k] > 0) curr_break = k;
                }
            }

            if (curr_break) {
                peaks.push(start + curr_break);
                floating_sin = avg[j] > 0;
                pointCount = 0;
            }
        }
    }
    breaks.push(...peaks);
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
    detectCliffs,
    detectPeaks,
    movingAverage
};

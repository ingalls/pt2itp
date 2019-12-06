'use strict';

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
    detectCliffs,
    detectPeaks,
    movingAverage
};

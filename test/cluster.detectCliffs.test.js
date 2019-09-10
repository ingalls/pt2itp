'use strict';

const Cluster = require('../lib/map/cluster');
const test = require('tape');

test('Assert no cliffs: decreasing address', (t) => {
    const breaks = [];
    const dist = [{}, {}, {}, {}, {}, {}, {}];
    const distDelta = [
        [0.08377450659387839, -1],
        [0.17396332414573248, -1],
        [0.23793824079317832, -1],
        [0.3891094963970436, -1],
        [0.44205524435250465, -1],
        [0.5580128085166958, -1],
        [0.6847299289068616, -1]
    ];

    Cluster.detectPeaks(breaks, dist, distDelta);

    t.deepEquals(breaks, []);

    t.end();
});

test('Assert single cliff detection', (t) => {
    const breaks = [];

    const dist = [
        { number: 5 },
        { number: 4 },
        { number: 3 },
        { number: 2 },
        { number: 1 },
        { number: 8 },
        { number: 7 },
        { number: 6 },
        { number: 5 },
        { number: 4 },
        { number: 3 },
        { number: 2 }
    ];

    const distDelta = [
        [0.3891094963970436, -1],
        [0.44205524435250465, -1],
        [0.5580128085166958, -1],
        [0.6847299289068616, -1],
        [1.6431225457560013, 1],
        [1.8805725020521158, -1],
        [1.8826690187380661, -1],
        [2.0578276385130447, -1],
        [2.135383249826695, -1],
        [2.293316256609901, -1],
        [2.3579600324821057, -1]
    ];

    Cluster.detectCliffs(breaks, dist, distDelta);

    t.deepEquals(breaks, [4]);

    t.end();
});


test('Assert multiple cliffs detection', (t) => {
    const breaks = [];

    const dist = [
        { number: 8 },
        { number: 7 },
        { number: 6 },
        { number: 5 },
        { number: 4 },
        { number: 3 },
        { number: 2 },
        { number: 1 },
        { number: 8 },
        { number: 7 },
        { number: 6 },
        { number: 5 },
        { number: 4 },
        { number: 3 },
        { number: 2 },
        { number: 1 },
        { number: 8 },
        { number: 7 },
        { number: 6 },
        { number: 5 },
        { number: 4 }
    ];

    const distDelta = [
        [0.08377450659387839, -1],
        [0.17396332414573248, -1],
        [0.23793824079317832, -1],
        [0.3891094963970436, -1],
        [0.44205524435250465, -1],
        [0.5580128085166958, -1],
        [0.6847299289068616, -1],
        [1.6431225457560013, 1],
        [1.8805725020521158, -1],
        [1.8826690187380661, -1],
        [2.0578276385130447, -1],
        [2.135383249826695, -1],
        [2.293316256609901, -1],
        [2.3579600324821057, -1],
        [2.4359468967236415, -1],
        [2.5122786060672806, 1],
        [2.5122786060672806, -1],
        [2.5122786060672806, -1],
        [2.5122786060672806, -1],
        [2.5122786060672806, -1]
    ];

    Cluster.detectCliffs(breaks, dist, distDelta);

    t.deepEquals(breaks, [7, 15]);

    t.end();
});

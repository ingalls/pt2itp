'use strict';

const Cluster = require('../lib/map/cluster');
const test = require('tape');

test('Assert no peaks: increasing address', (t) => {
    const breaks = [];
    const dist = [{}, {}, {}, {}, {}, {}, {}];
    const distDelta = [
        [0.08377450659387839, 1],
        [0.17396332414573248, 1],
        [0.23793824079317832, 1],
        [0.3891094963970436, 1],
        [0.44205524435250465, 1],
        [0.5580128085166958, 1],
        [0.6847299289068616, 1]
    ];

    Cluster.detectPeaks(breaks, dist, distDelta);

    t.deepEquals(breaks, []);

    t.end();
});

test('Assert no peaks: decreasing address', (t) => {
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


test('Assert single peak detection', (t) => {
    const breaks = [];
    const dist = [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}];
    const distDelta = [
        [0.08377450659387839, 1],
        [0.17396332414573248, 1],
        [0.23793824079317832, 1],
        [0.3891094963970436, 1],
        [0.44205524435250465, 1],
        [0.5580128085166958, 1],
        [0.6847299289068616, 1],
        [1.6431225457560013, -1],
        [1.8805725020521158, -1],
        [1.8826690187380661, -1],
        [2.0578276385130447, -1],
        [2.135383249826695, -1],
        [2.293316256609901, -1],
        [2.3579600324821057, -1],
        [2.4359468967236415, -1]
    ];

    Cluster.detectPeaks(breaks, dist, distDelta);

    t.deepEquals(breaks, [7]);

    t.end();
});

// We handle just one break
// TODO: This is suppose to get 7 and not 8
test('Assert multiple peaks detection', (t) => {
    const breaks = [];
    const dist = [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}];
    const distDelta = [
        [0.08377450659387839, 1],
        [0.17396332414573248, 1],
        [0.23793824079317832, 1],
        [0.3891094963970436, 1],
        [0.44205524435250465, 1],
        [0.5580128085166958, 1],
        [0.6847299289068616, 1],
        [1.6431225457560013, -1],
        [1.8805725020521158, -1],
        [1.8826690187380661, -1],
        [2.0578276385130447, -1],
        [2.135383249826695, -1],
        [2.293316256609901, -1],
        [2.3579600324821057, -1],
        [3.4359468967236415, 1],
        [3.0578276385130447, 1],
        [3.135383249826695, 1],
        [3.293316256609901, 1],
        [3.3579600324821057, 1],
        [3.4359468967236415, 1]
    ];

    Cluster.detectPeaks(breaks, dist, distDelta);

    t.deepEquals(breaks, [8]);
    t.end();
});

test('Moving Average', (t) => {
    let vals = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5].map((v, i) => [i, v]);
    let avg = Cluster.movingAverage(vals, 5);
    t.deepEqual(avg, [
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5,
        5
    ]);

    vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v, i) => [i, v]);
    avg = Cluster.movingAverage(vals, 5);
    t.deepEqual(avg,[
        1,
        1.5,
        2,
        2.5,
        3,
        4,
        5,
        6,
        7,
        8
    ]);

    vals = [1, 2, 3, 4, 1, 6, 7, 8, 900, 10].map((v, i) => [i, v]);
    avg = Cluster.movingAverage(vals, 5);
    t.deepEqual(avg, [
        1,
        1.5,
        2,
        2.5,
        2.2,
        3.2,
        4.2,
        5.2,
        184.4,
        186.2
    ]);

    vals = [1].map((v, i) => [i, v]);
    avg = Cluster.movingAverage(vals, 1);
    t.deepEqual(avg, [1], 'Single value input');

    vals = [1].map((v, i) => [i, v]);
    avg = Cluster.movingAverage(vals, 10);
    t.deepEqual(avg, [1], 'Overly large window');

    vals = [].map((v, i) => [i, v]);
    avg = Cluster.movingAverage(vals, 1);
    t.deepEqual(avg, [], 'Empty input, empty output.');

    vals = [1, 1, 1, -1, -1, 1, 1, 1, 1, 1].map((v, i) => [i, v]);
    avg = Cluster.movingAverage(vals, 1);
    t.deepEqual(avg, [1, 1, 1, -1, -1, 1, 1, 1, 1, 1]);

    vals = [1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, 1].map((v, i) => [i, v]);
    avg = Cluster.movingAverage(vals, 2);
    t.deepEqual(avg,[1, 1, 1, 1, 1, 1, 0, -1, -1, -1, -1, -1, -1, 0, 1, 1, 1, 1, 1, 1]);

    t.end();
});

test.skip('Moving Average - performance', (t) => {
    let vals = new Array(1000);
    vals = vals.fill([1,100]);

    const start = process.hrtime.bigint();
    for (let i = 0; i < 10000; i++) {
        Cluster.movingAverage(vals, 100);
    }
    const end = process.hrtime.bigint();
    const time = Number(end - start) / 1e6;
    console.log(`${time} ms`);
    t.ok(time < 200, 'Moving average took less than 200 ms');
    t.end();
});

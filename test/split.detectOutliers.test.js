'use strict';

const test = require('tape');
const { Split } = require('../lib/map/split');

const ignored = (res) => res.reduce((p, c, i) => {
    if (c.ignore) p.push(i);
    return p;
}, []);


//             o
//
//                  *
//
//         *
//     *
// *
test('handle standard outliers', (t) => {
    const addressLocations = [
        { location: 0, number: 1 },
        { location: 0.1, number: 3 },
        { location: 0.2, number: 5 },
        { location: 0.3, number: 7 },
        { location: 0.4, number: 90 },
        { location: 0.5, number: 11 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [4]);
    t.end();
});

//             *
//    3x*
// *
test('clustered duplicates should not affect outlier detection', (t) => {
    const addressLocations = [
        { location: 0, number: 100 },
        { location: 0.1, number: 105 },
        { location: 0.1, number: 105 },
        { location: 0.1 , number: 105 },
        { location: 0.5, number: 125 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), []);
    t.end();
});


//             *
//    3x*
// *
test('clustered points should not affect outlier detection', (t) => {
    const addressLocations = [
        { location: 0, number: 100 },
        { location: 0.1, number: 105 },
        { location: 0.101, number: 106 },
        { location: 0.102, number: 107 },
        { location: 0.5, number: 125 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), []);
    t.end();
});

//                      *
//
//
//         *
//     *
// *
test('distant addresses that line up should not be marked as outliers', (t) => {
    const addressLocations = [
        { location: 0, number: 2 },
        { location: 0.1, number: 4 },
        { location: 0.2, number: 6 },
        { location: 0.3, number: 8 },
        { location: 0.4, number: 10 },
        { location: 3.0, number: 30 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), []);
    t.end();
});

//                        o
//             *              *
//         *
//     *              *
// *             *
test('handle cliffs with outliers', (t) => {
    const addressLocations = [
        { location: 0, number: 2 },
        { location: 0.1, number: 4 },
        { location: 0.2, number: 6 },
        { location: 0.3, number: 8 },
        { location: 0.4, number: 2 },
        { location: 0.5, number: 4 },
        { location: 0.6, number: 22 },
        { location: 0.7, number: 8 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [6]);
    t.end();
});

//                  *
//         *
// *
//
//
//     o        o
test('handle multiple clear outliers like stray zeroes', (t) => {
    const addressLocations = [
        { location: 0, number: 500 },
        { location: 0.1, number: 0 },
        { location: 0.2, number: 505 },
        { location: 0.3, number: 0 },
        { location: 0.4, number: 510 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [1, 3]);
    t.end();
});

//             *   *
//         *           *
//     *                   *
// *             o            *
test('handle outliers within peaks', (t) => {
    const addressLocations = [
        { location: 0, number: 2 },
        { location: 0.1, number: 4 },
        { location: 0.2, number: 6 },
        { location: 0.3, number: 8 },
        { location: 0.4, number: 10 },
        { location: 0.5, number: 0 },
        { location: 0.6, number: 10 },
        { location: 0.7, number: 8 },
        { location: 0.8, number: 6 },
        { location: 0.9, number: 4 },
        { location: 1, number: 2 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [5]);
    t.end();
});

//                  o
//          *
//       *
//    *         *
// *                    *
test('handle peak with outlier that could be extension of the first segment', (t) => {
    const addressLocations = [
        { location: 0, number: 2 },
        { location: 0.1, number: 4 },
        { location: 0.2, number: 6 },
        { location: 0.3, number: 8 },
        { location: 0.4, number: 4 },
        { location: 0.5, number: 16 },
        { location: 0.6, number: 2 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [5]);
    t.end();
});


//                    7xO
//
//                             *
//               *
//       *
// *
test('handle several copies of the same outlier', (t) => {
    const addressLocations = [
        { location: 0, number: 1 },
        { location: 0.1, number: 3 },
        { location: 0.2, number: 5 },
        { location: 0.3, number: 15 },
        { location: 0.3, number: 15 },
        { location: 0.3, number: 15 },
        { location: 0.3, number: 15 },
        { location: 0.3, number: 15 },
        { location: 0.3, number: 15 },
        { location: 0.3, number: 15 },
        { location: 0.4, number: 9 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [3, 4, 5, 6, 7, 8, 9]);
    t.end();
});

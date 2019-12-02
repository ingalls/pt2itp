'use strict';

const Cluster = require('../lib/map/cluster');
const Split = require('../lib/map/split').Split;
const test = require('tape');
const fs = require('fs');
const _ = require('lodash');

/**
 * Helper function to sort segs for input into cluster#break
 *
 * Since misc.hasDupAddressWithin expects an ordered set, this is required
 *
 * @param {Object} seg
 * @return {Object}
 */
function sort(seg) {
    seg.number = [];

    seg.address.geometry.coordinates = _.sortBy(seg.address.geometry.coordinates, [(coord) => {
        return coord[2];
    }]).map((coord) => {
        seg.number.push({
            number: coord.pop(),
            output: true
        });

        return coord;
    });

    return seg;
}

/**
 * 1  3  5  7     1  3  5  7
 * -----------------------------
 *    2  4  6  8     2  4  6  8
 *
 *               ^ split
 */
test('cluster#break - address cliff', (t) => {
    const segs = [sort({
        address: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [-72.01117515563965, 41.34208472736567, 1],
                    [-72.00894355773924, 41.342116947303296, 2],
                    [-72.0104455947876, 41.34092479899412, 3],
                    [-72.0078706741333, 41.3403770478594, 4],
                    [-72.00928688049316, 41.33886265309968, 5],
                    [-72.00602531433105, 41.33889487463142, 6],
                    [-72.0075273513794, 41.33744488992133, 7],
                    [-72.00362205505371, 41.33770266734016, 8],
                    [-71.99997425079346, 41.3295821885645, 1],
                    [-71.99761390686035, 41.32880875683843, 2],
                    [-71.99958801269531, 41.327680819112864, 3],
                    [-71.99748516082764, 41.32706850188449, 4],
                    [-71.99967384338379, 41.32584385016455, 5],
                    [-71.99761390686035, 41.325134830753576, 6],
                    [-71.99975967407227, 41.32445803230074, 7],
                    [-71.99774265289305, 41.323491165174005, 8]
                ]
            }
        },
        network: {
            'type': 'Feature',
            'properties': {},
            'geometry': {
                'type': 'LineString',
                'coordinates': [[-71.99898719787598, 41.32365231069138], [-71.99847221374512, 41.32819645021033], [-71.99950218200684, 41.33167685338174], [-72.00169086456297, 41.33544708033362], [-72.00774192810059, 41.33905598205104], [-72.00937271118164, 41.340957019505645], [-72.01070308685303, 41.34301909908479]]
            }
        }
    })];

    const newSegs = Cluster.break(segs);

    t.equals(newSegs.length, 2);

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/cluster-cliff.json', JSON.stringify(newSegs, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(newSegs, require('./fixtures/cluster-cliff.json'));

    t.end();
});

/**
 * 1  3  5  7     1  3  5  7     1  3  5  7
 * -----------------------------------------------
 *    2  4  6  8     2  4  6  8     2  4  6  8
 *
 *               ^ split        ^ split
 */
test('cluster#break - address cliff (double)', (t) => {
    const segs = [sort({
        address: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [-72.02332019805908, 41.34632151238116, 1],
                    [-72.02267646789551, 41.34743301869497, 2],
                    [-72.02207565307617, 41.34649871031123, 3],
                    [-72.02113151550293, 41.34756188776471, 4],
                    [-72.0208740234375, 41.34654703693574, 5],
                    [-72.01950073242188, 41.34767464799149, 6],
                    [-72.0177412033081, 41.34743301869497, 7],
                    [-72.0177412033081, 41.34743301869497, 8],
                    [-72.01117515563965, 41.34208472736567, 1],
                    [-72.00894355773924, 41.342116947303296, 2],
                    [-72.0104455947876, 41.34092479899412, 3],
                    [-72.0078706741333, 41.3403770478594, 4],
                    [-72.00928688049316, 41.33886265309968, 5],
                    [-72.00602531433105, 41.33889487463142, 6],
                    [-72.0075273513794, 41.33744488992133, 7],
                    [-72.00362205505371, 41.33770266734016, 8],
                    [-71.99997425079346, 41.3295821885645, 1],
                    [-71.99761390686035, 41.32880875683843, 2],
                    [-71.99958801269531, 41.327680819112864, 3],
                    [-71.99748516082764, 41.32706850188449, 4],
                    [-71.99967384338379, 41.32584385016455, 5],
                    [-71.99761390686035, 41.325134830753576, 6],
                    [-71.99975967407227, 41.32445803230074, 7],
                    [-71.99774265289305, 41.323491165174005, 8]
                ]
            }
        },
        network: {
            'type': 'Feature',
            'properties': {},
            'geometry': {
                'type': 'LineString',
                'coordinates': [[-71.99898719787598, 41.32365231069138], [-71.99847221374512, 41.32819645021033], [-71.99950218200684, 41.33167685338174], [-72.00169086456297, 41.33544708033362], [-72.00774192810059, 41.33905598205104], [-72.00937271118164, 41.340957019505645], [-72.01070308685303, 41.34301909908479]]
            }
        }
    })];

    const newSegs = Cluster.break(segs);

    t.equals(newSegs.length, 3);

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/cluster-cliff2.json', JSON.stringify(newSegs, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(newSegs, require('./fixtures/cluster-cliff2.json'));

    t.end();
});

/**
 * 1  3  5  7        7  5  3  1
 * -----------------------------
 *    2  4  6  8  8  6  4  2
 *
 *               ^ split
 */
test('cluster#break - address hump', (t) => {
    const segs = [sort({
        address: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [-72.01117515563965, 41.34208472736567, 1],
                    [-72.00894355773924, 41.342116947303296, 2],
                    [-72.0104455947876, 41.34092479899412, 3],
                    [-72.0078706741333, 41.3403770478594, 4],
                    [-72.00928688049316, 41.33886265309968, 5],
                    [-72.00602531433105, 41.33889487463142, 6],
                    [-72.0075273513794, 41.33744488992133, 7],
                    [-72.00362205505371, 41.33770266734016, 8],
                    [-71.99997425079346, 41.3295821885645, 8],
                    [-71.99761390686035, 41.32880875683843, 7],
                    [-71.99958801269531, 41.327680819112864, 6],
                    [-71.99748516082764, 41.32706850188449, 5],
                    [-71.99967384338379, 41.32584385016455, 4],
                    [-71.99761390686035, 41.325134830753576, 3],
                    [-71.99975967407227, 41.32445803230074, 2],
                    [-71.99774265289305, 41.323491165174005, 1]
                ]
            }
        },
        network: {
            'type': 'Feature',
            'properties': {},
            'geometry': {
                'type': 'LineString',
                'coordinates': [[-71.99898719787598, 41.32365231069138], [-71.99847221374512, 41.32819645021033], [-71.99950218200684, 41.33167685338174], [-72.00169086456297, 41.33544708033362], [-72.00774192810059, 41.33905598205104], [-72.00937271118164, 41.340957019505645], [-72.01070308685303, 41.34301909908479]]
            }
        }
    })];

    const newSegs = Cluster.break(segs);

    t.equals(newSegs.length, 2);

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/cluster-hump.json', JSON.stringify(newSegs, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(newSegs, require('./fixtures/cluster-hump.json'));

    t.end();
});

/**
 * 1  3  5     5  3  1       3  5        5 3 1
 * -----------------------------------------------
 *    2  4       4  2      2  4  6      6 8 4 2
 *
 *          ^ split    ^ split      ^ split
 */
test('cluster#break - address mixed cliffs and peaks', (t) => {
    const segs = [sort({
        address: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [-72.02332019805908, 41.34632151238116, 1],
                    [-72.02267646789551, 41.34743301869497, 2],
                    [-72.02207565307617, 41.34649871031123, 3],
                    [-72.02113151550293, 41.34756188776471, 4],
                    [-72.02113151550293, 41.34856188776471, 5],
                    [-72.0208740234375, 41.34664703693574, 5],
                    [-72.0208740234375, 41.34654703693574, 4],
                    [-72.01950073242188, 41.34767464799149, 3],
                    [-72.0177412033081, 41.34743301869497, 2],
                    [-72.0177412033081, 41.34743301869497, 1],
                    [-72.01117515563965, 41.34208472736567, 2],
                    [-72.00894355773924, 41.342116947303296, 3],
                    [-72.0104455947876, 41.34092479899412, 4],
                    [-72.0078706741333, 41.3403770478594, 5],
                    [-72.00928688049316, 41.33886265309968, 6],
                    [-72.00602531433105, 41.33889487463142, 6],
                    [-72.0075273513794, 41.33744488992133, 5],
                    [-72.00362205505371, 41.33770266734016, 4],
                    [-71.99997425079346, 41.3295821885645, 3],
                    [-71.99761390686035, 41.32880875683843, 2],
                    [-71.99958801269531, 41.327680819112864, 1]
                ]
            }
        },
        network: {
            'type': 'Feature',
            'properties': {},
            'geometry': {
                'type': 'LineString',
                'coordinates': [[-71.99898719787598, 41.32365231069138], [-71.99847221374512, 41.32819645021033], [-71.99950218200684, 41.33167685338174], [-72.00169086456297, 41.33544708033362], [-72.00774192810059, 41.33905598205104], [-72.00937271118164, 41.340957019505645], [-72.01070308685303, 41.34301909908479]]
            }
        }
    })];

    const newSegs = Cluster.break(segs);

    /**
     * TODO: This should return 4 segments instead of 2
     */
    t.equals(newSegs.length, 2);

    /**
     * TODO: This should be the geometry for 4 segments, and we currently have just 2. Update the test fixture too
     */
    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/cluster-mixed.json', JSON.stringify(newSegs, null, 4));
        t.fail('had to update fixture');
    }

    t.deepEquals(newSegs, require('./fixtures/cluster-mixed.json'));

    t.end();
});

test('split#splitCluster - ', (t) => {
    const cluster = {
        network: {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [
                    [0, 0],
                    [0.01, 0]
                ]
            }
        },
        addressPoints: [
            { coords: [0, 0], location: 0 },
            { coords: [0.0009999999999999994, 1.6532731720501135e-18], location: 0.1111950802335329 },
            { coords: [0.0020000000000000018, 1.4695761542018e-18], location: 0.2223901604670658 },
            { coords: [0.0030000000000000014, 1.285879135905828e-18], location: 0.3335852407005987 },
            { coords: [0.004000000000000001, 1.1021821172181545e-18], location: 0.4447803209341316 },
            { coords: [0.005000000000000002, 9.184850981947377e-19], location: 0.5559754011676645 },
            { coords: [0.006000000000000001, 7.347880788915339e-19], location: 0.6671704814011974 },
            { coords: [0.007, 5.510910593645012e-19], location: 0.7783655616347303 },
            { coords: [0.008, 3.673940396695964e-19], location: 0.8895606418682631 },
            { coords: [0.009, 1.8369701986277705e-19], location: 1.000755722101796 }
        ],
        intersectionPoints: [
            { coords: [0.0008993203637245394, 1.6717677209649935e-18], location: 0.1 },
            { coords: [0.005899320363724538, 7.532826279909296e-19], location: 0.6559754011676645 }
        ]
    };

    const breaks = [5];

    const res = Split.splitCluster(cluster, breaks);

    t.deepEqual(res, [
        {
            network: {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [0, 0],
                        [0.005499999999999999, 8.266365885746118e-19]
                    ]
                }
            },
            addressPoints: [
                {
                    coords: [0, 0],
                    location: 0
                },
                {
                    coords: [0.0009999999999999994, 1.6532731720501135e-18],
                    location: 0.1111950802335329
                },
                {
                    coords: [0.0020000000000000018, 1.4695761542018e-18],
                    location: 0.2223901604670658
                },
                {
                    coords: [0.0030000000000000014, 1.285879135905828e-18],
                    location: 0.3335852407005987
                },
                {
                    coords: [0.004000000000000001, 1.1021821172181545e-18],
                    location: 0.4447803209341316
                },
                {
                    coords: [0.005000000000000002, 9.184850981947377e-19],
                    location: 0.5559754011676645
                }
            ],
            intersectionPoints: []
        },
        {
            network: {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [0.005499999999999999, 8.266365885746118e-19],
                        [0.01, 0]
                    ]
                }
            },
            addressPoints: [
                { coords: [0.006000000000000001, 7.347880788915339e-19], location: 0.6671704814011974 },
                { coords: [0.007, 5.510910593645012e-19], location: 0.7783655616347303 },
                { coords: [0.008, 3.673940396695964e-19], location: 0.8895606418682631 },
                { coords: [0.009, 1.8369701986277705e-19], location: 1.000755722101796 }
            ],
            intersectionPoints: [
                { coords: [0.0008993203637245394, 1.6717677209649935e-18], location: 0.1 }
            ]
        }
    ]);

    t.end();
});

test('split#splitCluster - ', (t) => {
    const cluster = require('./fixtures/cluster-mult-cliffs-peaks.json')[0];

    const breaks = [187, 208];

    const res = Split.splitCluster(cluster, breaks);

    // TODO: write assertions
    t.ok(res);

    t.end();
});

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
test.skip('cluster#break - address cliff', (t) => {
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
test.skip('cluster#break - address cliff (double)', (t) => {
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
test.skip('cluster#break - address hump', (t) => {
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
test.skip('cluster#break - address mixed cliffs and peaks', (t) => {
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

test('split#splitCluster - handle single break', (t) => {
    const cluster = {
        network: { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [0.01, 0]] } },
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
            network: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[0, 0], [0.005499999999999999, 8.266365885746118e-19]] } },
            addressPoints:[
                { coords: [0, 0], location: 0 },
                { coords: [0.0009999999999999994, 1.6532731720501135e-18], location: 0.11119508023353286 },
                { coords: [0.0020000000000000018, 1.4695761542018e-18], location: 0.22239016046706608 },
                { coords: [0.0030000000000000014, 1.285879135905828e-18], location: 0.3335852407005988 },
                { coords: [0.004000000000000001, 1.1021821172181545e-18], location: 0.44478032093413183 },
                { coords: [0.005000000000000002, 9.184850981947377e-19], location: 0.5559754011676646 }
            ],
            intersectionPoints: [
                { coords: [0.0008993203637245394, 1.6717677209649935e-18], location: 0.1000000000000002 }
            ],
            noDropLow: true
        },
        {
            network: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[0.005499999999999999, 8.266365885746118e-19], [0.01, 0]] } },
            addressPoints: [
                { coords: [0.006000000000000001, 7.347880788915339e-19], location: 0.05559754011676689 },
                { coords: [0.007, 5.510910593645012e-19], location: 0.16679262035029954 },
                { coords: [0.008, 3.673940396695964e-19], location: 0.27798770058383243 },
                { coords: [0.009, 1.8369701986277705e-19], location: 0.38918278081736507 }
            ],
            intersectionPoints: [
                { coords: [0.005899320363724538, 7.532826279909296e-19], location: 0.044402459883233665 }
            ],
            noRaiseHigh: true
        }
    ]);

    t.end();
});

test('split#splitCluster - handle several breaks', (t) => {
    const cluster = {
        network: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-76.97148084640502, 38.91855973980027], [-76.9751501083374, 38.91406031605573], [-76.97629809379578, 38.91257435835576], [-76.97888374328613, 38.90709775126436]] } },
        addressPoints: [
            { coords: [-76.97188630737034, 38.918062544252905], location: 0.06547512498419607 },
            { coords: [-76.97210715896533, 38.917791725508216], location: 0.10113899766507231 },
            { coords: [-76.97261513527994, 38.91716882075688], location: 0.18316890265659336 },
            { coords: [-76.97297647061424, 38.916725734159925], location: 0.24151880242634347 }, // break
            { coords: [-76.97337020048528, 38.91624292383912], location: 0.3051000228278954 },
            { coords: [-76.97350161985626, 38.91608177114706], location: 0.3263222248696008 },
            { coords: [-76.97353263204452, 38.916043742524735], location: 0.3313302171105054 },
            { coords: [-76.9737291484228, 38.91580276478182], location: 0.36306461278023977 }, // break
            { coords: [-76.97410747800113, 38.915338839033446], location: 0.42415915233914386 },
            { coords: [-76.97445093727842, 38.91491767290903], location: 0.47962276175102797 },
            { coords: [-76.97479508440294, 38.91449566331358], location: 0.5351975431081595 },
            { coords: [-76.9749129759455, 38.91435109908904], location: 0.5542353433439375 },// break
            { coords: [-76.9757962095161, 38.91322399969436], location: 0.7010315521132566 },
            { coords: [-76.9760318505634, 38.91291898483019], location: 0.7406038989083917 },
            { coords: [-76.97610080020486, 38.9128297360946], location: 0.752182955979031 },
            { coords: [-76.97639189668726, 38.9123756765226], location: 0.8088515117979663 },
            { coords: [-76.97650868303177, 38.912128313945054], location: 0.8381543278579668 },
            { coords: [-76.97665112501622, 38.91182661072308], location: 0.8738944069440194 }, // break
            { coords: [-76.97784225910246, 38.909303695916634], location: 1.17276223958646 },
            { coords: [-76.97793936405873, 38.90909802005294], location: 1.1971269307537726 },
            { coords: [-76.97859244995102, 38.90771473324535], location: 1.360993512437945 },
            { coords: [-76.97866723257236, 38.907556337826406], location: 1.379757335841025 }],
        intersectionPoints: [
            { coords: [-76.9715153857474, 38.91851738601357], location: 0.005577517621843793 },
            { coords: [-76.97255749135148, 38.91723950648746], location: 0.17386033625482736 },
            { coords: [-76.97375352394224, 38.91577287435891], location: 0.3670008892826636 },
            { coords: [-76.9751158612859, 38.91410231142144], location: 0.5869984539925859 },
            { coords: [-76.97626160524162, 38.91262158930945], location: 0.779187762586463 },
            { coords: [-76.9787983344457, 38.90727865384336], location: 1.4126523220559197 }
        ]
    };

    const breaks = [3, 7, 11, 17];

    const res = Split.splitCluster(cluster, breaks);

    t.deepEqual(res, [
        {
            network: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-76.97148084640502, 38.91855973980027], [-76.97317338516022, 38.91648435332585]] } },
            addressPoints: [
                { coords: [-76.97188630737034, 38.918062544252905], location: 0.06547809949620209 },
                { coords: [-76.97210715896533, 38.917791725508216], location: 0.10114103887872508 },
                { coords: [-76.97261513527994, 38.91716882075688], location: 0.18317121290357466 },
                { coords: [-76.97297647061424, 38.916725734159925], location: 0.24152281898203426 }
            ],
            intersectionPoints: [
                { coords: [-76.9715153857474, 38.91851738601357], location: 0.005582453823957793 },
                { coords: [-76.97255749135148, 38.91723950648746], location: 0.17386241765753008 }
            ],
            noDropLow: true
        },
        {
            network: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-76.97317338516022, 38.91648435332585], [-76.97391835773507, 38.91557082373519]] } },
            addressPoints: [
                { coords: [-76.97337020048528, 38.91624292383912], location: 0.03179114960896266 },
                { coords: [-76.97350161985626, 38.91608177114706], location: 0.0530131239687422 },
                { coords: [-76.97353263204452, 38.916043742524735], location: 0.058021071526279756 },
                { coords: [-76.9737291484228, 38.91580276478182], location: 0.08975575480650454 }
            ],
            intersectionPoints: [
                { coords: [-76.97375352394224, 38.91577287435891], location: 0.09369208102926103 }
            ]
        },
        {
            network: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-76.97391835773507, 38.91557082373519], [-76.9751501083374, 38.91406031605573], [-76.97535914897023, 38.913789738362084]] } },
            addressPoints: [
                { coords: [-76.97410747800113, 38.915338839033446], location: 0.030549221712556602 },
                { coords: [-76.97445093727842, 38.91491767290903], location: 0.08601175691887428 },
                { coords: [-76.97479508440294, 38.91449566331358], location: 0.1415870408184778 },
                { coords: [-76.9749129759455, 38.91435109908904], location: 0.16062523719440455 }
            ],
            intersectionPoints: [
                { coords: [-76.9751158612859, 38.91410231142144], location: 0.19338914642567617 }
            ]
        },
        {
            network: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-76.97535914897023, 38.913789738362084], [-76.97629809379578, 38.91257435835576], [-76.977246736272, 38.91056516444582]] } },
            addressPoints: [
                { coords: [-76.9757962095161, 38.91322399969436], location: 0.07339859250731313 },
                { coords: [-76.9760318505634, 38.91291898483019], location: 0.11297132811002628 },
                { coords: [-76.97610080020486, 38.9128297360946], location: 0.12455057415435643 },
                { coords: [-76.97639189668726, 38.9123756765226], location: 0.1812211249012625 },
                { coords: [-76.97650868303177, 38.912128313945054], location: 0.21052316169480742 },
                { coords: [-76.97665112501622, 38.91182661072308], location: 0.24626244501986694 }
            ],
            intersectionPoints: [
                { coords: [-76.97626160524162, 38.91262158930945],
                    location: 0.1515558930790326 }
            ]
        },
        {
            network: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-76.977246736272, 38.91056516444582], [-76.97888374328613, 38.90709775126436]] } },
            addressPoints: [
                { coords: [-76.97784225910246, 38.909303695916634], location: 0.14943845965409105 },
                { coords: [-76.97793936405873, 38.90909802005294], location: 0.17380234307165066 },
                { coords: [-76.97859244995102, 38.90771473324535], location: 0.337672774578032 },
                { coords: [-76.97866723257236, 38.907556337826406], location: 0.35643746439173374 }
            ],
            intersectionPoints: [
                { coords: [-76.9787983344457, 38.90727865384336], location: 0.38933408254554336 }
            ],
            noRaiseHigh: true
        }
    ]);

    t.end();
});

test('split#splitCluster - handle breaks over zero length segments at the beginning of a cluster', (t) => {
    const cluster = {
        network: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-72.01738715171814, 41.34679672392427], [-72.01857805252075, 41.34723971461209], [-72.01957583427429, 41.34738469272805], [-72.02129244804382, 41.34719138850171], [-72.0245110988617, 41.346732288664064]] } },
        addressPoints: [
            { coords: [-72.01738715171814, 41.34679672392427], location: 0 }, // break
            { coords: [-72.01738715171814, 41.34679672392427], location: 0 },
            { coords: [-72.01738715171814, 41.34679672392427], location: 0 },
            { coords: [-72.01738715171814, 41.34679672392427], location: 0 }, // break
            { coords: [-72.01800860032061, 41.34702789006611], location: 0.057895561709495974 },
            { coords: [-72.01800860032061, 41.34702789006611], location: 0.057895561709495974 },
            { coords: [-72.01957550055494, 41.34738464423848], location: 0.19575531560060722 },
            { coords: [-72.02086726582885, 41.347239267366824], location: 0.3047935966401688 },
            { coords: [-72.02098959915647, 41.34722549167093], location: 0.3151197811713521 }, // break
            { coords: [-72.02100913910834, 41.3472232913185], location: 0.3167691532352579 },
            { coords: [-72.02106266533598, 41.34721726384383], location: 0.32128731533415344 },
            { coords: [-72.02221756350927, 41.347059432479135], location: 0.4192902898769348 },
            { coords: [-72.02256924083476, 41.3470092701558], location: 0.4491723121311413 },
            { coords: [-72.02346202860434, 41.34688192527023], location: 0.5250325884806537 }],
        intersectionPoints: [
            { coords: [-72.0184081736443, 41.34717652315218], location: 0.09512063190222796 },
            { coords: [-72.02132477806703, 41.34718677703273], location: 0.34343041088499504 },
            { coords: [-72.0241499324312, 41.34678380448823], location: 0.5834839510397574 }
        ]
    };

    const breaks = [0, 3, 8];

    const res = Split.splitCluster(cluster, breaks);

    t.deepEqual(res, [
        {
            network: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-72.01738715171814, 41.34679672392427], [-72.01769787486272, 41.34691230832979]] } },
            addressPoints: [
                { coords: [-72.01738715171814, 41.34679672392427], location: 0 },
                { coords: [-72.01738715171814, 41.34679672392427], location: 0 },
                { coords: [-72.01738715171814, 41.34679672392427], location: 0 },
                { coords: [-72.01738715171814, 41.34679672392427], location: 0 }
            ],
            intersectionPoints: [],
            noDropLow: true
        },
        {
            network: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-72.01769787486272, 41.34691230832979], [-72.01857805252075, 41.34723971461209], [-72.01957583427429, 41.34738469272805], [-72.02099936950121, 41.34722439334008]] } },
            addressPoints: [
                { coords: [-72.01800860032061, 41.34702789006611], location: 0.02894762527060518 },
                { coords: [-72.01800860032061, 41.34702789006611], location: 0.02894762527060518 },
                { coords: [-72.01957550055494, 41.34738464423848], location: 0.16680734936932612 },
                { coords: [-72.02086726582885, 41.347239267366824], location: 0.2758460565643445 },
                { coords: [-72.02098959915647, 41.34722549167093], location: 0.28617228887213597 }
            ],
            intersectionPoints: [
                { coords: [-72.0184081736443, 41.34717652315218],
                    location: 0.06617260898312122 }] },
        {
            network: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-72.02099936950121, 41.34722439334008], [-72.02129244804382, 41.34719138850171], [-72.0245110988617, 41.346732288664064]] } },
            addressPoints: [
                { coords: [-72.02100913910834, 41.3472232913185], location: 0.0008246976232789808 },
                { coords: [-72.02106266533598, 41.34721726384383], location: 0.005342855755184699 },
                { coords: [-72.02221756350927, 41.347059432479135], location: 0.10334678469995551 },
                { coords: [-72.02256924083476, 41.3470092701558], location: 0.13322853455088965 },
                { coords: [-72.02346202860434, 41.34688192527023], location: 0.2090889821201192 }],
            intersectionPoints: [
                { coords: [-72.02132477806703, 41.34718677703273], location: 0.027487800443129443 },
                { coords: [-72.0241499324312, 41.34678380448823], location: 0.2675409771077639 }
            ],
            noRaiseHigh: true
        }
    ]);

    t.end();
});


test('split#splitCluster - handle breaks over zero length segments at the end of a cluster', (t) => {
    const cluster = {
        network: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-72.00832913680851, 41.33974051878503], [-72.00937271118164, 41.340957019505645], [-72.01070308685303, 41.34301909908479]] } },
        addressPoints: [
            { coords: [-72.0078706741333, 41.3403770478594], location: 0.03877871959783233 },
            { coords: [-72.0104455947876, 41.34092479899412], location: 0.1967143578104889 },
            { coords: [-72.00894355773924, 41.342116947303296], location: 0.26135634936089525 },
            { coords: [-72.01117515563965, 41.34208472736567], location: 0.3393438074323155 },// break
            { coords: [-72.0177412033081, 41.34743301869497], location: 0.4156731618972499 },
            { coords: [-72.0177412033081, 41.34743301869497], location: 0.4156731618972499 },
            { coords: [-72.01950073242188, 41.34767464799149], location: 0.4156731618972499 }, // break
            { coords: [-72.0208740234375, 41.34654703693574], location: 0.4156731618972499 },
            { coords: [-72.0208740234375, 41.34664703693574], location: 0.4156731618972499 },
            { coords: [-72.02113151550293, 41.34756188776471], location: 0.4156731618972499 },
            { coords: [-72.02207565307617, 41.34649871031123], location: 0.4156731618972499 }, // break
            { coords: [-72.02113151550293, 41.34856188776471], location: 0.4156731618972499 },
            { coords: [-72.02267646789551, 41.34743301869497], location: 0.4156731618972499 },
            { coords: [-72.02332019805908, 41.34632151238116], location: 0.4156731618972499 }
        ],
        intersectionPoints: [
            { coords: [-72.00832913680851, 41.33974051878503], location: 0 },
            { coords: [-72.00876921415329, 41.340260247389146], location: 0.06847931087196438 },
            { coords: [-72.01014518737793, 41.342116947303296], location: 0.30508687658883704 }
        ]
    };

    const breaks = [3, 6, 9];

    const res = Split.splitCluster(cluster, breaks);

    t.deepEqual(res, [
        {
            network: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-72.00832913680851, 41.33974051878503], [-72.00937271118164, 41.340957019505645], [-72.01050379475316, 41.34271020602774]] } },
            addressPoints: [
                { coords: [-72.0078706741333, 41.3403770478594], location: 0.03877871959783233 },
                { coords: [-72.0104455947876, 41.34092479899412], location: 0.19671548598738484 },
                { coords: [-72.00894355773924, 41.342116947303296], location: 0.26135711270069173 },
                { coords: [-72.01117515563965, 41.34208472736567], location: 0.3393438074271699 }
            ],
            intersectionPoints: [
                { coords: [-72.00832913680851, 41.33974051878503], location: 0 },
                { coords: [-72.00876921415329, 41.340260247389146], location: 0.06847931087196438 },
                { coords: [-72.01014518737793, 41.342116947303296], location: 0.30508687658539646 }
            ],
            noDropLow: true
        },
        {
            network: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-72.01050379475316, 41.34271020602774], [-72.01070308685303, 41.34301909908479]] } },
            addressPoints: [
                { coords: [-72.0177412033081, 41.34743301869497], location: 0.03816467723153009 },
                { coords: [-72.0177412033081, 41.34743301869497], location: 0.03816467723153009 },
                { coords: [-72.01950073242188, 41.34767464799149], location: 0.03816467723153009 },
                { coords: [-72.0208740234375, 41.34654703693574], location: 0.03816467723153009 },
                { coords: [-72.0208740234375, 41.34664703693574], location: 0.03816467723153009 },
                { coords: [-72.02113151550293, 41.34756188776471], location: 0.03816467723153009 },
                { coords: [-72.02207565307617, 41.34649871031123], location: 0.03816467723153009 },
                { coords: [-72.02113151550293, 41.34856188776471], location: 0.03816467723153009 },
                { coords: [-72.02267646789551, 41.34743301869497], location: 0.03816467723153009 },
                { coords: [-72.02332019805908, 41.34632151238116], location: 0.03816467723153009 }
            ],
            intersectionPoints: [],
            noRaiseHigh: true
        }
    ]
    );

    t.end();
});

test('split#splitCluster - handle multiple breaks on a large cluster', (t) => {
    const cluster = require('./fixtures/cluster-mult-cliffs-peaks.json')[0];

    const breaks = [57, 89, 158];

    const totalAddresses = cluster.addressPoints.length;
    const totalIntersections = cluster.intersectionPoints.length;

    const res = Split.splitCluster(cluster, breaks);

    const intersectionCount = res.reduce((p, c) => p + c.intersectionPoints.length, 0);
    const addressCount = res.reduce((p, c) => p + c.addressPoints.length, 0);

    t.equal(res[0].addressPoints.length, 58);
    t.equal(res[1].addressPoints.length, 32);
    t.equal(res[2].addressPoints.length, 69);
    t.equal(res[3].addressPoints.length, 61);

    t.equal(res.length, 4);
    t.equal(totalAddresses, addressCount);
    t.equal(totalIntersections, intersectionCount);

    t.end();
});


test('split#splitCluster - return an array of the input cluster for no breaks', (t) => {
    const cluster = require('./fixtures/cluster-mult-cliffs-peaks.json')[0];

    const breaks = [];

    const res = Split.splitCluster(cluster, breaks);

    t.equal(res.length, 1);
    t.deepEqual(res[0], cluster);

    t.end();
});

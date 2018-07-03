const Cluster = require('../lib/util/cluster');
const test = require('tape');
const fs = require('fs');
const _ = require('lodash');

const cluster = new Cluster();

/**
 * Helper function to sort segs for input into cluster#break
 *
 * Since misc.hasDupAddressWithin expects an ordered set, this is required
 */
function sort(seg) {
    seg.number = [];

    seg.address.geometry.coordinates = _.sortBy(seg.address.geometry.coordinates, [(coord) => {
        return coord[2];
    }]).map((coord) => {
        seg.number.push(coord.pop());

        return coord;
    });

    return seg;
}

/**
 * 1  3  5  7        7  5  3  1
 * -----------------------------
 *    2  4  6  8  8  6  4  2
 *
 *               ^ split
 */
test.skip('cluster#break - address hump', (t) => {
    let segs = [sort({
        address: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [ -72.01117515563965, 41.34208472736567, 1 ],
                    [ -72.00894355773924, 41.342116947303296, 2 ],
                    [ -72.0104455947876, 41.34092479899412, 3 ],
                    [ -72.0078706741333, 41.3403770478594, 4 ],
                    [ -72.00928688049316, 41.33886265309968, 5 ],
                    [ -72.00602531433105, 41.33889487463142, 6 ],
                    [ -72.0075273513794, 41.33744488992133, 7 ],
                    [ -72.00362205505371, 41.33770266734016, 8 ],
                    [ -71.99997425079346, 41.3295821885645, 8 ],
                    [ -71.99761390686035, 41.32880875683843, 7 ],
                    [ -71.99958801269531, 41.327680819112864, 6 ],
                    [ -71.99748516082764, 41.32706850188449, 5 ],
                    [ -71.99967384338379, 41.32584385016455, 4 ],
                    [ -71.99761390686035, 41.325134830753576, 3 ],
                    [ -71.99975967407227, 41.32445803230074, 2 ],
                    [ -71.99774265289305, 41.323491165174005, 1 ],
                ]
            }
        },
        network: {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "LineString",
                "coordinates": [ [ -71.99898719787598, 41.32365231069138 ], [ -71.99847221374512, 41.32819645021033 ], [ -71.99950218200684, 41.33167685338174 ], [ -72.00169086456297, 41.33544708033362 ], [ -72.00774192810059, 41.33905598205104 ], [ -72.00937271118164, 41.340957019505645 ], [ -72.01070308685303, 41.34301909908479 ] ]
            }
        }
    })];

    let newSegs = cluster.break(segs);

    t.equals(newSegs.length, 2);

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/cluster-hump.json', JSON.stringify(newSegs, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(newSegs, require('./fixtures/cluster-hump.json'));

    t.end();
});

/**
 * 1  3  5  7     1  3  5  7
 * -----------------------------
 *    2  4  6  8     2  4  6  8
 *
 *               ^ split
 */
test('cluster#break - address cliff', (t) => {
    let segs = [sort({
        address: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [ -72.01117515563965, 41.34208472736567, 1 ],
                    [ -72.00894355773924, 41.342116947303296, 2 ],
                    [ -72.0104455947876, 41.34092479899412, 3 ],
                    [ -72.0078706741333, 41.3403770478594, 4 ],
                    [ -72.00928688049316, 41.33886265309968, 5 ],
                    [ -72.00602531433105, 41.33889487463142, 6 ],
                    [ -72.0075273513794, 41.33744488992133, 7 ],
                    [ -72.00362205505371, 41.33770266734016, 8 ],
                    [ -71.99997425079346, 41.3295821885645, 1 ],
                    [ -71.99761390686035, 41.32880875683843, 2 ],
                    [ -71.99958801269531, 41.327680819112864, 3 ],
                    [ -71.99748516082764, 41.32706850188449, 3 ],
                    [ -71.99967384338379, 41.32584385016455, 5 ],
                    [ -71.99761390686035, 41.325134830753576, 6 ],
                    [ -71.99975967407227, 41.32445803230074, 7 ],
                    [ -71.99774265289305, 41.323491165174005, 8 ],
                ]
            }
        },
        network: {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "LineString",
                "coordinates": [ [ -71.99898719787598, 41.32365231069138 ], [ -71.99847221374512, 41.32819645021033 ], [ -71.99950218200684, 41.33167685338174 ], [ -72.00169086456297, 41.33544708033362 ], [ -72.00774192810059, 41.33905598205104 ], [ -72.00937271118164, 41.340957019505645 ], [ -72.01070308685303, 41.34301909908479 ] ]
            }
        }
    })];

    let newSegs = cluster.break(segs);

    t.equals(newSegs.length, 2);

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/cluster-cliff.json', JSON.stringify(newSegs, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(newSegs, require('./fixtures/cluster-cliff.json'));

    t.end();
});

const Cluster = require('../lib/cluster');
const test = require('tape');
const fs = require('fs');

const cluster = new Cluster();

test('cluster#break - simple', (t) => {
    let segs = [{
        address: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [ -72.01117515563965, 41.34208472736567 ],
                    [ -72.00894355773924, 41.342116947303296 ],
                    [ -72.0104455947876, 41.34092479899412 ],
                    [ -72.0078706741333, 41.3403770478594 ],
                    [ -72.00928688049316, 41.33886265309968 ],
                    [ -72.00602531433105, 41.33889487463142 ],
                    [ -72.0075273513794, 41.33744488992133 ],
                    [ -72.00362205505371, 41.33770266734016 ],

                    [ -71.99997425079346, 41.3295821885645 ],
                    [ -71.99761390686035, 41.32880875683843 ],
                    [ -71.99958801269531, 41.327680819112864 ],
                    [ -71.99748516082764, 41.32706850188449 ],
                    [ -71.99967384338379, 41.32584385016455 ],
                    [ -71.99761390686035, 41.325134830753576 ],
                    [ -71.99975967407227, 41.32445803230074 ],
                    [ -71.99774265289305, 41.323491165174005 ]
                ]
            }
        },
        number: [{
            num: "1",
            output: true
        },{
            num: "2",
            output: true
        },{
            num: "3",
            output: true
        },{
            num: "4",
            output: true
        },{
            num: "5",
            output: true
        },{
            num: "6",
            output: true
        },{
            num: "7",
            output: true
        },{
            num: "8",
            output: true
        },{
            num: "8",
            output: true
        },{
            num: "7",
            output: true
        },{
            num: "6",
            output: true
        },{
            num: "5",
            output: true
        },{
            num: "4",
            output: true
        },{
            num: "3",
            output: true
        },{
            num: "2",
            output: true
        },{
            num: "1",
            output: true
        }],
        network: {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "LineString",
                "coordinates": [ [ -71.99898719787598, 41.32365231069138 ], [ -71.99847221374512, 41.32819645021033 ], [ -71.99950218200684, 41.33167685338174 ], [ -72.00169086456297, 41.33544708033362 ], [ -72.00774192810059, 41.33905598205104 ], [ -72.00937271118164, 41.340957019505645 ], [ -72.01070308685303, 41.34301909908479 ] ]
            }
        }
    }];

    let newSegs = cluster.break(segs);

    t.equals(newSegs.length, 2);

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/cluster-break.json', JSON.stringify(newSegs, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(newSegs, require('./fixtures/cluster-break.json'));

    t.end();
});

test('cluster#break - orphan', (t) => {
    let segs = [{
        address: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [ -72.01117515563965, 41.34208472736567 ],
                    [ -72.00894355773924, 41.342116947303296 ],
                    [ -72.0104455947876, 41.34092479899412 ],
                    [ -72.0078706741333, 41.3403770478594 ],
                    [ -72.00928688049316, 41.33886265309968 ],
                    [ -72.00602531433105, 41.33889487463142 ],
                    [ -72.0075273513794, 41.33744488992133 ],
                    [ -72.00362205505371, 41.33770266734016 ],

                    [ -71.99997425079346, 41.3295821885645 ],
                    [ -71.99761390686035, 41.32880875683843 ],
                    [ -71.99958801269531, 41.327680819112864 ],
                    [ -71.99748516082764, 41.32706850188449 ],
                    [ -71.99967384338379, 41.32584385016455 ],
                    [ -71.99761390686035, 41.325134830753576 ],
                    [ -71.99975967407227, 41.32445803230074 ],
                    [ -71.99774265289305, 41.323491165174005 ]
                ]
            }
        },
        number: [{
            num: "1",
            output: true
        },{
            num: "2",
            output: true
        },{
            num: "3",
            output: true
        },{
            num: "4",
            output: true
        },{
            num: "5",
            output: true
        },{
            num: "6",
            output: true
        },{
            num: "7",
            output: true
        },{
            num: "8",
            output: true
        },{
            num: "8",
            output: true
        },{
            num: "7",
            output: true
        },{
            num: "6",
            output: true
        },{
            num: "5",
            output: true
        },{
            num: "4",
            output: true
        },{
            num: "3",
            output: true
        },{
            num: "2",
            output: true
        },{
            num: "1",
            output: true
        }],
        network: {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "LineString",
                "coordinates": [ [ -71.99898719787598, 41.32365231069138 ], [ -71.99847221374512, 41.32819645021033 ], [ -71.99950218200684, 41.33167685338174 ], [ -72.00169086456297, 41.33544708033362 ], [ -72.00774192810059, 41.33905598205104 ], [ -72.00937271118164, 41.340957019505645 ], [ -72.01070308685303, 41.34301909908479 ] ]
            }
        }
    }, {
        network: {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "LineString",
                "coordinates": [[ -71.99861168861389, 41.321855515623234 ], [ -71.99479222297668, 41.32324138883455 ]]
            }
        }
    }];

    let newSegs = cluster.break(segs);

    t.equals(newSegs.length, 2);

    if (process.env.UPDATE) {
        fs.writeFileSync(__dirname + '/fixtures/cluster-break-orphan.json', JSON.stringify(newSegs, null, 4));
        t.fail('had to update fixture');
    }
    t.deepEquals(newSegs, require('./fixtures/cluster-break-orphan.json'));

    t.end();
});

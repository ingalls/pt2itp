'use strict';

const test = require('tape');
const { Split, SplitFeat } = require('../lib/map/split');

test('Split: Simple Intersection', (t) => {
    const feat = new SplitFeat(
        1,
        [{
            freq: 1,
            priority: 0,
            display: 'Riverton Road South',
            tokenized: [{ token: 'riverton', token_type: null }, { token: 'rd', token_type: 'Way' }, { token: 's', token_type: 'Cardinal' }]
        }],
        {
            1: { 'id':1,'output':true,'number':2 },
            2: { 'id':2,'output':true,'number':10 },
            3: { 'id':3,'output':true,'number':20 }
        },
        { 'type': 'MultiLineString', 'coordinates': [[[-79.43969249725342, 38.74246924858317], [-79.43917751312256, 38.74222238816381], [-79.43901658058167, 38.742201467750064], [-79.43888247013092, 38.74234372644267], [-79.43876981735228, 38.74251108924762], [-79.43842113018036, 38.742753764618044], [-79.4379597902298, 38.742791421067146], [-79.43735361099243, 38.74278723701823], [-79.43683326244354, 38.74285836581647], [-79.43651139736176, 38.743004807236844], [-79.43585157394409, 38.74388344945229], [-79.43511664867401, 38.74597541121073], [-79.4350254535675, 38.74628501634416], [-79.43521320819855, 38.74643981840743]]] },
        { 'type':'MultiPoint','coordinates': [[-79.43893074989319, 38.74276213271957, 1], [-79.43694591522217, 38.74308011985037, 2], [-79.43537950515747, 38.74588336618241, 3]] },
        [{
            id: 1,
            a_id: 1,
            b_id: 2,
            a_street: [{
                freq: 1,
                priority: 0,
                display: 'Riverton Road South',
                tokenized: [{ token: 'riverton', token_type: null }, { token: 'rd', token_type: 'Way' }, { token: 's', token_type: 'Cardinal' }]
            }],
            b_street: [{
                freq: 1,
                priority: 0,
                display: 'Germany Valley Road',
                tokenized: [{ token: 'germany', token_type: null }, { token: 'vly', token_type: 'Way' }, { token: 'rd', token_type: 'Cardinal' }]
            }],
            geom: { 'type': 'Point', 'coordinates': [-79.43606615066528, 38.743573833905266] }
        },{
            id: 2,
            a_id: 3,
            b_id: 1,
            a_street: [{
                freq: 1,
                priority: 0,
                display: 'WV Route 33',
                tokenized: [{ token: 'wv', token_type: null }, { token: 'rte', token_type: 'Way' }, { token: '33', token_type: 'Cardinal' }]
            },{
                freq: 1,
                priority: 0,
                display: 'Mountaineer Drive',
                tokenized: [{ token: 'mountaineer', token_type: null }, { token: 'dr', token_type: 'Way' }]
            }],
            b_street: [{
                freq: 1,
                priority: 0,
                display: 'Riverton Road South',
                tokenized: [{ token: 'riverton', token_type: null }, { token: 'rd', token_type: 'Way' }, { token: 's', token_type: 'Cardinal' }]
            }],
            geom: { 'type': 'Point', 'coordinates': [-79.43968176841736, 38.74250272111668] }
        }]
    );

    const split = new Split({
        stdout: false,
        debug: true,
        country: 'us',
        intersections: true
    });

    split.split(feat, (err, res) => {
        t.error(err);

        t.equals(res.length, 1, 'has one result');

        res = res[0];

        t.deepEquals(res.properties, {
            'carmen:intersections': [null, null, [
                'WV Route 33',
                'Mountaineer Drive',
                'Germany Valley Road'
            ]],
            'carmen:addressnumber': [null, ['2', '10', '20'], null],
            'carmen:rangetype': 'tiger',
            'carmen:parityl': [['E', 'E', 'E', 'E'], null, null],
            'carmen:lfromhn': [[0, 2, 20, 20], null, null],
            'carmen:ltohn': [[2, 10, 20, 30], null, null],
            'carmen:parityr': [[null, null, null, null], null, null],
            'carmen:rfromhn': [[null, null, null, null], null, null],
            'carmen:rtohn': [[null, null, null, null], null, null],
            'carmen:text': 'Riverton Road South',
            'carmen:geocoder_stack': 'us',
            'carmen:center': [-79.43694591522217, 38.74308011985037]
        }, 'matches properties');

        t.deepEquals(res.geometry, {
            type: 'GeometryCollection',
            geometries: [{
                type:'MultiLineString',
                coordinates: [
                    [
                        [-79.43969249725342, 38.74246924858317],
                        [-79.43917751312256, 38.74222238816381],
                        [-79.43901658058167, 38.742201467750064],
                        [-79.43888247013092, 38.74234372644267],
                        [-79.43876981735228, 38.74251108924762],
                        [-79.43869951975134, 38.742560014180114]
                    ],
                    [
                        [-79.43969249725342, 38.74246924858317],
                        [-79.43917751312256, 38.74222238816381],
                        [-79.43901658058167, 38.742201467750064],
                        [-79.43888247013092, 38.74234372644267],
                        [-79.43876981735228, 38.74251108924762],
                        [-79.43842113018036, 38.742753764618044],
                        [-79.4379597902298, 38.742791421067146],
                        [-79.43735361099243, 38.74278723701823],
                        [-79.43683326244354, 38.74285836581647],
                        [-79.43651139736176, 38.743004807236844],
                        [-79.43607950574318, 38.743579930956514]
                    ],
                    [
                        [-79.43607950574318, 38.743579930956514],
                        [-79.43585157394409, 38.74388344945229],
                        [-79.43511664867401, 38.74597541121073],
                        [-79.4350254535675, 38.74628501634416],
                        [-79.43521320819855, 38.74643981840743]
                    ],
                    [
                        [-79.43607950574318, 38.743579930956514],
                        [-79.43585157394409, 38.74388344945229],
                        [-79.4351650925864, 38.745837515813385]
                    ]
                ]
            }, {
                type: 'MultiPoint',
                coordinates: [
                    [-79.43893074989319, 38.74276213271957],
                    [-79.43694591522217, 38.74308011985037],
                    [-79.43537950515747, 38.74588336618241]
                ]
            }, {
                type: 'MultiPoint',
                coordinates: [
                    [-79.43968176841736, 38.74250272111668],
                    [-79.43968176841736, 38.74250272111668],
                    [-79.43606615066528, 38.743573833905266]
                ]
            }]
        }, 'matches geometry');

        t.end();
    });
});

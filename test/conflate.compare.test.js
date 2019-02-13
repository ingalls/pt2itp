const fs = require('fs');
const test = require('tape');
const path = require('path');
const Compare = require('../lib/conflate/compare');

test('conflate/compare - compare', (t) => {
    const compare = new Compare({
        context: {
            country: 'us',
            region: 'dc'
        },
        pool: false,
        tokens: false
    });

    t.test('conflate/compare - compare - no rows', (q) => {
        let res = compare.compare({
            type: 'Feature',
            properties: {
                street: [{
                    display: 'Main Street North',
                    priority: 0
                }],
                number: 1,
                source: 'test'
            },
            geometry: {
                type: 'Point',
                coordinates: [0,0]
            }
        }, [ ]);

        q.deepEquals(res, {
            action: 'create',
            type: 'Feature',
            properties: {
                number: 1,
                source: 'test',
                street: [{
                    display: 'Main Street North',
                    priority: 0
                }]
            },
            geometry: {
                type: 'Point',
                coordinates: [0,0]
            }
        });

        q.end();
    });

    t.test('conflate/compare - compare - No Match', (q) => {
        let res = compare.compare({
            type: 'Feature',
            properties: {
                street: [{
                    display: 'Main Street North',
                    priority: 0
                }],
                number: 1,
                source: 'test'
            },
            geometry: {
                type: 'Point',
                coordinates: [0,0]
            }
        }, [{
            name: [{
                display: '2nd Street West',
                priority: 0
            }],
            feat: {
                id: 1,
                type: 'Feature',
                properties: {
                    street: [{
                        display: '2nd Street West',
                        priority: 0
                    }],
                    number: 1,
                    source: 'test'
                },
                geometry: {
                    type: 'Point',
                    coordinates: [0,0]
                }
            }
        }]);

        q.deepEquals(res, {
            action: 'create',
            type: 'Feature',
            properties: {
                number: 1,
                source: 'test',
                street: [{
                    display: 'Main Street North',
                    priority: 0
                }]
            },
            geometry: {
                type: 'Point',
                coordinates: [0,0]
            }
        });

        q.end();
    });

    t.test('conflate/compare - compare - Simple Match', (q) => {
        let res = compare.compare({
            type: 'Feature',
            properties: {
                street: [{
                    display: 'Main Street North',
                    priority: 0
                }],
                number: 1,
                source: 'test'
            },
            geometry: {
                type: 'Point',
                coordinates: [0,0]
            }
        }, [{
            name: [{
                display: 'Main Street North',
                tokenized: 'main street north',
                priority: 0
            }],
            feat: {
                id: 1,
                type: 'Feature',
                properties: {
                    number: 1,
                    source: 'test'
                },
                names: [{
                    display: 'Main Street North',
                    tokenized: 'main street north',
                    priority: 0
                }],
                geometry: {
                    type: 'Point',
                    coordinates: [0,0]
                }
            }
        }]);

        q.equals(res);
        q.end();
    });

    t.test('conflate/compare - compare - Simple Match - disqualified due to distance', (q) => {
        let res = compare.compare({
            type: 'Feature',
            properties: {
                street: [{
                    display: 'Main Street North',
                    priority: 0
                }],
                number: 1,
                source: 'test'
            },
            geometry: {
                type: 'Point',
                coordinates: [0,0]
            }
        }, [{
            name: [{
                display: 'Main Street North',
                tokenized: 'main street north',
                priority: 0
            }],
            feat: {
                id: 1,
                type: 'Feature',
                properties: {
                    street: [{
                        display: 'Main Street North',
                        tokenized: 'main street north',
                        priority: 0
                    }],
                    number: 1,
                    source: 'test'
                },
                geometry: {
                    type: 'Point',
                    coordinates: [1,1]
                }
            }
        }]);

        q.deepEquals(res, {
            action: 'create',
            type: 'Feature',
            properties: {
                number: 1,
                source: 'test',
                street: [{
                    display: 'Main Street North',
                    priority: 0
                }]
            },
            geometry: {
                type: 'Point',
                coordinates: [0,0]
            }
        });

        q.end();
    });

    t.test('conflate/compare - compare - Simple Modify', (q) => {
        let res = compare.compare({
            type: 'Feature',
            properties: {
                street: [{
                    display: 'Main Street North',
                    priority: 0
                },{
                    display: 'I64',
                    priority: -1
                }],
                number: 1,
                source: 'test'
            },
            geometry: {
                type: 'Point',
                coordinates: [0,0]
            }
        }, [{
            name: [{
                display: 'Main Street North',
                tokenized: 'main street north',
                priority: 0
            }],
            feat: {
                id: 1,
                type: 'Feature',
                properties: {
                    street: [{
                        display: 'Main Street North',
                        tokenized: 'main street north',
                        priority: 0
                    }],
                    number: 1,
                    source: 'test'
                },
                geometry: {
                    type: 'Point',
                    coordinates: [1,1]
                }
            }
        }]);

        q.deepEquals(res, {
            action: 'create',
            type: 'Feature',
            properties: {
                number: 1,
                source: 'test',
                street: [{
                    display: 'Main Street North',
                    priority: 0
                },{
                    display: 'I64',
                    priority: -1
                }]
            },
            geometry: {
                type: 'Point',
                coordinates: [0,0]
            }
        });

        q.end();
    });

    t.end();
});

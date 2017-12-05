const post = require('../lib/post/centre').post;
const test = require('tape');

test('Post: Centre', (t) => {
     t.deepEquals(post({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'GeometryCollection',
            geometries: [{
                "type": "LineString",
                "coordinates": [ [ -68.66264104843138, 45.46536797816513 ], [ -68.64938020706177, 45.46925051979969 ] ]
            }]
        }
     }).properties['carmen:center'], [ -68.64938020706177, 45.46925051979969 ]);

     t.deepEquals(post({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'GeometryCollection',
            geometries: [{
                "type": "LineString",
                "coordinates": [ [ -68.66264104843138, 45.46536797816513 ], [ -68.64938020706177, 45.46925051979969 ] ]
            },{
                "type": "MultiPoint",
                "coordinates": [ [ -68.662641048431, 45.46536797816513 ], [ -68.649380207061, 45.46925051979969 ] ]
            }]
        }
     }).properties['carmen:center'], [ -68.649380207061, 45.46925051979969 ]);

     t.deepEquals(post({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'GeometryCollection',
            geometries: [{
                "type": "MultiPoint",
                "coordinates": [ [ -68.662641048431, 45.46536797816513 ], [ -68.649380207061, 45.46925051979969 ] ]
            }]
        }
     }).properties['carmen:center'], [ -68.649380207061, 45.46925051979969 ]);

    t.end();
});

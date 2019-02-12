const post = require('../lib/post/cardinality').post;
const test = require('tape');

test('Post: Cardinality', (t) => {
    t.equals(post(), undefined);
    t.deepEquals(post({}), {});
    t.deepEquals(post({
        properties: {}
    }), {
        properties: {}
    });

    t.equals(f('Test'), 'Test');
    t.equals(f('Main St'), 'Main St');
    t.equals(f('S Main St'), 'S Main St,Main St S,Main St');
    t.equals(f('South Main St'), 'South Main St,Main St South,Main St');
    t.equals(f('Main St South'), 'Main St South,South Main St,Main St');


    t.equals(f('S Main St NW'), 'S Main St NW');
    t.equals(f('NW Main St S'), 'NW Main St S');

    t.equals(f('South Main St,Fake St South'), 'South Main St,Fake St South,Main St South,Main St,South Fake St,Fake St');

    //Random Sample From SG File
    t.equals(f('TUAS SOUTH BOULEVARD'), 'TUAS SOUTH BOULEVARD'); //We don't handle this format atm
    t.equals(f('JURONG WEST AVENUE'), 'JURONG WEST AVENUE');

    t.equals(f('ADMIRALTY ROAD EAST'), 'ADMIRALTY ROAD EAST,EAST ADMIRALTY ROAD,ADMIRALTY ROAD');
    t.equals(f('ADMIRALTY ROAD WEST'), 'ADMIRALTY ROAD WEST,WEST ADMIRALTY ROAD,ADMIRALTY ROAD');
    t.equals(f('EAST COAST PARKWAY'), 'EAST COAST PARKWAY,COAST PARKWAY EAST,COAST PARKWAY');
    t.equals(f('CORONATION ROAD WEST'), 'CORONATION ROAD WEST,WEST CORONATION ROAD,CORONATION ROAD');
    t.equals(f('BEDOK INDUSTRIAL PARK E'), 'BEDOK INDUSTRIAL PARK E,E BEDOK INDUSTRIAL PARK,BEDOK INDUSTRIAL PARK');
    t.equals(f('WEST COAST WALK'), 'WEST COAST WALK,COAST WALK WEST,COAST WALK');
    t.equals(f('TANJONG KATONG ROAD SOUTH'), 'TANJONG KATONG ROAD SOUTH,SOUTH TANJONG KATONG ROAD,TANJONG KATONG ROAD');
    t.equals(f('WEST COAST VIEW'), 'WEST COAST VIEW,COAST VIEW WEST,COAST VIEW');

    //Never Exceed 10 Synonyms
    t.equals(f('1,2,3,4,5,6,7,8,W 9,10,11').split(',').length, 11); //If it already has > 10 tokens ignore it
    t.equals(f('W 1 ST,E 1 ST,N 1 ST,S 1 ST,NE 1 ST,SE 1 ST').split(',').length, 10); //Never exceed 10 tokens

    t.end();
});

/**
 * Create input Feature given text
 * @param {string} text
 * @return {Object} GeoJSON Feature
 */
function f(text) {
    return post({
        type: 'Feature',
        properties: {
            'carmen:text': text
        }
    }).properties['carmen:text'];
}

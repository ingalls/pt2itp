'use strict';

const post = require('../lib/post/address-styles').post;
const test = require('tape');

test('Post: Style', (t) => {
    t.deepEquals(post({
        type: 'Feature',
        properties: {
            'carmen:address_style': 'queens',
            'carmen:addressprops': {
                'carmen:address_style': {
                    1: 'standard'
                }
            }
        },
        geometry: {}
    }).properties['carmen:address_styles'].sort(), ['queens', 'standard']
    , 'returns all address styles under the address_style properties');

    t.deepEquals(post({
        type: 'Feature',
        properties: {
            'carmen:address_style': 'standard',
            'carmen:addressprops': {
                'carmen:address_style': {
                    1: 'queens',
                    2: 'queens',
                    5: 'kings',
                    6: 'jacks'
                }
            }
        },
        geometry: {}
    }).properties['carmen:address_styles'].sort(), ['jacks', 'kings', 'queens', 'standard']
    , 'returns all unique address styles if there are several listed in addressprops');

    t.deepEquals(post(), undefined, 'returns undefined if no feature was passed in');

    t.deepEquals(post({
        type: 'Feature',
        properties: {
            'carmen:address_style': 'standard',
            'carmen:addressprops': {}
        },
        geometry: {}
    }).properties['carmen:address_styles'], ['standard']
    , 'returns only the style for address_style if none are under addressprops');

    t.deepEquals(post({
        type: 'Feature',
        properties: {},
        geometry: {}
    }).properties['carmen:address_styles'], undefined
    , 'does not apply address_styles property if no address_style properties are found');

    t.throws(() => {
        post({
            type: 'Feature',
            properties: {
                address_props: [{
                    'carmen:address_style': 'standard'
                }]
            },
            geometry: {}
        });
    }, 'throws error if input does not match the output format of the post.props script');

    t.end();
});

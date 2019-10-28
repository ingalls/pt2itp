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
                    3: null,
                    4: null
                }
            }
        },
        geometry: {}
    }).properties['carmen:address_styles'].sort(), ['queens', 'standard']
    , 'returns correct styles for a majority of queens styles with some standard');

    t.deepEquals(post({
        type: 'Feature',
        properties: {
            'carmen:addressprops': {
                'carmen:address_style': {
                    0: 'queens',
                    1: 'queens'
                }
            }
        },
        geometry: {}
    }).properties['carmen:address_styles'].sort(), ['queens', 'standard']
    , 'returns correct styles for a majority of standard styles with some queens');

    t.deepEquals(post({
        type: 'Feature',
        properties: {
            'carmen:address_style': 'queens'
        },
        geometry: {}
    }).properties['carmen:address_styles'].sort(), ['queens']
    , 'returns correct styles for all queens');

    t.deepEquals(post({
        type: 'Feature',
        properties: {
            'carmen:addressprops': {
                'carmen:address_style': {
                    3: 'queens',
                    4: 'kings'
                }
            }
        },
        geometry: {}
    }).properties['carmen:address_styles'].sort(), ['kings', 'queens', 'standard']
    , 'returns correct styles for a majority of standard styles and multiple other custom styles');

    t.deepEquals(post({
        type: 'Feature',
        properties: {
            'carmen:address_style': 'queens',
            'carmen:addressprops': {
                'carmen:address_style': {
                    2: null,
                    4: 'kings'
                }
            }
        },
        geometry: {}
    }).properties['carmen:address_styles'].sort(), ['kings', 'queens', 'standard']
    , 'returns correct styles for a majority of queens and a mix of standard and custom styles');

    t.deepEquals(post({
        type: 'Feature',
        properties: {
            'carmen:address_style': 'jacks',
            'carmen:addressprops': {
                'carmen:address_style': {
                    1: 'queens',
                    2: 'kings',
                    3: 'kings'
                }
            }
        },
        geometry: {}
    }).properties['carmen:address_styles'].sort(), ['jacks', 'kings', 'queens']
    , 'returns correct styles for a mix of custom styles with no standards');

    t.deepEquals(post(), undefined, 'returns undefined if no feature was passed in');

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

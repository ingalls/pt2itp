'use strict';

const tape = require('tape');
const titlecase = require('../lib/label/titlecase').titleCase;
const minors = require('@mapbox/title-case')('en');

tape('title case xformation', (t) => {
    const tests = [
        ['Väike-Sõjamäe', 'Väike-Sõjamäe'],
        ['Väike-sõjamäe', 'Väike-Sõjamäe'],
        ['väike-sõjamäe', 'Väike-Sõjamäe'],
        ['väike sõjamäe', 'Väike Sõjamäe'],
        ['väike  sõjamäe', 'Väike Sõjamäe'],
        ['Väike Sõjamäe', 'Väike Sõjamäe'],
        ['VäikeSõjamäe', 'Väikesõjamäe'],
        ['abra CAda -bra', 'Abra Cada Bra'],
        ['our lady of whatever', 'Our Lady of Whatever'],
        ['our lady OF whatever', 'Our Lady of Whatever'],
        ['St Martin\'s Neck Road', 'St Martin\'s Neck Road'],
        ['MT. MOOSILAUKE HWY', 'Mt. Moosilauke Hwy'],
        ['some  miscellaneous rd (what happens to parentheses?)', 'Some Miscellaneous Rd (What Happens to Parentheses?)'],
        ['main st NE', 'Main St NE'],
        ['main St NW', 'Main St NW'],
        ['SW Main St.', 'SW Main St.'],
        ['Main S.E. St', 'Main SE St'],
        ['main st ne', 'Main St NE'],
        ['nE. Main St', 'Ne. Main St']
    ];

    for (const test of tests) {
        t.equal(titlecase(test[0], minors), test[1], `${test[0]} => ${test[1]}`);
    }

    t.end();
});

tape('label logic, default behavior', (t) => {
    const label = require('../lib/label/titlecase')();
    const tests = [
        [[
            { freq: 12, display: 'our lady of whatever', tokenized: [{ token: 'our', token_type: null }, { token: 'lady', token_type: null }, { token: 'of', token_type: null }, { token: 'whatever', token_type: null }], source: 'address' },
            { freq: 2, display: 'our lady', tokenized: [{ token: 'our', token_type: null }, { token: 'lady', token_type: null }], source: 'network' }
        ], 'Our Lady of Whatever,Our Lady'],
        [[
            { display: 'our lady of whatever', tokenized: [{ token: 'our', token_type: null }, { token: 'lady', token_type: null }, { token: 'of', token_type: null }, { token: 'whatever', token_type: null }], source: 'address' },
            { display: 'OUR LADY of WHATEVER', tokenized: [{ token: 'our', token_type: null }, { token: 'lady', token_type: null }, { token: 'of', token_type: null }, { token: 'whatever', token_type: null }], source: 'network' }
        ], 'Our Lady of Whatever'],
        [[
            { display: 'Our Lady of whatever', tokenized: [{ token: 'our', token_type: null }, { token: 'lady', token_type: null }, { token: 'of', token_type: null }, { token: 'whatever', token_type: null }], source: 'address' },
            { display: 'OUR LÄDY OF WHATEVER', tokenized: [{ token: 'our', token_type: null }, { token: 'lady', token_type: null }, { token: 'of', token_type: null }, { token: 'whatever', token_type: null }], source: 'network' }
        ], 'Our Lady of Whatever'],
        [[
            { display: 'York Branch Road', tokenized: [{ token: 'york', token_type: null }, { token: 'br', token_type: null }, { token: 'rd', token_type: null }], source: 'address' },
            { display: 'York Road', tokenized: [{ token: 'york', token_type: null }, { token: 'rd', token_type: null }], source: 'address' },
            { display: 'York Road', tokenized: [{ token: 'york', token_type: null }, { token: 'rd', token_type: null }], source: 'network' }
        ], 'York Road,York Branch Road'],
        [[
            { freq: 603, source: 'address', display: 'GRAND AVE', priority: 0, tokenized: [{ token: 'grand', token_type: null }, { token: 'av', token_type: null }] },
            { freq: 17, source: 'address', display: 'GRAND VALLEY DR', priority: 0, tokenized: [{ token: 'grand', token_type: null }, { token: 'vly', token_type: null }, { token: 'dr', token_type: null }] },
            { freq: 3, source: 'address', display: 'Grand Ave', priority: 0, tokenized: [{ token: 'grand', token_type: null }, { token: 'av', token_type: null }] },
            { freq: 1, source: 'network', display: 'Grand Avenue', priority: 0, tokenized: [{ token: 'grand', token_type: null }, { token: 'av', token_type: null }] }
        ], 'Grand Avenue,Grand Valley Dr'],
        [[
            { display: 'State Highway 123', tokenized: [{ token: 'state', token_type: null }, { token: 'hwy', token_type: null }, { token: '123', token_type: null }], source: 'address', priority: 1 },
            { display: 'State Highway 123 ABC', tokenized: [{ token: 'state', token_type: null }, { token: 'hwy', token_type: null }, { token: '123', token_type: null }], source: 'address' }, // Should be deduped on tokenized
            { display: 'NC 123', tokenized: [{ token: 'nc', token_type: null }, { token: '123', token_type: null }], source: 'network', priority: 5 }
        ], 'Nc 123,State Highway 123']
    ];

    for (const test of tests) {
        t.equal(label(test[0], true), test[1], `${test[0][0].display}/${test[0][1].display} => ${test[1]}`);
    }

    t.end();
});

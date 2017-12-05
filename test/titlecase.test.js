const tape = require('tape');
const titlecase = require('../lib/label/titlecase').titleCase;
const minors = require('@mapbox/title-case')('en');

tape('title case xformation', (t) => {
    let tests = [
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

    for (let test of tests)
        t.equal(titlecase(test[0], minors), test[1], `${test[0]} => ${test[1]}`);

    t.end();
});

tape('label logic, default behavior', (t) => {
    const label = require('../lib/label/titlecase')();
    let tests = [
        [{ address_text: 'our lady of whatever', network_text: 'our lady' }, 'Our Lady of Whatever'],
        [{ address_text: 'our lady of whatever', network_text: 'OUR LADY of WHATEVER' }, 'OUR LADY of WHATEVER'],
        [{ address_text: 'Our Lady of whatever', network_text: 'OUR LÄDY OF WHATEVER' }, 'Our Lady of whatever']
    ];

    for (let test of tests)
        t.equal(label(test[0], true), test[1], `${test[0].address_text}/${test[0].network_text} => ${test[1]}`);

    t.end();
});

tape('label logic, favor network', (t) => {
    const label = require('../lib/label/titlecase')({ favor: 'network' });
    let tests = [
        [{ address_text: 'our lady of whatever', network_text: 'our lady ' }, 'Our Lady']
    ];

    for (let test of tests)
        t.equal(label(test[0], true), test[1], `${test[0].address_text}/${test[0].network_text} => ${test[1]}`);

    t.end();
});

tape('label logic, include synonyms', (t) => {
    const label = require('../lib/label/titlecase')({ synonym: true });
    let tests = [
        [{ address_text: 'our lady of whatever', network_text: 'our lady ' }, 'Our Lady of Whatever,Our Lady']
    ];

    for (let test of tests)
        t.equal(label(test[0], true), test[1], `${test[0].address_text}/${test[0].network_text} => ${test[1]}`);

    t.end();
});

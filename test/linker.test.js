const linker = require('../lib/linker');
const test = require('tape');

test('Passing Linker Matches', (t) => {
    t.deepEquals(
        linker({ text: 'main st' }, [
            { id: 1, text: 'main st' }
        ]),
        [{ id: 1, text: 'main st' }],
    'basic match');

    t.deepEquals(
        linker({ text: 'main st' }, [
            { id: 1, text: 'maim st' },
        ]),
        [{ id: 1, text: 'maim st', score: 85.71428571428572 }],
    'close match');

    t.deepEquals(
        linker({ text: 'main st' }, [
            { id: 1, text: 'main st' },
            { id: 2, text: 'main av' },
            { id: 3, text: 'main rd' },
            { id: 4, text: 'main dr' }
        ]),
        [{ id: 1, text: 'main st' }],
    'diff suff');

    t.deepEquals(
        linker({ text: 'main st' }, [
            { id: 1, text: 'main st' },
            { id: 2, text: 'asdg st' },
            { id: 3, text: 'asdg st' },
            { id: 4, text: 'maim st' }
        ]),
        [{ id: 1, text: 'main st' }],
    'diff name');

    t.deepEquals(
        linker({ text: 'ola ave', text_tokenless: 'ola' }, [
            { id: 1, text: 'ola', text_tokenless: 'ola'},
            { id: 2, text: 'ola avg', text_tokenless: 'ola avg'}
        ]),
        [{ id: 1, text: 'ola', text_tokenless: 'ola', score: 80}],
    'short names, tokens deweighted');

    t.deepEquals(
        linker({ text: 'ave st', text_tokenless: '', _text: 'Avenue Street' }, [
            { id: 1, text: 'ave', text_tokenless: '', _text: 'Avenue'},
            { id: 2, text: 'avenida', text_tokenless: 'avenida'}
        ]),
        [{ id: 1, text: 'ave', text_tokenless: '', _text: 'Avenue'}],
    'all-token scenario (e.g. avenue street)');

    t.deepEquals(
        linker({ text: 'ave st', text_tokenless: '', _text: 'Avenue Street' }, [
            { id: 1, text: 'ave', text_tokenless: '', _text: 'Avenue'},
            { id: 2, text: 'ave', text_tokenless: '', _text: 'Avenue'},
            { id: 3, text: 'avenida', text_tokenless: 'avenida'}
        ]),
        [
            { id: 1, text: 'ave', text_tokenless: '', _text: 'Avenue'},
            { id: 2, text: 'ave', text_tokenless: '', _text: 'Avenue'}
        ],
    'multiple winners (exact match)');

    t.deepEquals(
        linker({ text: 'main st', text_tokenless: '', _text: 'Main Street' }, [
            { id: 1, text: 'maim st', text_tokenless: 'maim', _text: 'Maim Street'},
            { id: 2, text: 'maim st', text_tokenless: 'maim', _text: 'Maim Street'},
            { id: 3, text: 'cross st', text_tokenless: 'cross', _text: 'Cross Street'}
        ]),
        [
            { id: 1, text: 'maim st', score: 85.71428571428572, text_tokenless: 'maim', _text: 'Maim Street'},
            { id: 2, text: 'maim st', score: 85.71428571428572, text_tokenless: 'maim', _text: 'Maim Street'}
        ],
    'multiple winners (score codepath)');

    t.deepEquals(
        linker({ text: 's st nw', _text: 'S STREET NW', text_tokenless: null }, [
            { id: 1250, text: 'p st ne', _text: 'P Street Northeast', text_tokenless: 'p' },
            { id: 863, text: 's st nw', _text: 'S STREET NW', text_tokenless: '' },
            { id: 862, text: 's st ne', _text: 'S STREET NE', text_tokenless: '' },
            { id: 388, text: 'bates st nw', _text: 'BATES STREET NW', text_tokenless: 'bates' }
        ]),
        [ { id: 863, text: 's st nw', _text: 'S STREET NW', text_tokenless: '' } ],
    'single winner w/ null text_tokenless');

    t.deepEquals(
        linker({ text: 's st nw', _text: 'S STREET NW', text_tokenless: null }, [
            { id: 2421, text: 'n capitol st', _text: 'North Capitol Street', text_tokenless: 'capitol' },
            { id: 669, text: 't st ne', _text: 'T Street Northeast', text_tokenless: 't' },
            { id: 630, text: 'todd pl ne', _text: 'Todd Place Northeast', text_tokenless: 'todd' },
            { id: 1007, text: 'u st ne', _text: 'U Street Northeast', text_tokenless: 'u' },
            { id: 2286, text: 'v st ne', _text: 'V Street Northeast', text_tokenless: 'v' },
            { id: 1026, text: 'u st nw', _text: 'U STREET NW', text_tokenless: 'u' },
            { id: 680, text: 't st nw', _text: 'T STREET NW', text_tokenless: 't' },
            { id: 2231, text: 'rhode is av ne', _text: 'Rhode Island Avenue Northeast', text_tokenless: 'rhode' },
            { id: 1199, text: 'n capitol st ne', _text: 'North Capitol Street Northeast', text_tokenless: 'capitol' },
            { id: 2031, text: 'n capitol st nw', _text: 'NORTH CAPITOL STREET NW', text_tokenless: 'capitol' },
            { id: 224, text: 'elm st nw', _text: 'Elm Street Northwest', text_tokenless: 'elm' },
            { id: 388, text: 'bates st nw', _text: 'BATES STREET NW', text_tokenless: 'bates' },
            { id: 863, text: 's st nw', _text: 'S STREET NW', text_tokenless: '' },
            { id: 1365, text: 'rhode is av nw', _text: 'RHODE ISLAND AVENUE NW', text_tokenless: 'rhode' },
            { id: 2366, text: 'r st nw', _text: 'R STREET NW', text_tokenless: '' },
            { id: 189, text: 'randolph pl ne', _text: 'Randolph Place Northeast',text_tokenless: 'randolph' },
            { id: 296, text: 'rt 1', _text: 'ROUTE 1', text_tokenless: '1' },
            { id: 629, text: 'lincoln rd ne', _text: 'Lincoln Road Northeast', text_tokenless: 'lincoln' },
            { id: 1662, text: 'quincy pl ne', _text: 'Quincy Place Northeast', text_tokenless: 'quincy' },
            { id: 852, text: '1st st nw', _text: 'First Street Northwest', text_tokenless: null },
            { id: 920, text: 'porter st ne', _text: 'Porter Street Northeast', text_tokenless: 'porter' },
            { id: 1037, text: 'quincy pl nw', _text: 'Quincy Place Northwest', text_tokenless: 'quincy' },
            { id: 959, text: 'florida av ne', _text: 'Florida Avenue Northeast',text_tokenless: 'florida' },
            { id: 969, text: 'richardson pl nw', _text: 'Richardson Place Northwest', text_tokenless: 'richardson' },
            { id: 1898, text: '1st st ne', _text: 'First Street Northeast', text_tokenless: null },
            { id: 1929, text: 'q st ne', _text: 'Q Street Northeast', text_tokenless: 'q' },
            { id: 2053, text: 'florida av nw', _text: 'Florida Ave NW', text_tokenless: 'florida' },
            { id: 1250, text: 'p st ne', _text: 'P Street Northeast', text_tokenless: 'p' },
            { id: 1243, text: 's st ne', _text: 'S Street Northeast', text_tokenless: null },
            { id: 1874, text: 'r st ne', _text: 'R Street Northeast', text_tokenless: null },
            { id: 2472, text: 'seaton pl ne', _text: 'Seaton Place Northeast', text_tokenless: 'seaton' },
            { id: 1893, text: 'randolph pl nw', _text: 'Randolph Place Northwest', text_tokenless: 'randolph' },
            { id: 2074, text: 'anna j cooper cir nw', _text: 'Anna J Cooper Circle Northwest', text_tokenless: 'anna j cooper' },
            { id: 69, text: 'p st nw', _text: 'P STREET NW', text_tokenless: 'p' },
            { id: 2225, text: 'q st nw', _text: 'Q STREET NW', text_tokenless: 'q' },
            { id: 424, text: '4th st nw', _text: '4th Street Northwest', text_tokenless: null },
            { id: 761, text: 'v st nw', _text: 'V Street Northwest', text_tokenless: 'v' },
            { id: 1210, text: '3rd st nw', _text: '3rd Street Northwest', text_tokenless: null },
            { id: 1481, text: 'seaton pl nw', _text: 'Seaton Place Northwest', text_tokenless: 'seaton' },
            { id: 460, text: 'flagler pl nw', _text: 'Flagler Place Northwest', text_tokenless: 'flagler' },
            { id: 565, text: '2nd st nw', _text: '2nd Street Northwest', text_tokenless: null },
            { id: 2402, text: 'thomas st nw', _text: 'Thomas Street Northwest', text_tokenless: 'thomas' }
        ]),
        [ { id: 863, text: 's st nw', _text: 'S STREET NW', text_tokenless: '' } ],
    'Ensure short circuiting never beats an exact match');
    t.end();
});

test('Failing Linker Matches', (t) => {
    t.deepEquals(
        linker({ text: 'main st' }, [
            { id: 1, text: 'anne blvd' }
        ]),
        false,
    'basic fail');

    t.end();
});

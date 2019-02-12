const linker = require('../lib/map/linker');
const test = require('tape');

test('linker#isNumbered', (t) => {
    t.equals(linker.isNumbered('main st'), false, 'main st => false');
    t.equals(linker.isNumbered('1st st'), '1st', '1st st => 1st');
    t.equals(linker.isNumbered('2nd st'), '2nd', '2nd st => 2nd');
    t.equals(linker.isNumbered('west 2nd st'), '2nd', 'west 2nd st => 2nd');
    t.equals(linker.isNumbered('3rd st'), '3rd', '3rd st = 3rd');
    t.equals(linker.isNumbered('4th av'), '4th', '4th av => 4th');
    t.equals(linker.isNumbered('21st av'), '21st', '21st av => 21st');
    t.equals(linker.isNumbered('32nd av'), '32nd', '32nd av => 32nd');
    t.equals(linker.isNumbered('45th av'), '45th', '45th av => 45th');
    t.equals(linker.isNumbered('351235th av'), '351235th', '351235th av => 351235th');
    t.end();
});

test('linker#isRoutish', (t) => {
    t.equals(linker.isRoutish('main st'), false, 'main st => false');
    t.equals(linker.isRoutish('1st st'), false, '1st st => false');
    t.equals(linker.isRoutish('351235th av'), false, '351235th av => false');
    t.equals(linker.isRoutish('NC 124'), '124', 'NC 124 => 124');
    t.equals(linker.isRoutish('US Route 50 East'), '50', 'US Route 50 East => 50');
    t.equals(linker.isRoutish('321'), '321', '321 => 321');
    t.equals(linker.isRoutish('124 NC'), '124', '124 NC => 124');
    t.end();
});

test('Passing Linker Matches', (t) => {
    t.deepEquals(
        linker([{ display: 'Main Street', tokenized: 'main st' }], [
            { id: 1, name: { display: 'Main Street', tokenized: 'main st' } }
        ]),
        [{ id: 1, name: { display: 'Main Street', tokenized: 'main st' }, score: 100 }],
    'basic match');

    t.deepEquals(
        linker([{ display: 'Main Street', tokenized: 'main st' }], [
            { id: 1, name: { display: 'Maim Street', tokenized: 'maim st' } },
        ]),
        [{ id: 1, name: { display: 'Maim Street', tokenized: 'maim st' }, score: 85.71428571428572 }],
    'close match');

    t.deepEquals(
        linker([{ display: '1st Street West', tokenized: '1st st west' }], [
            { id: 1, name: { display: '2nd Street West', tokenized: '2nd st west' } },
        ]),
        false,
    'no match numeric simple (2nd)');

    t.deepEquals(
        linker([{ display: '1st Street West', tokenized: '1st st west' }], [
            { id: 1, name: { display: '3rd Street West', tokenized: '3rd st west' } },
        ]),
        false,
    'no match numeric simple (3rd)');

    t.deepEquals(
        linker([{ display: '1st Street West', tokenized: '1st st west' }], [
            { id: 1, name: { display: '4th Street West', tokenized: '4th st west' } },
        ]),
        false,
    'no match numeric simple (4th)');

    t.deepEquals(
        linker([{ display: '11th Street West', tokenized: '11th st west' }], [
            { id: 1, name: { display: '21st Street West', tokenized: '21st st west' } },
        ]),
        false,
    'no match numeric simple (21st)');

    t.deepEquals(
        linker([{ display: 'US Route 50 East', tokenized: 'us route 50 east' }], [
            { id: 1, name: { display: 'US Route 50 West', tokenized: 'us route 50 west' } },
        ]),
        [{ id: 1, name: { display: 'US Route 50 West', tokenized: 'us route 50 west' }, score: 95.3125 }],
    'Numbers match - cardinals don\'t');

    t.deepEquals(
        linker([{ display: 'US Route 60 East', tokenized: 'us route 50 east' }], [
            { id: 1, name: { display: 'US Route 51 West', tokenized: 'us route 51 west' } },
        ]),
        false,
    'Number mismatch fail');

    t.deepEquals(
        linker([{ display: '11th Street West', tokenized: '11th st west' }], [
            { id: 1, name: { display: '11th Avenue West', tokenized: '11th av west' } },
        ]),
        [ { id: 1, name: { display: '11th Avenue West', tokenized: '11th av west' }, score: 94.44444444444444 } ],
    'match numeric simple (type mismatch)');

    t.deepEquals(
        linker([{ display: 'Main Street', tokenized: 'main st' }], [
            { id: 1, name: { display: 'Main Street', tokenized: 'main st' } },
            { id: 2, name: { display: 'Main Avenue', tokenized: 'main av' } },
            { id: 3, name: { display: 'Main Road', tokenized: 'main rd' } },
            { id: 4, name: { display: 'Main Drive', tokenized: 'main dr' } }
        ]),
        [{ id: 1, name: { display: 'Main Street', tokenized: 'main st' }, score: 100 }],
    'diff suff');

    t.deepEquals(
        linker([{ display: 'Main Street', tokenized: 'main st' }], [
            { id: 1, name: { display: 'Main Street', tokenized: 'main st' } },
            { id: 2, name: { display: 'Asdg Street', tokenized: 'asdg st' } },
            { id: 3, name: { display: 'Asdg Street', tokenized: 'asdg st' } },
            { id: 4, name: { display: 'Maim Street', tokenized: 'maim st' } }
        ]),
        [{ id: 1, name: { display: 'Main Street', tokenized: 'main st' }, score: 100 }],
    'diff name');

    t.deepEquals(
        linker([{ display: 'Ola Avenue', tokenized: 'ola ave', tokenless: 'ola' }], [
            { id: 1, name: { display: 'Ola', tokenized: 'ola', tokenless: 'ola'} },
            { id: 2, name: { display: 'Ola Avg' , tokenized: 'ola avg', tokenless: 'ola avg' } }
        ]),
        [{ id: 1, name: { display: 'Ola', tokenized: 'ola', tokenless: 'ola' }, score: 80 }],
    'short names, tokens deweighted');

    t.deepEquals(
        linker([{ tokenized: 'ave st', tokenless: '', display: 'Avenue Street' }], [
            { id: 1, name: { tokenized: 'ave', tokenless: '', display: 'Avenue' } },
            { id: 2, name: { tokenized: 'avenida', tokenless: 'avenida' } }
        ]),
        [{ id: 1, name: { tokenized: 'ave', tokenless: '', display: 'Avenue' }, score: 77.77777777777777 }],
    'all-token scenario (e.g. avenue street)');

    t.deepEquals(
        linker([{ tokenized: 'ave st', tokenless: '', display: 'Avenue Street' }], [
            { id: 1, name: { tokenized: 'ave', tokenless: '', display: 'Avenue' } },
            { id: 2, name: { tokenized: 'ave', tokenless: '', display: 'Avenue' } },
            { id: 3, name: { tokenized: 'avenida', tokenless: 'avenida' } }
        ]),
        [
            { id: 1, name: { tokenized: 'ave', tokenless: '', display: 'Avenue' }, score: 77.77777777777777 },
            { id: 2, name: { tokenized: 'ave', tokenless: '', display: 'Avenue' }, score: 77.77777777777777 }
        ],
    'multiple winners (exact match)');

    t.deepEquals(
        linker([{ tokenized: 'main st west', tokenless: 'main' }], [
            { id: 1, name: { tokenized: 'main rd', tokenless: 'main', display: 'Main Road' } },
            { id: 2, name: { tokenized: 'main av', tokenless: 'main', display: 'Main Avenue' } },
            { id: 3, name: { tokenized: 'main st', tokenless: 'main', display: 'Main Street' } }
        ]),
        [ { id: 3, name: { tokenized: 'main st', tokenless: 'main', display: 'Main Street' }, score: 86.84210526315789 }, ],
    'Very Close Matches w/ tokenless');

    t.deepEquals(
        linker([{ display: 'Lake Street West', tokenized: 'lk ts w', tokenless: '' }], [
            { id: 1, name: { tokenized: 'w lk st', tokenless: '', display: 'West Lake Street' } }
        ]),
        [ { id: 1, name: { tokenized: 'w lk st', tokenless: '', display: 'West Lake Street' }, score: 90.47619047619048 }, ],
    'Match w/o tokenless');

    t.deepEquals(
        linker([{ tokenized: 'main st', tokenless: '', display: 'Main Street' }], [
            { id: 1, name: { tokenized: 'maim st', tokenless: 'maim', display: 'Maim Street' } },
            { id: 2, name: { tokenized: 'maim st', tokenless: 'maim', display: 'Maim Street' } },
            { id: 3, name: { tokenized: 'cross st', tokenless: 'cross', display: 'Cross Street' } }
        ]),
        [
            { id: 1, name: { tokenized: 'maim st', tokenless: 'maim', display: 'Maim Street' }, score: 85.71428571428572 },
            { id: 2, name: { tokenized: 'maim st', tokenless: 'maim', display: 'Maim Street'}, score: 85.71428571428572 }
        ],
    'multiple winners (score codepath)');

    t.deepEquals(
        linker([{ tokenized: 's st nw', display: 'S STREET NW', tokenless: null }], [
            { id: 1250, name: { tokenized: 'p st ne', display: 'P Street Northeast', tokenless: 'p' } },
            { id: 863, name: { tokenized: 's st nw', display: 'S STREET NW', tokenless: '' } },
            { id: 862, name: { tokenized: 's st ne', display: 'S STREET NE', tokenless: '' } },
            { id: 388, name: { tokenized: 'bates st nw', display: 'BATES STREET NW', tokenless: 'bates' } }
        ]),
        [ { id: 863, name: { tokenized: 's st nw', display: 'S STREET NW', tokenless: '' }, score: 100 } ],
    'single winner w/ null tokenless');

    t.deepEquals(
        linker([{ tokenized: 'w main st', display: 'West Main Street', tokenless: 'main' }], [
            { id: 388, name: { tokenized: 'w st st', display: 'West Saint Street', tokenless: '' } }
        ]),
        false,
    'close tokenized');

    t.deepEquals(
        linker([{ tokenized: 'w st st', display: 'West Saint Street', tokenless: '' }], [
            { id: 388, name: { tokenized: 'w main st', display: 'West Main Street', tokenless: 'main' } }
        ]),
        false,
    'close tokenized reverse');

    t.deepEquals(
        linker([{ tokenized: 's st nw', display: 'S STREET NW', tokenless: null }], [
            { id: 2421, name: { tokenized: 'n capitol st', display: 'North Capitol Street', tokenless: 'capitol' } },
            { id: 669, name: { tokenized: 't st ne', display: 'T Street Northeast', tokenless: 't' } },
            { id: 630, name: { tokenized: 'todd pl ne', display: 'Todd Place Northeast', tokenless: 'todd' } },
            { id: 1007, name: { tokenized: 'u st ne', display: 'U Street Northeast', tokenless: 'u' } },
            { id: 2286, name: { tokenized: 'v st ne', display: 'V Street Northeast', tokenless: 'v' } },
            { id: 1026, name: { tokenized: 'u st nw', display: 'U STREET NW', tokenless: 'u' } },
            { id: 680, name: { tokenized: 't st nw', display: 'T STREET NW', tokenless: 't' } },
            { id: 2231, name: { tokenized: 'rhode is av ne', display: 'Rhode Island Avenue Northeast', tokenless: 'rhode' } },
            { id: 1199, name: { tokenized: 'n capitol st ne', display: 'North Capitol Street Northeast', tokenless: 'capitol' } },
            { id: 2031, name: { tokenized: 'n capitol st nw', display: 'NORTH CAPITOL STREET NW', tokenless: 'capitol' } },
            { id: 224, name: { tokenized: 'elm st nw', display: 'Elm Street Northwest', tokenless: 'elm' } },
            { id: 388, name: { tokenized: 'bates st nw', display: 'BATES STREET NW', tokenless: 'bates' } },
            { id: 863, name: { tokenized: 's st nw', display: 'S STREET NW', tokenless: '' } },
            { id: 1365, name: { tokenized: 'rhode is av nw', display: 'RHODE ISLAND AVENUE NW', tokenless: 'rhode' } },
            { id: 2366, name: { tokenized: 'r st nw', display: 'R STREET NW', tokenless: '' } },
            { id: 189, name: { tokenized: 'randolph pl ne', display: 'Randolph Place Northeast',tokenless: 'randolph' } },
            { id: 296, name: { tokenized: 'rt 1', display: 'ROUTE 1', tokenless: '1' } },
            { id: 629, name: { tokenized: 'lincoln rd ne', display: 'Lincoln Road Northeast', tokenless: 'lincoln' } },
            { id: 1662, name: { tokenized: 'quincy pl ne', display: 'Quincy Place Northeast', tokenless: 'quincy' } },
            { id: 852, name: { tokenized: '1st st nw', display: 'First Street Northwest', tokenless: null } },
            { id: 920, name: { tokenized: 'porter st ne', display: 'Porter Street Northeast', tokenless: 'porter' } },
            { id: 1037, name: { tokenized: 'quincy pl nw', display: 'Quincy Place Northwest', tokenless: 'quincy' } },
            { id: 959, name: { tokenized: 'florida av ne', display: 'Florida Avenue Northeast',tokenless: 'florida' } },
            { id: 969, name: { tokenized: 'richardson pl nw', display: 'Richardson Place Northwest', tokenless: 'richardson' } },
            { id: 1898, name: { tokenized: '1st st ne', display: 'First Street Northeast', tokenless: null } },
            { id: 1929, name: { tokenized: 'q st ne', display: 'Q Street Northeast', tokenless: 'q' } },
            { id: 2053, name: { tokenized: 'florida av nw', display: 'Florida Ave NW', tokenless: 'florida' } },
            { id: 1250, name: { tokenized: 'p st ne', display: 'P Street Northeast', tokenless: 'p' } },
            { id: 1243, name: { tokenized: 's st ne', display: 'S Street Northeast', tokenless: null } },
            { id: 1874, name: { tokenized: 'r st ne', display: 'R Street Northeast', tokenless: null } },
            { id: 2472, name: { tokenized: 'seaton pl ne', display: 'Seaton Place Northeast', tokenless: 'seaton' } },
            { id: 1893, name: { tokenized: 'randolph pl nw', display: 'Randolph Place Northwest', tokenless: 'randolph' } },
            { id: 2074, name: { tokenized: 'anna j cooper cir nw', display: 'Anna J Cooper Circle Northwest', tokenless: 'anna j cooper' } },
            { id: 69, name: { tokenized: 'p st nw', display: 'P STREET NW', tokenless: 'p' } },
            { id: 2225, name: { tokenized: 'q st nw', display: 'Q STREET NW', tokenless: 'q' } },
            { id: 424, name: { tokenized: '4th st nw', display: '4th Street Northwest', tokenless: null } },
            { id: 761, name: { tokenized: 'v st nw', display: 'V Street Northwest', tokenless: 'v' } },
            { id: 1210, name: { tokenized: '3rd st nw', display: '3rd Street Northwest', tokenless: null } },
            { id: 1481, name: { tokenized: 'seaton pl nw', display: 'Seaton Place Northwest', tokenless: 'seaton' } },
            { id: 460, name: { tokenized: 'flagler pl nw', display: 'Flagler Place Northwest', tokenless: 'flagler' } },
            { id: 565, name: { tokenized: '2nd st nw', display: '2nd Street Northwest', tokenless: null } },
            { id: 2402, name: { tokenized: 'thomas st nw', display: 'Thomas Street Northwest', tokenless: 'thomas' } }
        ]),
        [ { id: 863, name: { tokenized: 's st nw', display: 'S STREET NW', tokenless: '' }, score: 100 } ],
    'Ensure short circuiting never beats an exact match');
    t.end();
});

test('Failing Linker Matches', (t) => {
    t.deepEquals(
        linker([{ display: 'Main Street', tokenized: 'main st' }], [
            { id: 1, name: { display: 'Anne Boulevard', tokenized: 'anne blvd' } }
        ]),
        false,
    'basic fail');

    t.end();
});

test('Tokenized match success', (t) => {
    t.deepEquals(linker([{ source: 'address', display: 'E College Ave', priority: 0, tokenized: 'e coll av', tokenless: '' }], [
        { id: 96796, name: { freq: 1, source: 'network', display: 'College Avenue', priority: 0, tokenized: 'coll av', tokenless: '' }, dist: 0.000249000000003718 },
        { id: 96794, name: { freq: 1, source: 'network', display: 'Village Drive', priority: 0, tokenized: 'vlg dr', tokenless: '' }, dist: 0.000891004948209828 },
        { id: 96795, name: { freq: 1, source: 'network', display: 'Colorado Avenue', priority: 0, tokenized: 'colorado av', tokenless: 'colorado' }, dist: 0.00096000468748776 },
        { id: 96792, name: { freq: 1, source: 'network', display: 'Adams Circle', priority: 0, tokenized: 'adams cir', tokenless: 'adams' }, dist: 0.00130397891087183 },
        { id: 96797, name: { freq: 1, source: 'network', display: '28th Street Frontage Road', priority: 0, tokenized: '28th st frtg rd', tokenless: '28th' }, dist: 0.00140758309828831 },
        { id: 96816, name: { freq: 1, source: 'network', display: 'Pennsylvania Avenue', priority: 0, tokenized: 'pennsylvania av', tokenless: 'pennsylvania' }, dist: 0.00157203015186948 },
        { id: 96817, name: { freq: 1, source: 'network', display: 'Holly Place', priority: 0, tokenized: 'holly pl', tokenless: 'holly' }, dist: 0.00165197820808934 },
        { id: 96941, name: { freq: 1, source: 'network', display: '28th Street', priority: 0, tokenized: '28th st', tokenless: '28th' }, dist: 0.0016531353199351 },
        { id: 96941, name: { freq: 1, source: 'network', display: 'CO 119', priority: -1, tokenized: 'co 119', tokenless: '119' }, dist: 0.0016531353199351 },
        { id: 96941, name: { freq: 1, source: 'network', display: 'CO 7', priority: -1, tokenized: 'co 7', tokenless: '' }, dist: 0.0016531353199351 },
        { id: 96941, name: { freq: 1, source: 'network', display: 'Highway 36', priority: -1, tokenized: 'hwy 36', tokenless: '36' }, dist: 0.0016531353199351 },
        { id: 96941, name: { freq: 1, source: 'network', display: 'United States Highway 36', priority: -1, tokenized: 'united states hwy 36', tokenless: 'united states 36' }, dist: 0.0016531353199351 },
        { id: 96941, name: { freq: 1, source: 'network', display: 'US 36', priority: -1, tokenized: 'us 36', tokenless: 'us 36' }, dist: 0.0016531353199351 },
        { id: 96815, name: { freq: 1, source: 'network', display: 'East Ridge Avenue', priority: 0, tokenized: 'e rdg av', tokenless: '' }, dist: 0.00224964219377202 },
        { id: 96818, name: { freq: 1, source: 'network', display: 'Springdale Lane', priority: 0, tokenized: 'springdale ln', tokenless: 'springdale' }, dist: 0.00226970419234784 },
        { id: 96823, name: { freq: 1, source: 'network', display: 'University Heights Avenue', priority: 0, tokenized: 'univ hts av', tokenless: '' }, dist: 0.00247436800011108 }
    ]), [
        { id: 96796, name: { freq: 1, source: 'network', display: 'College Avenue', priority: 0, tokenized: 'coll av', tokenless: '' }, dist: 0.000249000000003718, score: 100}
    ], 'Ensure tokenized match is correct');

    t.end();
});
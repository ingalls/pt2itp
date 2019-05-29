'use strict';

const linker = require('../lib/map/linker');
const test = require('tape');

test('linker#isNumbered', (t) => {
    t.equals(linker.isNumbered([{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }]), false, 'main st => false');
    t.equals(linker.isNumbered([{ token: '1st', token_type: 'Ordinal' }, { token: 'st', token_type: 'Way' }]), '1st', '1st st => 1st');
    t.equals(linker.isNumbered([{ token: '2nd', token_type: 'Ordinal' }, { token: 'st', token_type: 'Way' }]), '2nd', '2nd st => 2nd');
    t.equals(linker.isNumbered([{ token: 'w', token_type: 'Cardinal' }, { token: '2nd', token_type: 'Ordinal' }, { token: 'st', token_type: 'Way' }]), '2nd', 'west 2nd st => 2nd');
    t.equals(linker.isNumbered([{ token: '3rd', token_type: 'Ordinal' }, { token: 'st', token_type: 'Way' }]), '3rd', '3rd st = 3rd');
    t.equals(linker.isNumbered([{ token: '4th', token_type: 'Ordinal' }, { token: 'av', token_type: 'Way' }]), '4th', '4th av => 4th');
    t.equals(linker.isNumbered([{ token: '21st', token_type: 'Ordinal' }, { token: 'av', token_type: 'Way' }]), '21st', '21st av => 21st');
    t.equals(linker.isNumbered([{ token: '32nd', token_type: 'Ordinal' }, { token: 'av', token_type: 'Way' }]), '32nd', '32nd av => 32nd');
    t.equals(linker.isNumbered([{ token: '45th', token_type: 'Ordinal' }, { token: 'av', token_type: 'Way' }]), '45th', '45th av => 45th');
    t.equals(linker.isNumbered([{ token: '351235th', token_type: 'Ordinal' }, { token: 'av', token_type: 'Way' }]), '351235th', '351235th av => 351235th');
    t.end();
});

test('linker#isRoutish', (t) => {
    t.equals(linker.isRoutish([{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }]), false, 'main st => false');
    t.equals(linker.isRoutish([{ token: '1st', token_type: 'Ordinal' }, { token: 'st', token_type: 'Way' }]), false, '1st st => false');
    t.equals(linker.isRoutish([{ token: '351235th', token_type: 'Ordinal' }, { token: 'av', token_type: 'Way' }]), false, '351235th av => false');
    t.equals(linker.isRoutish([{ token: 'nc', token_type: null }, { token: '124', token_type: null }]), '124', 'NC 124 => 124');
    t.equals(linker.isRoutish([{ token: 'us', token_type: null }, { token: 'rt', token_type: 'Way' }, { token: '50', token_type: null }, { token: 'e', token_type: 'Cardinal' }]), '50', 'US Route 50 East => 50');
    t.equals(linker.isRoutish([{ token: '321', token_type: null }]), '321', '321 => 321');
    t.equals(linker.isRoutish([{ token: '124', token_type: null }, { token: 'nc', token_type: null }]), '124', '124 NC => 124');
    t.end();
});

test('Passing Linker Matches', (t) => {
    t.deepEquals(
        linker([{ display: 'Main Street', tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] }], [
            { id: 1, name: { display: 'Main Street', tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] } }
        ]),
        [{ id: 1, name: { display: 'Main Street', tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] }, score: 100 }],
        'basic match');

    t.deepEquals(
        linker([{ display: 'Main Street', tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] }], [
            { id: 1, name: { display: 'Maim Street', tokenized: [{ token: 'maim', token_type: null }, { token: 'st', token_type: 'Way' }] } }
        ]),
        [{ id: 1, name: { display: 'Maim Street', tokenized: [{ token: 'maim', token_type: null }, { token: 'st', token_type: 'Way' }] }, score: 85.71428571428572 }],
        'close match');

    t.deepEquals(
        linker([{ display: '1st Street West', tokenized: [{ token: '1st', token_type: 'Ordinal' }, { token: 'st', token_type: 'Way' }, { token: 'w', token_type: 'Cardinal' }] }], [
            { id: 1, name: { display: '2nd Street West', tokenized: [{ token: '2nd', token_type: 'Ordinal' }, { token: 'st', token_type: 'Way' }, { token: 'w', token_type: 'Cardinal' }] } }
        ]),
        false,
        'no match numeric simple (2nd)');

    t.deepEquals(
        linker([{ display: '1st Street West', tokenized: [{ token: '1st', token_type: 'Ordinal' }, { token: 'st', token_type: 'Way' }, { token: 'w', token_type: 'Cardinal' }] }], [
            { id: 1, name: { display: '3rd Street West', tokenized: [{ token: '3rd', token_type: 'Ordinal' }, { token: 'st', token_type: 'Way' }, { token: 'w', token_type: 'Cardinal' }] } }
        ]),
        false,
        'no match numeric simple (3rd)');

    t.deepEquals(
        linker([{ display: '1st Street West', tokenized: [{ token: '1st', token_type: 'Ordinal' }, { token: 'st', token_type: 'Way' }, { token: 'w', token_type: 'Cardinal' }] }], [
            { id: 1, name: { display: '4th Street West', tokenized: [{ token: '4th', token_type: 'Ordinal' }, { token: 'st', token_type: 'Way' }, { token: 'w', token_type: 'Cardinal' }] } }
        ]),
        false,
        'no match numeric simple (4th)');

    t.deepEquals(
        linker([{ display: '11th Street West', tokenized: [{ token: '11th', token_type: 'Ordinal' }, { token: 'st', token_type: 'Way' }, { token: 'w', token_type: 'Cardinal' }] }], [
            { id: 1, name: { display: '21st Street West', tokenized: [{ token: '21st', token_type: 'Ordinal' }, { token: 'st', token_type: 'Way' }, { token: 'w', token_type: 'Cardinal' }] } }
        ]),
        false,
        'no match numeric simple (21st)');

    t.deepEquals(
        linker([{ display: 'US Route 50 East', tokenized: [{ token: 'us', token_type: null }, { token: 'rt', token_type: 'Way' }, { token: '50', token_type: null }, { token: 'e', token_type: 'Cardinal' }] }], [
            { id: 1, name: { display: 'US Route 50 West', tokenized: [{ token: 'us', token_type: null }, { token: 'rt', token_type: 'Way' }, { token: '50', token_type: null }, { token: 'w', token_type: 'Cardinal' }] } }
        ]),
        [{ id: 1, name: { display: 'US Route 50 West', tokenized: [{ token: 'us', token_type: null }, { token: 'rt', token_type: 'Way' }, { token: '50', token_type: null }, { token: 'w', token_type: 'Cardinal' }] }, score: 97.5 }],
        'Numbers match - cardinals don\'t');

    t.deepEquals(
        linker([{ display: 'US Route 60 East', tokenized: [{ token: 'us', token_type: null }, { token: 'rt', token_type: 'Way' }, { token: '60', token_type: null }, { token: 'e', token_type: 'Cardinal' }] }], [
            { id: 1, name: { display: 'US Route 51 West', tokenized: [{ token: 'us', token_type: null }, { token: 'rt', token_type: 'Way' }, { token: '51', token_type: null }, { token: 'w', token_type: 'Cardinal' }] } }
        ]),
        false,
        'Number mismatch fail');

    t.deepEquals(
        linker([{ display: '11th Street West', tokenized: [{ token: '11th', token_type: 'Ordinal' }, { token: 'st', token_type: 'Way' }, { token: 'w', token_type: 'Cardinal' }] }], [
            { id: 1, name: { display: '11th Avenue West', tokenized: [{ token: '11th', token_type: 'Ordinal' }, { token: 'av', token_type: 'Way' }, { token: 'w', token_type: 'Cardinal' }] } }
        ]),
        [{ id: 1, name: { display: '11th Avenue West', tokenized: [{ token: '11th', token_type: 'Ordinal' }, { token: 'av', token_type: 'Way' }, { token: 'w', token_type: 'Cardinal' }] }, score: 92.5925925925926 }],
        'match numeric simple (type mismatch)');

    t.deepEquals(
        linker([{ display: 'Main Street', tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] }], [
            { id: 1, name: { display: 'Main Street', tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] } },
            { id: 2, name: { display: 'Main Avenue', tokenized: [{ token: 'main', token_type: null }, { token: 'av', token_type: 'Way' }] } },
            { id: 3, name: { display: 'Main Road', tokenized: [{ token: 'main', token_type: null }, { token: 'rd', token_type: 'Way' }] } },
            { id: 4, name: { display: 'Main Drive', tokenized: [{ token: 'main', token_type: null }, { token: 'dr', token_type: 'Way' }] } }
        ]),
        [{ id: 1, name: { display: 'Main Street', tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] }, score: 100 }],
        'diff suff');

    t.deepEquals(
        linker([{ display: 'Main Street', tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] }], [
            { id: 1, name: { display: 'Main Street', tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] } },
            { id: 2, name: { display: 'Asdg Street', tokenized: [{ token: 'asdg', token_type: null }, { token: 'st', token_type: 'Way' }] } },
            { id: 3, name: { display: 'Asdg Street', tokenized: [{ token: 'asdg', token_type: null }, { token: 'st', token_type: 'Way' }] } },
            { id: 4, name: { display: 'Maim Street', tokenized: [{ token: 'maim', token_type: null }, { token: 'st', token_type: 'Way' }] } }
        ]),
        [{ id: 1, name: { display: 'Main Street', tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] }, score: 100 }],
        'diff name');

    t.deepEquals(
        linker([{ display: 'Ola Avenue', tokenized: [{ token: 'ola', token_type: null }, { token: 'av', token_type: 'Way' }] }], [
            { id: 1, name: { display: 'Ola', tokenized: [{ token: 'ola', token_type: null }] } },
            { id: 2, name: { display: 'Ola Avg' , tokenized: [{ token: 'ola', token_type: null }, { token: 'avg', token_type: null }] } }
        ]),
        [{ id: 1, name: { display: 'Ola', tokenized: [{ token: 'ola', token_type: null }] }, score: 83.33333333333334 }],
        'short names, tokens deweighted');

    t.deepEquals(
        linker([{ display: 'Avenue Street', tokenized: [{ token: 'av', token_type: 'Way' }, { token: 'st', token_type: 'Way' }] }], [
            { id: 1, name: { display: 'Avenue', tokenized: [{ token: 'av', token_type: 'Way' }] } },
            { id: 2, name: { display: 'Avenida', tokenized: [{ token: 'avenida', token_type: null }] } }
        ]),
        [{ id: 1, name: { display: 'Avenue', tokenized: [{ token: 'av', token_type: 'Way' }] }, score: 71.42857142857143 }],
        'all-token scenario (e.g. avenue street)');

    t.deepEquals(
        linker([{ tokenized: [{ token: 'av', token_type: 'Way' }, { token: 'st', token_type: 'Way' }], display: 'Avenue Street' }], [
            { id: 1, name: { tokenized: [{ token: 'av', token_type: 'Way' }], display: 'Avenue' } },
            { id: 2, name: { tokenized: [{ token: 'av', token_type: 'Way' }], display: 'Avenue' } },
            { id: 3, name: { tokenized: [{ token: 'avenida', token_type: null }] } }
        ]),
        [
            { id: 1, name: { tokenized: [{ token: 'av', token_type: 'Way' }], display: 'Avenue' }, score: 71.42857142857143 },
            { id: 2, name: { tokenized: [{ token: 'av', token_type: 'Way' }], display: 'Avenue' }, score: 71.42857142857143 }
        ],
        'multiple winners (exact match)');

    t.deepEquals(
        linker([{ display: 'Main St West', tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }, { token: 'w', token_type: 'Way' }] }], [
            { id: 1, name: { tokenized: [{ token: 'main', token_type: null }, { token: 'rd', token_type: 'Way' }], display: 'Main Road' } },
            { id: 2, name: { tokenized: [{ token: 'main', token_type: null }, { token: 'av', token_type: 'Way' }], display: 'Main Avenue' } },
            { id: 3, name: { tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }], display: 'Main Street' } }
        ]),
        [{ id: 3, name: { tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }], display: 'Main Street' }, score: 93.75 }],
        'Very Close Matches w/ tokenless');

    t.deepEquals(
        linker([{ display: 'Lake Street West', tokenized: [{ token: 'lk', token_type: null }, { token: 'st', token_type: 'Way' }, { token: 'w', token_type: 'Cardinal' }] }], [
            { id: 1, name: { tokenized: [{ token: 'w', token_type: 'Cardinal' }, { token: 'lk', token_type: null }, { token: 'st', token_type: 'Way' }], display: 'West Lake Street' } }
        ]),
        [{ id: 1, name: { tokenized: [{ token: 'w', token_type: 'Cardinal' }, { token: 'lk', token_type: null }, { token: 'st', token_type: 'Way' }], display: 'West Lake Street' }, score: 85.71428571428572 }],
        'Match w/o tokenless');

    t.deepEquals(
        linker([{ tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }], display: 'Main Street' }], [
            { id: 1, name: { tokenized: [{ token: 'maim', token_type: null }, { token: 'st', token_type: 'Way' }], display: 'Maim Street' } },
            { id: 2, name: { tokenized: [{ token: 'maim', token_type: null }, { token: 'st', token_type: 'Way' }], display: 'Maim Street' } },
            { id: 3, name: { tokenized: [{ token: 'x', token_type: 'Way' }, { token: 'st', token_type: 'Way' }], display: 'Cross Street' } }
        ]),
        [
            { id: 1, name: { tokenized: [{ token: 'maim', token_type: null }, { token: 'st', token_type: 'Way' }], display: 'Maim Street' }, score: 85.71428571428572 },
            { id: 2, name: { tokenized: [{ token: 'maim', token_type: null }, { token: 'st', token_type: 'Way' }], display: 'Maim Street' }, score: 85.71428571428572 }
        ],
        'multiple winners (score codepath)');

    t.deepEquals(
        linker([{ tokenized: [{ token: 's', token_type: 'Cardinal' }, { token: 'st', token_type: 'Way' }, { token: 'nw', token_type: 'Cardinal' }], display: 'S STREET NW' }], [
            { id: 1250, name: { tokenized: [{ token: 'p', token_type: 'Cardinal' }, { token: 'st', token_type: 'Way' }, { token: 'ne', token_type: 'Cardinal' }], display: 'P Street Northeast' } },
            { id: 863, name: { tokenized: [{ token: 's', token_type: 'Cardinal' }, { token: 'st', token_type: 'Way' }, { token: 'nw', token_type: 'Cardinal' }], display: 'S STREET NW' } },
            { id: 862, name: { tokenized: [{ token: 's', token_type: 'Cardinal' }, { token: 'st', token_type: 'Way' }, { token: 'ne', token_type: 'Cardinal' }], display: 'S STREET NE' } },
            { id: 388, name: { tokenized: [{ token: 'bates', token_type: 'Cardinal' }, { token: 'st', token_type: 'Way' }, { token: 'nw', token_type: 'Cardinal' }], display: 'BATES STREET NW' } }
        ]),
        [{ id: 863, name: { tokenized: [{ token: 's', token_type: 'Cardinal' }, { token: 'st', token_type: 'Way' }, { token: 'nw', token_type: 'Cardinal' }], display: 'S STREET NW' }, score: 100 }],
        'single winner w/ null tokenless');

    t.deepEquals(
        linker([{ tokenized: [{ token: 'w', token_type: 'Cardinal' }, { token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }], display: 'West Main Street' }], [
            { id: 388, name: { tokenized: [{ token: 'w', token_type: 'Cardinal' }, { token: 'st', token_type: null }, { token: 'st', token_type: 'Way' }], display: 'West Saint Street' } }
        ]),
        false,
        'close tokenized');

    t.deepEquals(
        linker([{ tokenized: [{ token: 'w', token_type: 'Cardinal' }, { token: 'st', token_type: null }, { token: 'st', token_type: 'Way' }], display: 'West Saint Street' }], [
            { id: 388, name: { tokenized: [{ token: 'w', token_type: 'Cardinal' }, { token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }], display: 'West Main Street' } }
        ]),
        false,
        'close tokenized reverse');

    t.deepEquals(
        linker([{ tokenized: [{ token: 's', token_type: null }, { token: 'st', token_type: null }, { token: 'nw', token_type: null }], display: 'S STREET NW' }], [
            { id: 2421, name: { tokenized: [{ token: 'n', token_type: 'Cardinal' }, { token: 'capitol', token_type: null }, { token: 'st', token_type: 'Way' }], display: 'North Capitol Street' } },
            { id: 669, name: { tokenized: [{ token: 't', token_type: null }, { token: 'st', token_type: null }, { token: 'ne', token_type: null }], display: 'T Street Northeast' } },
            { id: 630, name: { tokenized: [{ token: 'todd', token_type: null }, { token: 'pl', token_type: null }, { token: 'ne', token_type: null }], display: 'Todd Place Northeast' } },
            { id: 1007, name: { tokenized: [{ token: 'u', token_type: null }, { token: 'st', token_type: null }, { token: 'ne', token_type: null }], display: 'U Street Northeast' } },
            { id: 2286, name: { tokenized: [{ token: 'v', token_type: null }, { token: 'st', token_type: null }, { token: 'ne', token_type: null }], display: 'V Street Northeast' } },
            { id: 1026, name: { tokenized: [{ token: 'u', token_type: null }, { token: 'st', token_type: null }, { token: 'nw', token_type: null }], display: 'U STREET NW' } },
            { id: 680, name: { tokenized: [{ token: 't', token_type: null }, { token: 'st', token_type: null }, { token: 'nw', token_type: null }], display: 'T STREET NW' } },
            { id: 2231, name: { tokenized: [{ token: 'rhode', token_type: null }, { token: 'is', token_type: null }, { token: 'av', token_type: null }, { token: 'ne', token_type: null }], display: 'Rhode Island Avenue Northeast' } },
            { id: 1199, name: { tokenized: [{ token: 'n', token_type: null }, { token: 'capitol', token_type: null }, { token: 'st', token_type: null }, { token: 'ne', token_type: null }], display: 'North Capitol Street Northeast' } },
            { id: 2031, name: { tokenized: [{ token: 'n', token_type: null }, { token: 'capitol', token_type: null }, { token: 'st', token_type: null }, { token: 'nw', token_type: null }], display: 'NORTH CAPITOL STREET NW' } },
            { id: 224, name: { tokenized: [{ token: 'elm', token_type: null }, { token: 'st', token_type: null }, { token: 'nw', token_type: null }], display: 'Elm Street Northwest' } },
            { id: 388, name: { tokenized: [{ token: 'bates', token_type: null }, { token: 'st', token_type: null }, { token: 'nw', token_type: null }], display: 'BATES STREET NW' } },
            { id: 863, name: { tokenized: [{ token: 's', token_type: null }, { token: 'st', token_type: null }, { token: 'nw', token_type: null }], display: 'S STREET NW' } },
            { id: 1365, name: { tokenized: [{ token: 'rhode', token_type: null }, { token: 'is', token_type: null }, { token: 'av', token_type: null }, { token: 'nw', token_type: null }], display: 'RHODE ISLAND AVENUE NW' } },
            { id: 2366, name: { tokenized: [{ token: 'r', token_type: null }, { token: 'st', token_type: null }, { token: 'nw', token_type: null }], display: 'R STREET NW' } },
            { id: 189, name: { tokenized: [{ token: 'randolph', token_type: null }, { token: 'pl', token_type: null }, { token: 'ne', token_type: null }], display: 'Randolph Place Northeast' } },
            { id: 296, name: { tokenized: [{ token: 'rt', token_type: null }, { token: '1', token_type: null }], display: 'ROUTE 1' } },
            { id: 629, name: { tokenized: [{ token: 'lincoln', token_type: null }, { token: 'rd', token_type: null }, { token: 'ne', token_type: null }], display: 'Lincoln Road Northeast' } },
            { id: 1662, name: { tokenized: [{ token: 'quincy', token_type: null }, { token: 'pl', token_type: null }, { token: 'ne', token_type: null }], display: 'Quincy Place Northeast' } },
            { id: 852, name: { tokenized: [{ token: '1st', token_type: null }, { token: 'st', token_type: null }, { token: 'nw', token_type: null }], display: 'First Street Northwest' } },
            { id: 920, name: { tokenized: [{ token: 'porter', token_type: null }, { token: 'st', token_type: null }, { token: 'ne', token_type: null }], display: 'Porter Street Northeast' } },
            { id: 1037, name: { tokenized: [{ token: 'quincy', token_type: null }, { token: 'pl', token_type: null }, { token: 'nw', token_type: null }], display: 'Quincy Place Northwest' } },
            { id: 959, name: { tokenized: [{ token: 'florida', token_type: null }, { token: 'av', token_type: null }, { token: 'ne', token_type: null }], display: 'Florida Avenue Northeast' } },
            { id: 969, name: { tokenized: [{ token: 'richardson', token_type: null }, { token: 'pl', token_type: null }, { token: 'nw', token_type: null }], display: 'Richardson Place Northwest' } },
            { id: 1898, name: { tokenized: [{ token: '1st', token_type: null }, { token: 'st', token_type: null }, { token: 'ne', token_type: null }], display: 'First Street Northeast' } },
            { id: 1929, name: { tokenized: [{ token: 'q', token_type: null }, { token: 'st', token_type: null }, { token: 'ne', token_type: null }], display: 'Q Street Northeast' } },
            { id: 2053, name: { tokenized: [{ token: 'florida', token_type: null }, { token: 'av', token_type: null }, { token: 'nw', token_type: null }], display: 'Florida Ave NW' } },
            { id: 1250, name: { tokenized: [{ token: 'p', token_type: null }, { token: 'st', token_type: null }, { token: 'ne', token_type: null }], display: 'P Street Northeast' } },
            { id: 1243, name: { tokenized: [{ token: 's', token_type: null }, { token: 'st', token_type: null }, { token: 'ne', token_type: null }], display: 'S Street Northeast' } },
            { id: 1874, name: { tokenized: [{ token: 'r', token_type: null }, { token: 'st', token_type: null }, { token: 'ne', token_type: null }], display: 'R Street Northeast' } },
            { id: 2472, name: { tokenized: [{ token: 'seaton', token_type: null }, { token: 'pl', token_type: null }, { token: 'ne', token_type: null }], display: 'Seaton Place Northeast' } },
            { id: 1893, name: { tokenized: [{ token: 'randolph', token_type: null }, { token: 'pl', token_type: null }, { token: 'nw', token_type: null }], display: 'Randolph Place Northwest' } },
            { id: 2074, name: { tokenized: [{ token: 'anna', token_type: null }, { token: 'j', token_type: null }, { token: 'cooper', token_type: null }, { token: 'cir', token_type: null }, { token: 'nw', token_type: null }], display: 'Anna J Cooper Circle Northwest' } },
            { id: 69, name: { tokenized: [{ token: 'p', token_type: null }, { token: 'st', token_type: null }, { token: 'nw', token_type: null }], display: 'P STREET NW' } },
            { id: 2225, name: { tokenized: [{ token: 'q', token_type: null }, { token: 'st', token_type: null }, { token: 'nw', token_type: null }], display: 'Q STREET NW' } },
            { id: 424, name: { tokenized: [{ token: '4th', token_type: null }, { token: 'st', token_type: null }, { token: 'nw', token_type: null }], display: '4th Street Northwest' } },
            { id: 761, name: { tokenized: [{ token: 'v', token_type: null }, { token: 'st', token_type: null }, { token: 'nw', token_type: null }], display: 'V Street Northwest' } },
            { id: 1210, name: { tokenized: [{ token: '3rd', token_type: null }, { token: 'st', token_type: null }, { token: 'nw', token_type: null }], display: '3rd Street Northwest' } },
            { id: 1481, name: { tokenized: [{ token: 'seaton', token_type: null }, { token: 'pl', token_type: null }, { token: 'nw', token_type: null }], display: 'Seaton Place Northwest' } },
            { id: 460, name: { tokenized: [{ token: 'flagler', token_type: null }, { token: 'pl', token_type: null }, { token: 'nw', token_type: null }], display: 'Flagler Place Northwest' } },
            { id: 565, name: { tokenized: [{ token: '2nd', token_type: null }, { token: 'st', token_type: null }, { token: 'nw', token_type: null }], display: '2nd Street Northwest' } },
            { id: 2402, name: { tokenized: [{ token: 'thomas', token_type: null }, { token: 'st', token_type: null }, { token: 'nw', token_type: null }], display: 'Thomas Street Northwest' } }
        ]),
        [{ id: 863, name: { tokenized: [{ token: 's', token_type: null }, { token: 'st', token_type: null }, { token: 'nw', token_type: null }], display: 'S STREET NW' }, score: 100 }],
        'Ensure short circuiting never beats an exact match');
    t.end();
});

test('Failing Linker Matches', (t) => {
    t.deepEquals(
        linker([{ display: 'Main Street', tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: null }] }], [
            { id: 1, name: { display: 'Anne Boulevard', tokenized: [{ token: 'anne', token_type: null }, { token: 'blvd', token_type: null }] } }
        ]),
        false,
        'basic fail');

    t.end();
});

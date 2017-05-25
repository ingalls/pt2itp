const linker = require('../lib/linker');
const test = require('tape');

test('Passing Linker Matches', (t) => {
    t.deepEquals(
        linker({ text: 'main st' }, [
            { id: 1, text: 'main st' }
        ]),
        { id: 1, text: 'main st' },
    'basic match');

    t.deepEquals(
        linker({ text: 'main st' }, [
            { id: 1, text: 'maim st' },
        ]),
        { id: 1, text: 'maim st' },
    'close match');

    t.deepEquals(
        linker({ text: 'main st' }, [
            { id: 1, text: 'main st' },
            { id: 2, text: 'main av' },
            { id: 3, text: 'main rd' },
            { id: 4, text: 'main dr' }
        ]),
        { id: 1, text: 'main st' },
    'diff suff');

    t.deepEquals(
        linker({ text: 'main st' }, [
            { id: 1, text: 'main st' },
            { id: 2, text: 'asdg st' },
            { id: 3, text: 'asdg st' },
            { id: 4, text: 'maim st' }
        ]),
        { id: 1, text: 'main st' },
    'diff name');

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

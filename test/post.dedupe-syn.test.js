'use strict';

const tape = require('tape');
const { dedupe_syn } = require('../native/index.node');

tape('dedupe feature names', (t) => {

    t.deepEqual(
        dedupe_syn([
            { freq: 1, source: 'Address', display: 'Brandywine St NW', priority: 0, tokenized: [{ token: 'brandywine', 'token_type': null }, { token: 'st', 'token_type': 'Way' }, { token: 'nw', 'token_type': 'Cardinal' }] }
        ]),
        ['Brandywine St NW']
    );
    t.deepEqual(
        dedupe_syn([
            { freq: 1, source: 'Address', display: 'Main St', priority: 0, tokenized: [{ token: 'main', 'token_type': null }, { token: 'st', 'token_type': 'Way' }] },
            { freq: 1, source: 'Address', display: 'Main Street', priority: 0, tokenized: [{ token: 'main', 'token_type': null }, { token: 'st', 'token_type': 'Way' }] },
            { freq: 1, source: 'Address', display: 'E Main Av', priority: 0, tokenized: [{ token: 'e', 'token_type': 'Cardinal' }, { token: 'main', 'token_type': null }, { token: 'av', 'token_type': 'Way' }] },
            { freq: 1, source: 'Address', display: 'East Main Avenue', priority: 0, tokenized: [{ token: 'e', 'token_type': 'Cardinal' }, { token: 'main', 'token_type': null }, { token: 'av', 'token_type': 'Way' }] }
        ]),
        ['Main Street', 'East Main Avenue']
    );

    t.deepEqual(
        dedupe_syn([
            { freq: 1, source: 'Address', display: 'Main St', priority: 1, tokenized: [{ token: 'main', 'token_type': null }, { token: 'st', 'token_type': 'Way' }] },
            { freq: 1, source: 'Address', display: 'Main Street', priority: 0, tokenized: [{ token: 'main', 'token_type': null }, { token: 'st', 'token_type': 'Way' }] },
            { freq: 1, source: 'Address', display: 'E Main Av', priority: 1, tokenized: [{ token: 'e', 'token_type': 'Cardinal' }, { token: 'main', 'token_type': null }, { token: 'av', 'token_type': 'Way' }] },
            { freq: 1, source: 'Address', display: 'East Main Avenue', priority: 0, tokenized: [{ token: 'e', 'token_type': 'Cardinal' }, { token: 'main', 'token_type': null }, { token: 'av', 'token_type': 'Way' }] }
        ]),
        ['Main St', 'E Main Av']
    );

    t.deepEqual(
        dedupe_syn([
            { freq: 1, source: 'Address', display: 'Hwy 3', priority: -1, tokenized: [{ token: 'hwy', 'token_type': 'Way' }, { token: '3', 'token_type': 'Number' }] },
            { freq: 1, source: 'Address', display: 'Highway 3', priority: -1, tokenized: [{ token: 'hwy', 'token_type': 'Way' }, { token: '3', 'token_type': 'Number' }] },
            { freq: 1, source: 'Address', display: 'Hwy 2', priority: -1, tokenized: [{ token: 'hwy', 'token_type': 'Way' }, { token: '2', 'token_type': 'Number' }] },
            { freq: 2, source: 'Address', display: 'Hwy 2', priority: -1, tokenized: [{ token: 'hwy', 'token_type': 'Way' }, { token: '2', 'token_type': 'Number' }] },
            { freq: 3, source: 'Address', display: 'Hwy 1', priority: -1, tokenized: [{ token: 'hwy', 'token_type': 'Way' }, { token: '1', 'token_type': 'Number' }] },
            { freq: 1, source: 'Address', display: 'Hwy 1', priority: 0, tokenized: [{ token: 'hwy', 'token_type': 'Way' }, { token: '1', 'token_type': 'Number' }] }
        ]),
        ['Hwy 1', 'Hwy 2', 'Highway 3']
    );

    t.deepEqual(
        dedupe_syn([
            { display: 'NE M L King Blvd', priority: 0, source: 'Address', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'king', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1480 },
            { display: 'NE MARTIN LUTHER KING JR BLVD', priority: 0, source: 'Address', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 110 },
            { display: 'NE M L KING BLVD', priority: 0, source: 'Address', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'king', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 18 },
            { display: 'SE M L King Blvd', priority: 0, source: 'Address', tokenized: [{ token: 'se', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'king', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 7 },
            { display: 'N M L King Blvd', priority: 0, source: 'Address', tokenized: [{ token: 'n', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'king', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 3 },
            { display: 'SE MARTIN LUTHER KING JR BLVD', priority: 0, source: 'Address', tokenized: [{ token: 'se', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 2 },
            { display: 'NE MLK', priority: 0, source: 'Network', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'mlk', token_type: null }], freq: 1 },
            { display: 'Northeast Martin Luther King Junior Boulevard', priority: 0, source: 'Network', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'OR 99E', priority: 0, source: 'Network', tokenized: [{ token: 'or', token_type: null }, { token: '99e', token_type: null }], freq: 1 },
            { display: 'State Highway 99E', priority: 0, source: 'Network', tokenized: [{ token: 'state', token_type: null }, { token: 'hwy', token_type: 'Way' }, { token: '99e', token_type: null }], freq: 1 },
            { display: 'NE MLK Blvd', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'mlk', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE M L K Blvd', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'k', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE Martin Luther King Blvd', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE MLK Jr Blvd', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'mlk', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE M L K Jr Blvd', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'k', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE Martin Luther King Jr Blvd', priority: 1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE MLK BLVD', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'mlk', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE M L K BLVD', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'k', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE Martin Luther King BLVD', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE MLK Jr BLVD', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'mlk', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE M L K Jr BLVD', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'k', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE Martin Luther King Jr BLVD', priority: 1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE MLK BLVD', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'mlk', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE M L K BLVD', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'k', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE Martin Luther King BLVD', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE MLK Jr BLVD', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'mlk', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE M L K Jr BLVD', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'k', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE Martin Luther King Jr BLVD', priority: 1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'SE MLK Blvd', priority: -1, source: 'Generated', tokenized: [{ token: 'se', token_type: 'Cardinal' }, { token: 'mlk', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'SE M L K Blvd', priority: -1, source: 'Generated', tokenized: [{ token: 'se', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'k', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'SE Martin Luther King Blvd', priority: -1, source: 'Generated', tokenized: [{ token: 'se', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'SE MLK Jr Blvd', priority: -1, source: 'Generated', tokenized: [{ token: 'se', token_type: 'Cardinal' }, { token: 'mlk', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'SE M L K Jr Blvd', priority: -1, source: 'Generated', tokenized: [{ token: 'se', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'k', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'SE Martin Luther King Jr Blvd', priority: 1, source: 'Generated', tokenized: [{ token: 'se', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'N MLK Blvd', priority: -1, source: 'Generated', tokenized: [{ token: 'n', token_type: 'Cardinal' }, { token: 'mlk', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'N M L K Blvd', priority: -1, source: 'Generated', tokenized: [{ token: 'n', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'k', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'N Martin Luther King Blvd', priority: -1, source: 'Generated', tokenized: [{ token: 'n', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'N MLK Jr Blvd', priority: -1, source: 'Generated', tokenized: [{ token: 'n', token_type: 'Cardinal' }, { token: 'mlk', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'N M L K Jr Blvd', priority: -1, source: 'Generated', tokenized: [{ token: 'n', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'k', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'N Martin Luther King Jr Blvd', priority: 1, source: 'Generated', tokenized: [{ token: 'n', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'SE MLK BLVD', priority: -1, source: 'Generated', tokenized: [{ token: 'se', token_type: 'Cardinal' }, { token: 'mlk', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'SE M L K BLVD', priority: -1, source: 'Generated', tokenized: [{ token: 'se', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'k', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'SE Martin Luther King BLVD', priority: -1, source: 'Generated', tokenized: [{ token: 'se', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'SE MLK Jr BLVD', priority: -1, source: 'Generated', tokenized: [{ token: 'se', token_type: 'Cardinal' }, { token: 'mlk', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'SE M L K Jr BLVD', priority: -1, source: 'Generated', tokenized: [{ token: 'se', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'k', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'SE Martin Luther King Jr BLVD', priority: 1, source: 'Generated', tokenized: [{ token: 'se', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'NE MLK', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'mlk', token_type: null }], freq: 1 },
            { display: 'NE M L K', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'k', token_type: null }], freq: 1 },
            { display: 'NE Martin Luther King', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }], freq: 1 },
            { display: 'NE MLK Jr', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'mlk', token_type: null }, { token: 'jr', token_type: null }], freq: 1 },
            { display: 'NE M L K Jr', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'k', token_type: null }, { token: 'jr', token_type: null }], freq: 1 },
            { display: 'NE Martin Luther King Jr', priority: 1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'jr', token_type: null }], freq: 1 },
            { display: 'Northeast MLK Boulevard', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'mlk', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'Northeast M L K Boulevard', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'k', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'Northeast Martin Luther King Boulevard', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'Northeast MLK Jr Boulevard', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'mlk', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'Northeast M L K Jr Boulevard', priority: -1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'm', token_type: null }, { token: 'l', token_type: null }, { token: 'k', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 },
            { display: 'Northeast Martin Luther King Jr Boulevard', priority: 1, source: 'Generated', tokenized: [{ token: 'ne', token_type: 'Cardinal' }, { token: 'martin', token_type: null }, { token: 'luther', token_type: null }, { token: 'king', token_type: null }, { token: 'jr', token_type: null }, { token: 'blvd', token_type: 'Way' }], freq: 1 }
        ]),
        [
            'Northeast Martin Luther King Jr Boulevard',
            'SE Martin Luther King Jr Blvd',
            'N Martin Luther King Jr Blvd',
            'NE Martin Luther King Jr',
            'NE M L King Blvd',
            'SE M L King Blvd',
            'N M L King Blvd',
            'NE MLK',
            'OR 99E',
            'State Highway 99E',
            'Northeast MLK Boulevard',
            'Northeast M L K Boulevard',
            'Northeast Martin Luther King Boulevard',
            'Northeast MLK Jr Boulevard',
            'Northeast M L K Jr Boulevard',
            'SE MLK Blvd',
            'SE M L K Blvd',
            'SE Martin Luther King Blvd',
            'SE MLK Jr Blvd',
            'SE M L K Jr Blvd',
            'N MLK Blvd',
            'N M L K Blvd',
            'N Martin Luther King Blvd',
            'N MLK Jr Blvd',
            'N M L K Jr Blvd',
            'NE M L K',
            'NE Martin Luther King',
            'NE MLK Jr',
            'NE M L K Jr'
        ]
    );

    t.end();
});

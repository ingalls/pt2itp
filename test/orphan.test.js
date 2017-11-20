const Orphan = require('../lib/orphan');
const Post = require('../lib/post');
const Index = require('../lib/index');

const test = require('tape');
const fs = require('fs');
const path = require('path');
const pg = require('pg');
const Queue = require('d3-queue').queue;
const readline = require('readline');
const output = fs.createWriteStream(path.resolve(__dirname, '../test/fixtures/orphan-output.geojson'));

const pool = new pg.Pool({
    max: 10,
    user: 'postgres',
    database: 'pt_test',
    idleTimeoutMillis: 30000
});

const index = new Index(pool);

test('Drop/Init Database', (t) => {
    index.init((err, res) => {
        t.error(err);
        t.end();
    });
});

test.skip('orphan.init with invalid options', (t) => {
    // can't 'catch' this because it's a console.error :(
    try {
        let opts = {tokens: ['fr']};
        const invalidOrphan = new Orphan(pool, opts);
    } catch (err) {
        t.ok(err, 'invalid Orphan options throw error');
        t.equal(err.message, 'WARN: map.orphanAddr() using titlecase behavior, which is current English-only, on non-English data', 'has error message about non-english tokens');
        t.end();
    }
});

test('orphan.init with valid options', (t) => {
    let opts = {tokens: ['en']};
    const validOrphan = new Orphan(pool, opts);
    t.equal(typeof validOrphan.label, 'function', 'orphan initiated succesfully');
    t.end();
});

test('orphan.address', (t) => {
    const post = new Post();
    const orphan = new Orphan(pool, {}, output, post);
    const popQ = new Queue(1);

    // populate address
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO address (id, text, text_tokenless, _text, number, geom, netid) VALUES (1, 'main st se', 'main', 'Main Street SE', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-66.97265625,43.96119063892024, 1] }'), 4326), 1);
            INSERT INTO address (id, text, text_tokenless, _text, number, geom, netid) VALUES (2, 'main st se', 'main', 'Main Street SE', 12, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-66.97265625,43.96119063892024, 2] }'), 4326), 1);
            INSERT INTO address (id, text, text_tokenless, _text, number, geom, netid) VALUES (6, 'main st se', 'main', 'Main Street SE', 14, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-66.97265625,43.96119063892024, 6] }'), 4326), 1);
            INSERT INTO address (id, text, text_tokenless, _text, number, geom, netid) VALUES (3, 'main st', 'main', 'Main Street', 13, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-105.46875,56.36525013685606, 3] }'), 4326), NULL);
            INSERT INTO address (id, text, text_tokenless, _text, number, geom, netid) VALUES (4, 'main st', 'main', 'Main Street', 15, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-105.46875,56.36525013685606, 4] }'), 4326), NULL);
            INSERT INTO address (id, text, text_tokenless, _text, number, geom, netid) VALUES (5, 'fake av', 'fake', 'Fake Avenue', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-85.25390625,52.908902047770255, 5] }'), 4326), NULL);
            COMMIT;
        `, (err, res) => {
            t.error(err, 'ok - added addresses to table');
            return done();
        });
    });

    // call orphan.address
    popQ.defer((done) => {
        orphan.address((err) => {
            t.error(err);
            return done();
        });
    });

    // check address_orphan_cluster
    popQ.defer((done) => {
        pool.query(`
            SELECT _text FROM address_orphan_cluster ORDER BY _text;
        `, (err, res) => {
            t.error(err);

            t.equals(res.rows.length, 2, 'ok - correct number of orphans');
            t.deepEquals(res.rows[0], {_text: 'Fake Avenue'}, 'ok - Fake Ave orphaned');
            t.deepEquals(res.rows[1], {_text: 'Main Street'}, 'ok - Main St orphaned');
            return done();
        });
    });

    popQ.await((err) => {
        t.error(err);
        output.end();
        t.end();
    });
});

test('Drop/Init Database', (t) => {
    index.init((err, res) => {
        t.error(err);
        t.end();
    });
});

test('orphan output', (t) => {
    let counter = 0;
    const orphans = {
        'Main Street': [['3','4']],
        'Fake Avenue': [['5']]
    };

    const rl = readline.createInterface({
        input : fs.createReadStream(path.resolve(__dirname, '../test/fixtures/orphan-output.geojson')),
    })
    rl.on('line', (line) => {
        if (!line) return;
        counter++;
        let feat = JSON.parse(line);
        t.deepEquals(feat.properties["carmen:addressnumber"], orphans[feat.properties["carmen:text"]], 'ok - orphan has correct addresses');
    })

    rl.on('close', () => {
        t.equals(counter, 2, 'ok - output had correct number of orphan clusters');
        t.end();
    });
});

test('end connection', (t) => {
    pool.end();
    t.end();
});

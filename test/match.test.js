const match = require('../lib/map/match');

const test = require('tape');
const pg = require('pg');
const Queue = require('d3-queue').queue;
const Index = require('../lib/map/index');
const pg_init = require('../native/index.node').pg_init;
const pg_optimize = require('../native/index.node').pg_optimize;

const pool = new pg.Pool({
    max: 10,
    user: 'postgres',
    database: 'pt_test',
    idleTimeoutMillis: 30000
});

const index = new Index(pool);

test('Drop/Init Database', (t) => {
    pg_init();

    index.init((err, res) => {
        t.error(err);
        t.end();
    });
});

test('Match', (t) => {
    const popQ = new Queue(1);

    //POPULATE NETWORK_CLUSTER
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO network_cluster (id, name, geom) VALUES (1, '[{ "tokenized": "main st", "tokenless": "main", "display": "Main Street" }]', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "LineString", "coordinates": [ [ -66.05180561542511, 45.26869136632906, 1 ], [ -66.05007290840149, 45.268982070325656, 1 ] ] }'), 4326)));
            COMMIT;
        `, (err, res) => {
            t.error(err);
            return done();
        });
    });

    //POPULATE Address
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO address (names, number, geom) VALUES ('[{ "tokenized": "main st", "tokenless": "main", "display": "Main Street" }]', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -66.05154812335967, 45.26861208316249 ] }'), 4326));
            INSERT INTO address (names, number, geom) VALUES ('[{ "tokenized": "fake av", "tokenless": "fake", "display": "Fake Avenue" }]', 12, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -66.05154812335967, 45.26861208316249 ] }'), 4326));
            COMMIT;
        `, (err, res) => {
            t.error(err);

            pg_optimize();

            return done();
        });
    });

    popQ.defer((done) => {
        match.init({
            pool: {
                max: 10,
                user: 'postgres',
                database: 'pt_test',
                idleTimeoutMillis: 30000
            }
        });
        return done();
    });

    popQ.defer((done) => {
        match.main(1, 2, (err) => {
            t.error(err);
            return done();
        });
    });

    popQ.defer((done) => {
        pool.query(`
            SELECT id, names, netid FROM address ORDER BY id;
        `, (err, res) => {
            t.error(err);

            t.deepEquals(res.rows[0], {
                id: '1',
                names: [ { display: 'Main Street', tokenized: 'main st', tokenless: 'main' } ],
                netid: '1'
            });

            t.deepEquals(res.rows[1], {
                id: '2',
                names: [ { display: 'Fake Avenue', tokenized: 'fake av', tokenless: 'fake' } ],
                netid: null
            });

            return done();
        });
    });

    popQ.await((err) => {
        t.error(err);
        t.end();
    });
});

test('Drop/Init Database', (t) => {
    pg_init();

    index.init((err, res) => {
        t.error(err);
        t.end();
    });
});

test('end connection', (t) => {
    pool.end();
    match.kill();
    t.end();
});

const Cluster = require('../lib/map/cluster');
const Index = require('../lib/map/index');
const pg_init = require('../native/index.node').pg_init;
const pg_optimize = require('../native/index.node').pg_optimize;

const test = require('tape');
const fs = require('fs');
const pg = require('pg');
const Queue = require('d3-queue').queue;

const db = require('./lib/db');
db.init(test);

const pool = new pg.Pool({
    max: 10,
    user: 'postgres',
    database: 'pt_test',
    idleTimeoutMillis: 30000
});

const index = new Index(pool);
const cluster = new Cluster({ pool: pool });

test('Drop/Init Database', (t) => {
    pg_init();

    index.init((err, res) => {
        t.error(err);
        t.end();
    });
});

test('Points are clustered on netid', (t) => {
    const popQ = new Queue(1);

    //POPULATE ADDRESS
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO address (id, netid, names, number, geom) VALUES (1, 1, '[{ "tokenized": "main st", "tokenless": "main", "display": "Main Street" }]', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point","coordinates": [9.505233764648438,47.13018433161339 ] }'), 4326));
            INSERT INTO address (id, netid, names, number, geom) VALUES (2, 1, '[{ "tokenized": "main st", "tokenless": "main", "display": "Main Street" }]', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point","coordinates": [9.523429870605469,47.130797460977575 ] }'), 4326));
            COMMIT;
        `, (err, res) => {
            t.error(err);

            pg_optimize();

            return done();
        });
    });

    popQ.defer((done) => {
        cluster.address((err) => {
            t.error(err);
            return done();
        });
    });

    popQ.await((err) => {
        t.error(err);

        pool.query(`
            SELECT
                ST_AsGeoJSON(geom)::JSON AS geom,
                name
            FROM
                address_cluster;
        `, (err, res) => {
            t.error(err);
            t.deepEquals(res.rows[0].geom, { type: 'MultiPoint', coordinates: [[9.50523376464844,47.1301843316134,1],[9.52342987060547,47.1307974609776,2]]});
            t.deepEquals(res.rows[0].name, [ { freq: 2, display: 'Main Street', tokenized: 'main st', tokenless: 'main' } ]);

            t.end();
        });
    });
});

test('Drop/Init Database', (t) => {
    pg_init();

    index.init((err, res) => {
        t.error(err);
        t.end();
    });
});

test('LineStrings far away should not be clustered', (t) => {
    const popQ = new Queue(1);

    //POPULATE NETWORK
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO network (id, names, geom) VALUES (1, '[{ "tokenized": "main st", "tokeneless": "main", "display": "Main Street", "freq": 1 }]', ST_SetSRID(ST_GeomFromGeoJSON('{"type": "MultiLineString", "coordinates": [[[9.50514793395996,47.13027192195532],[9.50094223022461,47.13027192195532]]]}'), 4326));
            INSERT INTO network (id, names, geom) VALUES (2, '[{ "tokenized": "main st", "tokeneless": "main", "display": "Main Street", "freq": 1 }]', ST_SetSRID(ST_GeomFromGeoJSON('{"type": "MultiLineString", "coordinates": [[[9.523429870605469,47.1308412556617],[9.527077674865723,47.13091424672175]]]}'), 4326));
            COMMIT;
        `, (err, res) => {
            t.error(err);

            pg_optimize();

            return done();
        });
    });

    popQ.defer((done) => {
        cluster.network((err) => {
            t.error(err);
            return done();
        });
    });

    popQ.await((err) => {
        t.error(err);

        pool.query(`
            SELECT
                ST_AsGeoJSON(geom)::JSON as geom,
                name
            FROM
                network_cluster
            ORDER BY
                id
        `, (err, res) => {
            t.error(err);
            t.deepEquals(res.rows[0].geom, { type: 'MultiLineString', coordinates: [ [ [ 9.50514793395996, 47.1302719219553 ], [ 9.50094223022461, 47.1302719219553 ] ] ] })
            t.deepEquals(res.rows[0].name, [{ freq: 1, display: 'Main Street', tokenized: 'main st', tokeneless: 'main' }]);

            t.deepEquals(res.rows[1].geom, { type: 'MultiLineString', coordinates: [ [ [ 9.52342987060547, 47.1308412556617 ], [ 9.52707767486572, 47.1309142467218 ] ] ] })
            t.deepEquals(res.rows[1].name, [{ freq: 1, display: 'Main Street', tokenized: 'main st', tokeneless: 'main' }]);
            t.end();
        });
    });
});

test('Drop/Init Database', (t) => {
    pg_init();

    index.init((err, res) => {
        t.error(err);
        t.end();
    });
});

test('LinesStrings should be clustered', (t) => {
    const popQ = new Queue(1);

    //POPULATE ADDRESS
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO network (id, names, geom) VALUES (1, '[{ "tokenized": "main st", "tokeneless": "main", "display": "Main Street", "freq": 1 }]', ST_SetSRID(ST_GeomFromGeoJSON('{"type": "MultiLineString","coordinates": [[[9.516735076904297,47.13276818606133],[9.519824981689451,47.132870369814995]]]}'), 4326));
            INSERT INTO network (id, names, geom) VALUES (2, '[{ "tokenized": "main st", "tokeneless": "main", "display": "Main Street", "freq": 1 }]', ST_SetSRID(ST_GeomFromGeoJSON('{"type": "MultiLineString", "coordinates": [[[9.513999223709106,47.132695197545665],[9.512518644332886,47.132695197545665]]]},'), 4326));
            COMMIT;
        `, (err, res) => {
            t.error(err);

            pg_optimize();

            return done();
        });
    });

    popQ.defer((done) => {
        cluster.network((err) => {
            t.error(err);
            return done();
        });
    });

    popQ.await((err) => {
        t.error(err);

        pool.query(`
            SELECT
                ST_AsGeoJSON(geom)::JSON as geom,
                name
            FROM
                network_cluster
            ORDER BY
                id DESC;
        `, (err, res) => {
            t.error(err);

            t.deepEquals(res.rows[0].geom, { type: 'MultiLineString', coordinates: [ [ [ 9.5167350769043, 47.1327681860613 ], [ 9.51982498168945, 47.132870369815 ] ], [ [ 9.51399922370911, 47.1326951975457 ], [ 9.51251864433289, 47.1326951975457 ] ] ] });
            t.deepEquals(res.rows[0].name, [{ freq: 1, display: 'Main Street', tokenized: 'main st', tokeneless: 'main' }]);
            t.end();
        });
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
     t.end();
});

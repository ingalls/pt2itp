'use strict';

const pg_optimize = require('../native/index.node').pg_optimize;
const {
    cluster_addr,
    cluster_net
} = require('../native/index.node');

const test = require('tape');
const Queue = require('d3-queue').queue;

const db = require('./lib/db');

db.init(test);

test('Points are clustered on netid', (t) => {
    const popQ = new Queue(1);

    const pool = db.get();

    // POPULATE ADDRESS
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO address (id, netid, names, number, geom) VALUES (1, 1, '[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way" }], "display": "Main Street", "priority": 0, "freq": 1 }]', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point","coordinates": [9.505233764648438,47.13018433161339 ] }'), 4326));
            INSERT INTO address (id, netid, names, number, geom) VALUES (2, 1, '[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way" }], "display": "Main Street", "priority": 0, "freq": 1 }]', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point","coordinates": [9.523429870605469,47.130797460977575 ] }'), 4326));
            COMMIT;
        `, (err) => {
            t.error(err);

            pg_optimize();

            return done();
        });
    });

    popQ.defer((done) => {
        cluster_addr('pt_test');

        done();
    });

    popQ.await((err) => {
        t.error(err);

        pool.query(`
            SELECT
                ST_AsGeoJSON(geom)::JSON AS geom,
                names
            FROM
                address_cluster;
        `, (err, res) => {
            t.error(err);
            t.deepEquals(res.rows[0].geom, { type: 'MultiPoint', coordinates: [[9.50523376464844,47.1301843316134,1],[9.52342987060547,47.1307974609776,2]] });
            t.deepEquals(res.rows[0].names, [{ freq: 2, display: 'Main Street', priority: 0, tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] }]);

            pool.end(() => {
                t.end();
            });
        });
    });
});

db.init(test);

test('LineStrings far away should not be clustered', (t) => {
    const pool = db.get();

    const popQ = new Queue(1);

    // POPULATE NETWORK
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO network (id, names, geom) VALUES (1, '[{ "tokenized": "main st", "tokeneless": "main", "display": "Main Street", "freq": 1 }]', ST_SetSRID(ST_GeomFromGeoJSON('{"type": "MultiLineString", "coordinates": [[[9.50514793395996,47.13027192195532],[9.50094223022461,47.13027192195532]]]}'), 4326));
            INSERT INTO network (id, names, geom) VALUES (2, '[{ "tokenized": "main st", "tokeneless": "main", "display": "Main Street", "freq": 1 }]', ST_SetSRID(ST_GeomFromGeoJSON('{"type": "MultiLineString", "coordinates": [[[9.523429870605469,47.1308412556617],[9.527077674865723,47.13091424672175]]]}'), 4326));
            COMMIT;
        `, (err) => {
            t.error(err);

            pg_optimize();

            return done();
        });
    });

    popQ.defer((done) => {
        cluster_net('pt_test');

        done();
    });

    popQ.await((err) => {
        t.error(err);

        pool.query(`
            SELECT
                ST_AsGeoJSON(geom)::JSON as geom,
                names
            FROM
                network_cluster
            ORDER BY
                id
        `, (err, res) => {
            t.error(err);
            t.deepEquals(res.rows[0].geom, { type: 'MultiLineString', coordinates: [[[9.50514793395996, 47.1302719219553], [9.50094223022461, 47.1302719219553]]] });
            t.deepEquals(res.rows[0].names, [{ freq: 1, display: 'Main Street', tokenized: 'main st', tokeneless: 'main' }]);

            t.deepEquals(res.rows[1].geom, { type: 'MultiLineString', coordinates: [[[9.52342987060547, 47.1308412556617], [9.52707767486572, 47.1309142467218]]] });
            t.deepEquals(res.rows[1].names, [{ freq: 1, display: 'Main Street', tokenized: 'main st', tokeneless: 'main' }]);

            pool.end(() => {
                t.end();
            });
        });
    });
});

db.init(test);

test('LinesStrings should be clustered', (t) => {
    const pool = db.get();
    const popQ = new Queue(1);

    // POPULATE ADDRESS
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO network (id, names, geom) VALUES (1, '[{ "tokenized": "main st", "tokeneless": "main", "display": "Main Street", "freq": 1 }]', ST_SetSRID(ST_GeomFromGeoJSON('{"type": "MultiLineString","coordinates": [[[9.516735076904297,47.13276818606133],[9.519824981689451,47.132870369814995]]]}'), 4326));
            INSERT INTO network (id, names, geom) VALUES (2, '[{ "tokenized": "main st", "tokeneless": "main", "display": "Main Street", "freq": 1 }]', ST_SetSRID(ST_GeomFromGeoJSON('{"type": "MultiLineString", "coordinates": [[[9.513999223709106,47.132695197545665],[9.512518644332886,47.132695197545665]]]},'), 4326));
            COMMIT;
        `, (err) => {
            t.error(err);

            pg_optimize();

            return done();
        });
    });

    popQ.defer((done) => {
        cluster_net('pt_test');
        done();
    });

    popQ.await((err) => {
        t.error(err);

        pool.query(`
            SELECT
                ST_AsGeoJSON(geom)::JSON as geom,
                names
            FROM
                network_cluster
            ORDER BY
                id DESC;
        `, (err, res) => {
            t.error(err);

            t.deepEquals(res.rows[0].geom, { type: 'MultiLineString', coordinates: [[[9.5167350769043, 47.1327681860613], [9.51982498168945, 47.132870369815]], [[9.51399922370911, 47.1326951975457], [9.51251864433289, 47.1326951975457]]] });
            t.deepEquals(res.rows[0].names, [{ freq: 1, display: 'Main Street', tokenized: 'main st', tokeneless: 'main' }]);
            pool.end(() => {
                t.end();
            });
        });
    });
});

db.init(test);

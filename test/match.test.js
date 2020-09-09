'use strict';

const test = require('tape');
const Queue = require('d3-queue').queue;
const {
    pg_optimize,
    link_addr
} = require('../native/index.node');

const db = require('./lib/db');

db.init(test);

test('Match', (t) => {
    const pool = db.get();
    const popQ = new Queue(1);

    // POPULATE NETWORK_CLUSTER
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO network_cluster (id, names, geom) VALUES (1, '[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way"}], "display": "Main Street", "priority": 0, "freq": 1 }]', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "LineString", "coordinates": [ [ -66.05180561542511, 45.26869136632906, 1 ], [ -66.05007290840149, 45.268982070325656, 1 ] ] }'), 4326)));
            COMMIT;
        `, (err) => {
            t.error(err);
            return done();
        });
    });

    // POPULATE Address
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO address (names, number, geom) VALUES ('[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way"}], "display": "Main Street", "priority": 0, "freq": 1 }]', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -66.05154812335967, 45.26861208316249 ] }'), 4326));
            INSERT INTO address (names, number, geom) VALUES ('[{ "tokenized": [{ "token": "fake", "token_type": null }, { "token": "av", "token_type": "Way"}], "display": "Fake Avenue", "priority": 0, "freq": 1 }]', 12, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -66.05154812335967, 45.26861208316249 ] }'), 4326));
            INSERT INTO address (names, number, geom, interpolate) VALUES ('[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way"}], "display": "Main Street", "priority": 0, "freq": 1 }]', 100, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -66.05154812335967, 45.26861208316249 ] }'), 4326), 'false');
            COMMIT;
        `, (err) => {
            t.error(err);

            pg_optimize();

            return done();
        });
    });

    popQ.defer((done) => {
        link_addr('pt_test');

        return done();
    });

    popQ.defer((done) => {
        pool.query(`
            SELECT id, names, netid FROM address ORDER BY id;
        `, (err, res) => {
            t.error(err);

            t.deepEquals(res.rows[0], {
                id: '1',
                names: [{
                    priority: 0,
                    freq: 1,
                    display: 'Main Street',
                    tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }]
                }],
                netid: '1'
            });

            t.deepEquals(res.rows[1], {
                id: '2',
                names: [{
                    priority: 0,
                    freq: 1,
                    display: 'Fake Avenue',
                    tokenized: [{ token: 'fake', token_type: null }, { token: 'av', token_type: 'Way' }]
                }],
                netid: null
            });

            t.deepEquals(res.rows[2], {
                id: '3',
                names: [{
                    priority: 0,
                    freq: 1,
                    display: 'Main Street',
                    tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }]
                }],
                number: 100,
                interpolate: false,
                netid: null
            });

            return done();
        });
    });

    popQ.await((err) => {
        t.error(err);

        pool.end(t.end);
    });
});

db.init(test);

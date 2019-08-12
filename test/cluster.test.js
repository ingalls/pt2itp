'use strict';

const pg_optimize = require('../native/index.node').pg_optimize;
const {
    cluster_net,
    cluster_addr
} = require('../native/index.node');

const test = require('tape');
const Queue = require('d3-queue').queue;

const db = require('./lib/db');

db.init(test);

test('cluster.address', (t) => {
    const pool = db.get();
    const popQ = new Queue(1);

    // POPULATE ADDRESS
    popQ.defer((done) => {
        pool.query(`
            BEGIN;

            INSERT INTO address (id, names, number, geom, netid) VALUES (1, '[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way" }], "display": "Main Street", "priority": 0, "freq": 1 }]', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-66.97265625,43.96119063892024] }'), 4326), 1);
            INSERT INTO address (id, names, number, geom, netid) VALUES (2, '[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way" }], "display": "Main Street", "priority": 0, "freq": 1 }]', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-66.97265625,43.96119063892024] }'), 4326), 1);
            INSERT INTO address (id, names, number, geom, netid) VALUES (3, '[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way" }], "display": "Main Street", "priority": 0, "freq": 1 }]', 13, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-105.46875,56.36525013685606] }'), 4326), 3);
            INSERT INTO address (id, names, number, geom, netid) VALUES (4, '[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way" }], "display": "Main Street", "priority": 0, "freq": 1 }]', 13, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-105.46875,56.36525013685606] }'), 4326), 3);
            INSERT INTO address (id, names, number, geom, netid) VALUES (5, '[{ "tokenized": [{ "token": "fake", "token_type": null }, { "token": "av", "token_type": "Way" }], "display": "Fake Avenue", "priority": 0, "freq": 1 }]', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-85.25390625,52.908902047770255] }'), 4326), 2);
            INSERT INTO address (id, names, number, geom, netid) VALUES (6, '[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way" }], "display": "Main Street", "priority": 0, "freq": 1 }]', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-66.97265625,43.96119063892024] }'), 4326), 1);

            COMMIT;
        `, (err) => {
            t.error(err, 'no errors');

            pg_optimize();

            return done();
        });
    });

    popQ.defer((done) => {
        cluster_addr('pt_test');

        done();
    });

    popQ.defer((done) => {
        pool.query(`
            SELECT
                names,
                ST_AsGeoJSON(geom)::JSON AS geom
            FROM
                address_cluster
            ORDER BY
                ST_NumGeometries(geom);
        `, (err, res) => {
            t.error(err, 'no errors');

            t.equals(res.rows.length, 3);
            t.deepEquals(res.rows[0], { geom: { type: 'MultiPoint','coordinates':[[-85.25390625,52.9089020477703,5]] }, names: [{ freq: 1, tokenized: [{ token: 'fake', token_type: null }, { token: 'av', token_type: 'Way' }], display: 'Fake Avenue', priority: 0 }] });
            t.deepEquals(res.rows[1], { geom: { 'type':'MultiPoint','coordinates':[[-105.46875,56.3652501368561,3],[-105.46875,56.3652501368561,4]] }, names: [{ freq: 2, tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }], display: 'Main Street', priority: 0 }] });
            t.deepEquals(res.rows[2], { geom: { coordinates: [[-66.97265625, 43.9611906389202, 1], [-66.97265625, 43.9611906389202, 2], [-66.97265625, 43.9611906389202, 6]], type: 'MultiPoint' }, names: [{ freq: 3, tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }], display: 'Main Street', priority: 0 }] });

            return done();
        });
    });

    popQ.await((err) => {
        t.error(err, 'no errors');

        pool.end(() => {
            t.end();
        });
    });
});

db.init(test);

test('cluster.address - order synonyms by address count', (t) => {
    const pool = db.get();
    const popQ = new Queue(1);

    popQ.defer((done) => {
        pool.query(`
            BEGIN;

            INSERT INTO address (id, names, number, netid, geom) VALUES (21, '[{ "tokenized": [{ "token": "mill", "token_type": null }, { "token": "st", "token_type": "Way" }, { "token": "nw", "token_type": "Cardinal" }], "display": "Mill Street NW", "priority": 0, "freq": 1 }]', 12, 20, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -85.41056871414183, 41.8005111239637 ] }'), 4326));
            INSERT INTO address (id, names, number, netid, geom) VALUES (22, '[{ "tokenized": [{ "token": "mill", "token_type": null }, { "token": "st", "token_type": "Way" }, { "token": "nw", "token_type": "Cardinal" }], "display": "Mill Street NW", "priority": 0, "freq": 1 }]', 13, 20, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -85.41054725646971, 41.801102975153974 ] }'), 4326));

            INSERT INTO address (id, names, number, netid, geom) VALUES (23, '[{ "tokenized": [{ "token": "r", "token_type": null }, { "token": "st", "token_type": "Way" }, { "token": "nw", "token_type": "Cardinal" }], "display": "R Street NW", "priority": 0, "freq": 1 }]', 10, 20, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -85.41816473007202, 41.80102299558284 ] }'), 4326));
            INSERT INTO address (id, names, number, netid, geom) VALUES (24, '[{ "tokenized": [{ "token": "r", "token_type": null }, { "token": "st", "token_type": "Way" }, { "token": "nw", "token_type": "Cardinal" }], "display": "R Street NW", "priority": 0, "freq": 1 }]', 11, 20, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -85.4172420501709, 41.80103899150505 ] }'), 4326));
            INSERT INTO address (id, names, number, netid, geom) VALUES (25, '[{ "tokenized": [{ "token": "r", "token_type": null }, { "token": "st", "token_type": "Way" }, { "token": "nw", "token_type": "Cardinal" }], "display": "R Street NW", "priority": 0, "freq": 1 }]', 12, 20, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -85.41599750518799, 41.801166958738996 ] }'), 4326));


            COMMIT;
        `, (err) => {
            t.error(err, 'no errors');

            pg_optimize();

            return done();
        });
    });

    popQ.defer((done) => {
        cluster_addr('pt_test');
        done();
    });

    popQ.defer((done) => {
        // check that text has r st, then mill st
        pool.query(`
            SELECT
                id,
                names
            FROM
                address_cluster
            ORDER BY
                id;
        `, (err, res) => {
            t.error(err, 'no errors');

            t.equals(res.rows.length, 1, 'one address cluster');

            t.deepEquals(res.rows[0].names, [{
                display: 'R Street NW',
                tokenized: [{ token: 'r', token_type: null }, { token: 'st', token_type: 'Way' }, { token: 'nw', token_type: 'Cardinal' }],
                freq: 3,
                priority: 0
            },{
                display: 'Mill Street NW',
                tokenized: [{ token: 'mill', token_type: null }, { token: 'st', token_type: 'Way' }, { token: 'nw', token_type: 'Cardinal' }],
                freq: 2,
                priority: 0
            }], 'address cluster text ordered by number of addresses');

            return done();
        });
    });

    popQ.await((err) => {
        t.error(err, 'no errors');
        pool.end(() => {
            t.end();
        });
    });
});

db.init(test);

test('cluster.network', (t) => {
    const pool = db.get();
    const popQ = new Queue(1);

    // POPULATE NETWORK
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO network (names, geom) VALUES ('[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way" }], "display": "Main Street", "freq": 1, "priority": 0 }]', ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "MultiLineString", "coordinates": [ [ [ -66.05390310287476, 45.26961632842303 ], [ -66.05441808700562, 45.271035832768376 ] ] ]}'), 4326));
            INSERT INTO network (names, geom) VALUES ('[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way" }], "display": "Main Street", "freq": 1, "priority": 0 }]', ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "MultiLineString", "coordinates": [ [ [ -66.05435371398926, 45.27100563091792 ], [ -66.05493307113646, 45.27245530161207 ] ] ]}'), 4326));
            INSERT INTO network (names, geom) VALUES ('[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way" }], "display": "Main Street", "freq": 1, "priority": 0 }]', ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "MultiLineString", "coordinates": [ [ [ -113.50117206573485, 53.55137413785917 ], [ -113.50112915039062, 53.54836549323335 ] ] ]}'), 4326));
            INSERT INTO network (names, geom) VALUES ('[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way" }], "display": "Main Street", "freq": 1, "priority": 0 }]', ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "MultiLineString", "coordinates": [ [ [ -113.50100040435791, 53.54836549323335 ], [ -113.50104331970215, 53.54614711825744 ] ] ]}'), 4326));
            COMMIT;
        `, (err) => {
            t.error(err, 'no errors');

            pg_optimize();

            return done();
        });
    });

    popQ.defer((done) => {
        cluster_net('pt_test');
        done();
    });

    popQ.defer((done) => {
        pool.query(`
            SELECT
                id,
                names,
                ST_AsGeoJSON(geom)::JSON AS geom,
                source_ids
            FROM
                network_cluster
            ORDER BY
                id ASC;
        `, (err, res) => {
            t.error(err, 'no errors');

            t.equals(res.rows.length, 2);

            t.deepEquals(res.rows[0], {
                id: 1,
                names: [{
                    freq: 1,
                    tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }],
                    display: 'Main Street',
                    priority: 0
                }],
                geom: {
                    type: 'MultiLineString',
                    coordinates: [[[-66.0539031028748, 45.269616328423], [-66.0544180870056, 45.2710358327684]], [[-66.0543537139893, 45.2710056309179], [-66.0549330711365, 45.2724553016121]]]
                },
                source_ids: ['1', '2']
            });

            t.deepEquals(res.rows[1], {
                id: 2,
                geom: {
                    type: 'MultiLineString',
                    coordinates: [[[-113.501172065735, 53.5513741378592], [-113.501129150391, 53.5483654932333]], [[-113.501000404358, 53.5483654932333], [-113.501043319702, 53.5461471182574]]]
                },
                names: [{
                    freq: 1,
                    tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }],
                    display: 'Main Street',
                    priority: 0
                }],
                source_ids: ['3', '4']
            });


            return done();
        });
    });

    popQ.await((err) => {
        t.error(err, 'no errors');
        pool.end(() => {
            t.end();
        });
    });
});

db.init(test);

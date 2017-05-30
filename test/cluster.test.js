const Cluster = require('../lib/cluster');

const test = require('tape');
const fs = require('fs');
const pg = require('pg');
const Queue = require('d3-queue').queue;

const pool = new pg.Pool({
    max: 10,
    user: 'postgres',
    database: 'pt_test',
    idleTimeoutMillis: 30000
});

const cluster = new Cluster(pool);

test('cluster.name', (t) => {
    const popQ = Queue(1);

    //CREATE pt2itp TABLES
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            CREATE TABLE address (id SERIAL, text TEXT, text_tokenless TEXT, _text TEXT, number INT, geom GEOMETRY(POINT, 4326));
            CREATE TABLE address_cluster (id SERIAL, text TEXT, text_tokenless TEXT, _text TEXT, number TEXT, geom GEOMETRY(MULTIPOINT, 4326));
            CREATE TABLE network (id SERIAL, text TEXT, text_tokenless TEXT, _text TEXT, named BOOLEAN, geom GEOMETRY(LINESTRING, 4326));
            CREATE TABLE network_cluster (id SERIAL, text TEXT, text_tokenless TEXT, _text TEXT, address INT, geom GEOMETRY(MULTILINESTRING, 4326), buffer GEOMETRY(POLYGON, 4326));
            COMMIT;
        `, (err, res) => {
            t.error(err);
            return done();
        });
    });

    //POPULATE NETWORK
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO network (id, geom) VALUES (1, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "LineString", "coordinates": [ [ -66.05180561542511, 45.26869136632906 ], [ -66.05007290840149, 45.268982070325656 ] ] }'), 4326));
            COMMIT;
        `, (err, res) => {
            t.error(err);
            return done();
        });
    });

    //POPULATE ADDRESS
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO address (id, text, text_tokenless, _text, number, geom) VALUES (1, 'main st', 'main', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -66.05154812335967, 45.26861208316249 ] }'), 4326));
            INSERT INTO address (id, text, text_tokenless, _text, number, geom) VALUES (2, 'main st', 'main', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -66.05125308036804, 45.26868759094269 ] }'), 4326));
            INSERT INTO address (id, text, text_tokenless, _text, number, geom) VALUES (3, 'main st', 'main', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -66.05092048645020, 45.26872912017898 ] }'), 4326));
            INSERT INTO address (id, text, text_tokenless, _text, number, geom) VALUES (4, 'main st', 'main', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -66.05050742626190, 45.26880462780347 ] }'), 4326));
            COMMIT;
        `, (err, res) => {
            t.error(err);
            return done();
        });
    });

    popQ.defer((done) => {
        cluster.name(1, (err) => {
            t.error(err);
            return done();
        });
    });

    popQ.defer((done) => {
        pool.query(`
            SELECT id, _text, text_tokenless, text, named FROM network;
        `, (err, res) => {
            t.error(err);

            t.deepEquals(res.rows[0], {
                id: 1,
                _text: 'Main Street',
                text_tokenless: 'main',
                text: 'main st',
                named: true
            });
            return done();
        });
    });

    popQ.await((err) => {
        t.error(err);

        pool.query(`
            BEGIN;
            DROP TABLE address;
            DROP TABLE address_cluster;
            DROP TABLE network;
            DROP TABLE network_cluster;
            COMMIT;
        `, (err, res) => {
            t.error(err);
            t.end();
        });
    });
});

test('cluster.match', (t) => {
    const popQ = Queue(1);

    //CREATE pt2itp TABLES
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            CREATE TABLE address_cluster (id SERIAL, text TEXT, text_tokenless TEXT, _text TEXT, number TEXT, geom GEOMETRY(MULTIPOINT, 4326));
            CREATE TABLE network_cluster (id SERIAL, text TEXT, text_tokenless TEXT, _text TEXT, address INT, geom GEOMETRY(MULTILINESTRING, 4326), buffer GEOMETRY(POLYGON, 4326));
            COMMIT;
        `, (err, res) => {
            t.error(err);
            return done();
        });
    });

    //POPULATE NETWORK_CLUSTER
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO network_cluster (id, text, text_tokenless, _text, geom) VALUES (1, 'main st', 'main', 'Main Street', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "LineString", "coordinates": [ [ -66.05180561542511, 45.26869136632906 ], [ -66.05007290840149, 45.268982070325656 ] ] }'), 4326)));
            UPDATE network_cluster SET buffer = ST_Buffer(ST_Envelope(geom), 0.01);
            COMMIT;
        `, (err, res) => {
            t.error(err);
            return done();
        });
    });

    //POPULATE ADDRESS_CLUSTER
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO address_cluster (id, text, text_tokenless, _text, number, geom) VALUES (1, 'main st', 'main', 'Main Street', 10, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -66.05154812335967, 45.26861208316249 ] }'), 4326)));
            INSERT INTO address_cluster (id, text, text_tokenless, _text, number, geom) VALUES (2, 'fake av', 'fake', 'Fake Avenue', 12, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -66.05154812335967, 45.26861208316249 ] }'), 4326)));
            COMMIT;
        `, (err, res) => {
            t.error(err);
            return done();
        });
    });

    popQ.defer((done) => {
        cluster.match(1, (err) => {
            t.error(err);
            return done();
        });
    });

    popQ.defer((done) => {
        pool.query(`
            SELECT id, text, text_tokenless, address FROM network_cluster;
        `, (err, res) => {
            t.error(err);

            t.deepEquals(res.rows[0], {
                id: 1,
                text: 'main st',
                text_tokenless: 'main',
                address: 1
            });
            return done();
        });
    });

    popQ.await((err) => {
        t.error(err);

        pool.query(`
            BEGIN;
            DROP TABLE address_cluster;
            DROP TABLE network_cluster;
            COMMIT;
        `, (err, res) => {
            t.error(err);
            t.end();
        });
    });
});

test('cluster.address', (t) => {
    const popQ = Queue(1);

    //CREATE pt2itp TABLES
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            CREATE TABLE address (id SERIAL, text TEXT, text_tokenless TEXT, _text TEXT, number INT, geom GEOMETRY(POINT, 4326));
            COMMIT;
        `, (err, res) => {
            t.error(err);
            return done();
        });
    });

    //POPULATE ADDRESS
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO address (id, text, text_tokenless, _text, number, geom) VALUES (1, 'main st', 'main', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-66.97265625,43.96119063892024] }'), 4326));
            INSERT INTO address (id, text, text_tokenless, _text, number, geom) VALUES (2, 'main st', 'main', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-66.97265625,43.96119063892024] }'), 4326));
            INSERT INTO address (id, text, text_tokenless, _text, number, geom) VALUES (3, 'main st', 'main', 'Main Street', 13, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-105.46875,56.36525013685606] }'), 4326));
            INSERT INTO address (id, text, text_tokenless, _text, number, geom) VALUES (4, 'main st', 'main', 'Main Street', 13, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-105.46875,56.36525013685606] }'), 4326));
            INSERT INTO address (id, text, text_tokenless, _text, number, geom) VALUES (5, 'fake av', 'fake', 'Fake Avenue', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-85.25390625,52.908902047770255] }'), 4326));
            COMMIT;
        `, (err, res) => {
            t.error(err);
            return done();
        });
    });

    popQ.defer((done) => {
        cluster.address((err) => {
            t.error(err);
            return done();
        });
    });

    popQ.defer((done) => {
        pool.query(`
            SELECT id, text, text_tokenless, ST_AsGeoJSON(geom) AS geom FROM address_cluster ORDER BY text, id;
        `, (err, res) => {
            t.error(err);

            t.equals(res.rows.length, 3);
            t.deepEquals(res.rows[0], { geom: '{"type":"MultiPoint","coordinates":[[-85.25390625,52.9089020477703]]}', id: 1, text: 'fake av', text_tokenless: 'fake' }, 'fake av');
            t.deepEquals(res.rows[1], { geom: '{"type":"MultiPoint","coordinates":[[-66.97265625,43.9611906389202],[-66.97265625,43.9611906389202]]}', id: 2, text: 'main st', text_tokenless: 'main' });
            t.deepEquals(res.rows[2], { geom: '{"type":"MultiPoint","coordinates":[[-105.46875,56.3652501368561],[-105.46875,56.3652501368561]]}', id: 3, text: 'main st', text_tokenless: 'main' });
            return done();
        });
    });

    popQ.await((err) => {
        t.error(err);

        pool.query(`
            BEGIN;
            DROP TABLE address;
            DROP TABLE address_cluster;
            COMMIT;
        `, (err, res) => {
            t.error(err);
            t.end();
        });
    });
});

test('cluster.network', (t) => {
    const popQ = Queue(1);

    //CREATE pt2itp TABLES
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            CREATE TABLE network (id SERIAL, text TEXT, text_tokenless TEXT, _text TEXT, geom GEOMETRY(LINESTRING, 4326));
            COMMIT;
        `, (err, res) => {
            t.error(err);
            return done();
        });
    });

    //POPULATE NETWORK
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO network (id, text, text_tokenless, _text, geom) VALUES (1, 'main st', 'main', 'Main Street', ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "LineString", "coordinates": [ [ -66.05390310287476, 45.26961632842303 ], [ -66.05441808700562, 45.271035832768376 ] ]}'), 4326));
            INSERT INTO network (id, text, text_tokenless,_text, geom) VALUES (2, 'main st', 'main', 'Main Street', ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "LineString", "coordinates": [ [ -66.05435371398926, 45.27100563091792 ], [ -66.05493307113646, 45.27245530161207 ] ]}'), 4326));
            INSERT INTO network (id, text, text_tokenless,_text, geom) VALUES (3, 'main st', 'main', 'Main Street', ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "LineString", "coordinates": [ [ -113.50117206573485, 53.55137413785917 ], [ -113.50112915039062, 53.54836549323335 ] ]}'), 4326));
            INSERT INTO network (id, text, text_tokenless,_text, geom) VALUES (4, 'main st', 'main', 'Main Street', ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "LineString", "coordinates": [ [ -113.50100040435791, 53.54836549323335 ], [ -113.50104331970215, 53.54614711825744 ] ]}'), 4326));
            COMMIT;
        `, (err, res) => {
            t.error(err);
            return done();
        });
    });

    popQ.defer((done) => {
        cluster.network((err) => {
            t.error(err);
            return done();
        });
    });

    popQ.defer((done) => {
        pool.query(`
            SELECT id, text, text_tokenless, ST_AsGeoJSON(geom) AS geom FROM network_cluster;
        `, (err, res) => {
            t.error(err);

            t.equals(res.rows.length, 2);
            t.deepEquals(res.rows[0], { geom: '{"type":"MultiLineString","coordinates":[[[-66.0539031028748,45.269616328423],[-66.0544180870056,45.2710358327684]],[[-66.0543537139893,45.2710056309179],[-66.0549330711365,45.2724553016121]]]}', id: 1, text: 'main st', text_tokenless: 'main' });
            t.deepEquals(res.rows[1], { geom: '{"type":"MultiLineString","coordinates":[[[-113.501172065735,53.5513741378592],[-113.501129150391,53.5483654932333]],[[-113.501000404358,53.5483654932333],[-113.501043319702,53.5461471182574]]]}', id: 2, text: 'main st',  text_tokenless: 'main' });
            return done();
        });
    });

    popQ.await((err) => {
        t.error(err);

        pool.query(`
            BEGIN;
            DROP TABLE network;
            DROP TABLE network_cluster;
            COMMIT;
        `, (err, res) => {
            t.error(err);
            t.end();
        });
    });
});

test('end connection', (t) => {
    pool.end();
    t.end();
});

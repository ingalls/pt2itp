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

test('Points far away shouldn\'t be clustered', (t) => {
    const popQ = Queue(1);

    //CREATE pt2itp TABLES
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            DROP TABLE IF EXISTS address;
            DROP TABLE IF EXISTS address_cluster;
            DROP TABLE IF EXISTS network;
            DROP TABLE IF EXISTS network_cluster;
            CREATE TABLE address (id SERIAL, text TEXT, _text TEXT, number INT, geom GEOMETRY(POINT, 4326));
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
            INSERT INTO address (id, text, _text, number, geom) VALUES (1, 'main st', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point","coordinates": [9.505233764648438,47.13018433161339 ] }'), 4326));
            INSERT INTO address (id, text, _text, number, geom) VALUES (2, 'main st', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point","coordinates": [9.523429870605469,47.130797460977575 ] }'), 4326));
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

    popQ.await((err) => {
        t.error(err);

        pool.query(`
            BEGIN;
            SELECT ST_AsGeoJSON(geom) FROM address_cluster;
            DROP TABLE address;
            DROP TABLE address_cluster;
            COMMIT;
        `, (err, res) => {
            t.error(err);
            t.equals(res.rows[1].st_asgeojson.toString(), '{"type":"MultiPoint","coordinates":[[9.52342987060547,47.1307974609776]]}', 'ok not clustered');
            t.end();
        });
    });
});

test('Points nearby should be clustered', (t) => {
    const popQ = Queue(1);

    //CREATE pt2itp TABLES
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            DROP TABLE IF EXISTS address;
            DROP TABLE IF EXISTS address_cluster;
            CREATE TABLE address (id SERIAL, text TEXT, _text TEXT, number INT, geom GEOMETRY(POINT, 4326));
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
            INSERT INTO address (id, text, _text, number, geom) VALUES (1, 'main st', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point","coordinates": [ 9.51413869857788,47.132724392963944 ]}'), 4326));
            INSERT INTO address (id, text, _text, number, geom) VALUES (2, 'main st', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point","coordinates": [ 9.516541957855225,47.132724392963944 ] }'), 4326));
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

    popQ.await((err) => {
        t.error(err);

        pool.query(`
            BEGIN;
            SELECT ST_AsGeoJSON(geom) FROM address_cluster;
            DROP TABLE address;
            DROP TABLE address_cluster;
            COMMIT;
        `, (err, res) => {
            t.error(err);
            t.equals(res.rows[0].st_asgeojson.toString(), '{"type":"MultiPoint","coordinates":[[9.51413869857788,47.1327243929639],[9.51654195785522,47.1327243929639]]}', 'ok not clustered');
            t.end();
        });
    });
});


test('LinesStrings far away should not be clustered', (t) => {
    const popQ = Queue(1);

    //CREATE pt2itp TABLES
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            DROP TABLE IF EXISTS network;
            CREATE TABLE network (id SERIAL, text TEXT, _text TEXT, named BOOLEAN, geom GEOMETRY(LINESTRING, 4326));
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
            INSERT INTO network (id, text, _text, geom) VALUES (1, 'main st', 'Main Street', ST_SetSRID(ST_GeomFromGeoJSON('{"type": "LineString", "coordinates": [[9.50514793395996,47.13027192195532],[9.50094223022461,47.13027192195532]]}'), 4326));
            INSERT INTO network (id, text, _text, geom) VALUES (2, 'main st', 'Main Street', ST_SetSRID(ST_GeomFromGeoJSON('{"type": "LineString", "coordinates": [[9.523429870605469,47.1308412556617],[9.527077674865723,47.13091424672175]]}'), 4326));
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

    popQ.await((err) => {
        t.error(err);

        pool.query(`
            BEGIN;
            SELECT ST_AsGeoJSON(geom) FROM network_cluster;
            COMMIT;
        `, (err, res) => {
            t.error(err);
            t.equals(res.rows[0].st_asgeojson.toString(), '{"type":"MultiLineString","coordinates":[[[9.50514793395996,47.1302719219553],[9.50094223022461,47.1302719219553]]]}', 'ok network is not clustered');
            t.end();
        });
    });
});

test('LinesStrings should be clustered', (t) => {
    const popQ = Queue(1);

    //CREATE pt2itp TABLES
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            DROP TABLE IF EXISTS address;
            DROP TABLE IF EXISTS address_cluster;
            DROP TABLE IF EXISTS network;
            DROP TABLE IF EXISTS network_cluster;
            CREATE TABLE address (id SERIAL, text TEXT, _text TEXT, number INT, geom GEOMETRY(POINT, 4326));
            CREATE TABLE address_cluster (id SERIAL, text TEXT, _text TEXT, number TEXT, geom GEOMETRY(MULTIPOINT, 4326));
            CREATE TABLE network (id SERIAL, text TEXT, _text TEXT, named BOOLEAN, geom GEOMETRY(LINESTRING, 4326));
            CREATE TABLE network_cluster (id SERIAL, text TEXT, _text TEXT, address INT, geom GEOMETRY(MULTILINESTRING, 4326), buffer GEOMETRY(POLYGON, 4326));
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
            INSERT INTO network (id, text, _text, geom) VALUES (1, 'main st', 'Main Street', ST_SetSRID(ST_GeomFromGeoJSON('{"type": "LineString","coordinates": [[9.516735076904297,47.13276818606133],[9.519824981689451,47.132870369814995]]}'), 4326));
            INSERT INTO network (id, text, _text, geom) VALUES (2, 'main st', 'Main Street', ST_SetSRID(ST_GeomFromGeoJSON('{"type": "LineString", "coordinates": [[9.513999223709106,47.132695197545665],[9.512518644332886,47.132695197545665]]},'), 4326));
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

    popQ.await((err) => {
        t.error(err);

        pool.query(`
            BEGIN;
            SELECT ST_AsGeoJSON(geom) FROM network_cluster;
            DROP TABLE address;
            DROP TABLE network;
            DROP TABLE network_cluster;
            DROP  TABLE address_cluster;
            COMMIT;
        `, (err, res) => {
            t.error(err);
            t.equals(res.rows[0].st_asgeojson.toString(), '{"type":"MultiLineString","coordinates":[[[9.5167350769043,47.1327681860613],[9.51982498168945,47.132870369815]],[[9.51399922370911,47.1326951975457],[9.51251864433289,47.1326951975457]]]}', 'ok network is clustered');
            t.end();
        });
    });
});

test('end connection', (t) => {
    pool.end();
     t.end();
});

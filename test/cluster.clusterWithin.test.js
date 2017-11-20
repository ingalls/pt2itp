const Cluster = require('../lib/cluster');
const Index = require('../lib/index');

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

const index = new Index(pool);
const cluster = new Cluster({ pool: pool });

test('Drop/Init Database', (t) => {
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
            INSERT INTO address (id, netid, text, text_tokenless, _text, number, geom) VALUES (1, 1, 'main st', 'main', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point","coordinates": [9.505233764648438,47.13018433161339, 1 ] }'), 4326));
            INSERT INTO address (id, netid, text, text_tokenless, _text, number, geom) VALUES (2, 1, 'main st', 'main', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point","coordinates": [9.523429870605469,47.130797460977575, 2 ] }'), 4326));
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
            SELECT ST_AsGeoJSON(geom) FROM address_cluster;
        `, (err, res) => {
            t.error(err);

            t.deepEquals(res.rows[0].st_asgeojson, '{"type":"MultiPoint","coordinates":[[9.50523376464844,47.1301843316134,1],[9.52342987060547,47.1307974609776,2]]}');

            t.end();
        });
    });
});

test('Drop/Init Database', (t) => {
    index.init((err, res) => {
        t.error(err);
        t.end();
    });
});

test('LinesStrings far away should not be clustered', (t) => {
    const popQ = new Queue(1);

    //POPULATE NETWORK
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO network (id, text, text_tokenless, _text, geom) VALUES (1, 'main st', 'main', 'Main Street', ST_SetSRID(ST_GeomFromGeoJSON('{"type": "LineString", "coordinates": [[9.50514793395996,47.13027192195532,1],[9.50094223022461,47.13027192195532,1]]}'), 4326));
            INSERT INTO network (id, text, text_tokenless, _text, geom) VALUES (2, 'main st', 'main', 'Main Street', ST_SetSRID(ST_GeomFromGeoJSON('{"type": "LineString", "coordinates": [[9.523429870605469,47.1308412556617,2],[9.527077674865723,47.13091424672175,2]]}'), 4326));
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
            t.equals(res[1].rows[0].st_asgeojson.toString(), '{"type":"MultiLineString","coordinates":[[[9.50514793395996,47.1302719219553],[9.50094223022461,47.1302719219553]]]}', 'ok network is not clustered');
            t.end();
        });
    });
});

test('Drop/Init Database', (t) => {
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
            INSERT INTO network (id, text, text_tokenless, _text, geom) VALUES (1, 'main st', 'main', 'Main Street', ST_SetSRID(ST_GeomFromGeoJSON('{"type": "LineString","coordinates": [[9.516735076904297,47.13276818606133,1],[9.519824981689451,47.132870369814995,1]]}'), 4326));
            INSERT INTO network (id, text, text_tokenless,_text, geom) VALUES (2, 'main st', 'main', 'Main Street', ST_SetSRID(ST_GeomFromGeoJSON('{"type": "LineString", "coordinates": [[9.513999223709106,47.132695197545665,2],[9.512518644332886,47.132695197545665,2]]},'), 4326));
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
            SELECT ST_AsGeoJSON(geom) FROM network_cluster;
        `, (err, res) => {
            t.error(err);

            t.equals(res.rows[0].st_asgeojson.toString(), '{"type":"MultiLineString","coordinates":[[[9.5167350769043,47.1327681860613],[9.51982498168945,47.132870369815]],[[9.51399922370911,47.1326951975457],[9.51251864433289,47.1326951975457]]]}', 'ok network is clustered');
            t.end();
        });
    });
});

test('Drop/Init Database', (t) => {
    index.init((err, res) => {
        t.error(err);
        t.end();
    });
});

test('end connection', (t) => {
    pool.end();
     t.end();
});

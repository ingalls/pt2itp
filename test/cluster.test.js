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

test('Drop tables if exist', (t) => {
    pool.query(`
        BEGIN;
        DROP TABLE IF EXISTS network_cluster;
        DROP TABLE IF EXISTS address_cluster;
        DROP TABLE IF EXISTS network;
        DROP TABLE IF EXISTS address;
        DROP TABLE IF EXISTS segments;
        COMMIT;
    `, (err, res) => {
        t.error(err);
        t.end();
    });
});

test('cluster.name', (t) => {
    const popQ = Queue(1);

    //CREATE pt2itp TABLES
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            CREATE TABLE address (id SERIAL, segment BIGINT, text TEXT, text_tokenless TEXT, _text TEXT, number INT, geom GEOMETRY(POINT, 4326));
            CREATE TABLE address_cluster (id SERIAL, text TEXT, text_tokenless TEXT, _text TEXT, number TEXT, geom GEOMETRY(MULTIPOINT, 4326));
            CREATE TABLE network (id SERIAL, segment BIGINT, text TEXT, text_tokenless TEXT, _text TEXT, named BOOLEAN, geom GEOMETRY(LINESTRING, 4326));
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
            INSERT INTO network (id, geom, segment) VALUES (1, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "LineString", "coordinates": [ [ -66.05180561542511, 45.26869136632906 ], [ -66.05007290840149, 45.268982070325656 ] ] }'), 4326), 1);
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
            INSERT INTO address (id, segment, text, text_tokenless, _text, number, geom) VALUES (1, 1, 'main st', 'main', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -66.05154812335967, 45.26861208316249 ] }'), 4326));
            INSERT INTO address (id, segment, text, text_tokenless, _text, number, geom) VALUES (2, 1, 'main st', 'main', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -66.05125308036804, 45.26868759094269 ] }'), 4326));
            INSERT INTO address (id, segment, text, text_tokenless, _text, number, geom) VALUES (3, 1, 'main st', 'main', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -66.05092048645020, 45.26872912017898 ] }'), 4326));
            INSERT INTO address (id, segment, text, text_tokenless, _text, number, geom) VALUES (4, 1, 'main st', 'main', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [ -66.05050742626190, 45.26880462780347 ] }'), 4326));
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

test('cluster.address', (t) => {
    const popQ = Queue(1);

    //CREATE pt2itp TABLES
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            CREATE TABLE address (id SERIAL, segment BIGINT, text TEXT, text_tokenless TEXT, _text TEXT, number INT, geom GEOMETRY(POINTZ, 4326));
            CREATE TABLE address_cluster (id SERIAL, text TEXT, text_tokenless TEXT, _text TEXT, number TEXT, geom GEOMETRY(GEOMETRYZ, 4326));
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
            INSERT INTO address (id, segment, text, text_tokenless, _text, number, geom) VALUES (1, 1, 'main st', 'main', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-66.97265625,43.96119063892024, 1] }'), 4326));
            INSERT INTO address (id, segment, text, text_tokenless, _text, number, geom) VALUES (2, 1, 'main st', 'main', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-66.97265625,43.96119063892024, 2] }'), 4326));
            INSERT INTO address (id, segment, text, text_tokenless, _text, number, geom) VALUES (6, 1, 'main st', 'main', 'Main Street', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-66.97265625,43.96119063892024, 6] }'), 4326));
            INSERT INTO address (id, segment, text, text_tokenless, _text, number, geom) VALUES (3, 1, 'main st', 'main', 'Main Street', 13, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-105.46875,56.36525013685606, 3] }'), 4326));
            INSERT INTO address (id, segment, text, text_tokenless, _text, number, geom) VALUES (4, 1, 'main st', 'main', 'Main Street', 13, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-105.46875,56.36525013685606, 4] }'), 4326));
            INSERT INTO address (id, segment, text, text_tokenless, _text, number, geom) VALUES (5, 1, 'fake av', 'fake', 'Fake Avenue', 10, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-85.25390625,52.908902047770255, 5] }'), 4326));
            COMMIT;
        `, (err, res) => {
            t.error(err);
            return done();
        });
    });

    popQ.defer((done) => {
        cluster.address(1, (err) => {
            t.error(err);
            return done();
        });
    });

    popQ.defer((done) => {
        pool.query(`
            SELECT text, text_tokenless, ST_AsGeoJSON(geom)::JSON AS geom FROM address_cluster ORDER BY ST_NumGeometries(geom);
        `, (err, res) => {
            t.error(err);

            t.equals(res.rows.length, 3);
            t.deepEquals(res.rows[0], { geom: {"type":"MultiPoint","coordinates":[[-85.25390625,52.9089020477703,5]]}, text: 'fake av', text_tokenless: 'fake' }, 'fake av');
            t.deepEquals(res.rows[1], { geom: {"type":"MultiPoint","coordinates":[[-105.46875,56.3652501368561,3],[-105.46875,56.3652501368561,4]]}, text: 'main st', text_tokenless: 'main' });
            t.deepEquals(res.rows[2], { geom: { coordinates: [ [ -66.97265625, 43.9611906389202, 1 ], [ -66.97265625, 43.9611906389202, 2 ], [ -66.97265625, 43.9611906389202, 6 ] ], type: 'MultiPoint' }, text: 'main st', text_tokenless: 'main' });
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
            CREATE TABLE network (id SERIAL, segment BIGINT, text TEXT, text_tokenless TEXT, _text TEXT, geom GEOMETRY(LINESTRING, 4326));
            CREATE TABLE network_cluster(ID SERIAL, text TEXT, _text TEXT, text_tokenless TEXT, geom GEOMETRY(GEOMETRY, 4326), buffer GEOMETRY(Polygon,4326), address INTEGER);
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
            INSERT INTO network (id, segment, text, text_tokenless, _text, geom) VALUES (1, 1, 'main st', 'main', 'Main Street', ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "LineString", "coordinates": [ [ -66.05390310287476, 45.26961632842303 ], [ -66.05441808700562, 45.271035832768376 ] ]}'), 4326));
            INSERT INTO network (id, segment, text, text_tokenless, _text, geom) VALUES (2, 1, 'main st', 'main', 'Main Street', ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "LineString", "coordinates": [ [ -66.05435371398926, 45.27100563091792 ], [ -66.05493307113646, 45.27245530161207 ] ]}'), 4326));
            INSERT INTO network (id, segment, text, text_tokenless, _text, geom) VALUES (3, 1, 'main st', 'main', 'Main Street', ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "LineString", "coordinates": [ [ -113.50117206573485, 53.55137413785917 ], [ -113.50112915039062, 53.54836549323335 ] ]}'), 4326));
            INSERT INTO network (id, segment, text, text_tokenless, _text, geom) VALUES (4, 1, 'main st', 'main', 'Main Street', ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "LineString", "coordinates": [ [ -113.50100040435791, 53.54836549323335 ], [ -113.50104331970215, 53.54614711825744 ] ]}'), 4326));
            COMMIT;
        `, (err, res) => {
            t.error(err);
            return done();
        });
    });

    popQ.defer((done) => {
        cluster.network(1, (err) => {
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

test('cluster.adoption', (t) => {
    const popQ = Queue(1);

    //CREATE pt2itp TABLES
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            CREATE TABLE network_cluster (address BIGINT, geom GEOMETRY(LINESTRING, 4326), buffer GEOMETRY(GEOMETRY, 4326));
            CREATE TABLE address_cluster (id BIGINT, _text TEXT, geom GEOMETRY(GEOMETRY, 4326));
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
            INSERT INTO network_cluster (address, geom) VALUES (1, ST_SetSRID(ST_GeomFromGeoJSON('{"type":"LineString","coordinates":[[-77.06428527832031,38.87018642754998],[-77.08488464355469,38.84131208727261],[-77.1240234375,38.826870521380634],[-77.13844299316406,38.817241182948266],[-77.16316223144531,38.80440003947544],[-77.178955078125,38.788880569497124],[-77.18513488769531,38.76853959726423],[-77.18719482421874,38.74337300148123],[-77.22633361816405,38.710160941206645]]}'), 4326));
            UPDATE network_cluster SET buffer=ST_Buffer(ST_Envelope(geom), 0.01);
            INSERT INTO address_cluster (id, _text, geom) VALUES (1, 'Pollard St', ST_SetSRID(ST_GeomFromGeoJSON('{"type":"MultiPoint","coordinates":[[-77.06468224525452,38.87007783654626],[-77.06486463546752,38.86984394766712],[-77.06496119499207,38.86961005801844]]}'), 4326));
            INSERT INTO address_cluster (id, _text, geom) VALUES (2, 'Pollard St', ST_SetSRID(ST_GeomFromGeoJSON('{"type":"MultiPoint","coordinates":[[-77.22588300704956,38.710068850025856],[-77.22571134567261,38.710269776085525],[-77.22553968429565,38.710504189108065]]}'), 4326));
            INSERT INTO address_cluster (id, _text, geom) VALUES (3, 'Inviolable Ave', ST_SetSRID(ST_GeomFromGeoJSON('{"type":"MultiPoint","coordinates":[[-77.32588300704956,38.810068850025856],[-77.32571134567261,38.810269776085525],[-77.32553968429565,38.810504189108065]]}'), 4326));
            INSERT INTO address_cluster (id, _text, geom) VALUES (4, 'Immutable Rd', ST_SetSRID(ST_GeomFromGeoJSON('{"type":"MultiPoint","coordinates":[[-77.16273,38.80371],[-77.16373,38.80371],[-77.16473,38.80371]]}'), 4326));
            COMMIT;
        `, (err, res) => {
            t.error(err);
            return done();
        });
    });

    popQ.defer((done) => {
        cluster.adoption((err) => {
            t.error(err);
            return done();
        });
    });

    popQ.defer((done) => {
        pool.query(`
            SELECT id, _text, ST_NPoints(geom) AS npoints FROM address_cluster ORDER BY id;
        `, (err, res) => {
            t.error(err);

            t.equals(res.rows.length, 3);
            t.deepEquals(res.rows[0], { id: '1', _text: 'Pollard St', npoints: 6 });
            t.deepEquals(res.rows[1], { id: '3', _text: 'Inviolable Ave', npoints: 3 });
            t.deepEquals(res.rows[2], { id: '4', _text: 'Immutable Rd', npoints: 3 });
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


test('cluster.prune', (t) => {
    const popQ = Queue(1);

    //CREATE pt2itp TABLES
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            CREATE TABLE network_cluster (id BIGINT, address BIGINT, text TEXT, text_tokenless TEXT);
            CREATE TABLE address_cluster (id BIGINT, text TEXT, text_tokenless TEXT);
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
            INSERT INTO address_cluster (id, text, text_tokenless) VALUES (1, 'Main St', 'Main');
            INSERT INTO network_cluster (id, address, text, text_tokenless) VALUES (1, 1, 'Main St', 'Main');
            INSERT INTO network_cluster (id, address, text, text_tokenless) VALUES (2, 1, 'Moin St', 'Main');

            INSERT INTO address_cluster (id, text, text_tokenless) VALUES (2, 'Pollard Rd', 'Pollard');
            INSERT INTO network_cluster (id, address, text, text_tokenless) VALUES (3, 2, 'Pollard St', 'Pollard');

            INSERT INTO address_cluster (id, text, text_tokenless) VALUES (3, 'First St', 'First');
            INSERT INTO network_cluster (id, address, text, text_tokenless) VALUES (4, 3, 'First St', 'First');
            INSERT INTO network_cluster (id, address, text, text_tokenless) VALUES (5, 3, 'Second St', 'Second');
            COMMIT;
        `, (err, res) => {
            t.error(err);
            return done();
        });
    });

    popQ.defer((done) => {
        cluster.prune((err) => {
            t.error(err);
            return done();
        });
    });

    popQ.defer((done) => {
        pool.query(`
            SELECT * FROM address_cluster ORDER BY id ASC;
        `, (err, res) => {
            t.error(err);
            if (process.env.UPDATE) {
                fs.writeFileSync(__dirname + '/fixtures/cluster.prune-address.expected.json', JSON.stringify(res.rows, null, 2))
                t.fail();
            } else {
                t.deepEquals(res.rows, require(__dirname + '/fixtures/cluster.prune-address.expected.json'));
            }
            return done();
        });
    });

    popQ.defer((done) => {
        pool.query(`
            SELECT * FROM network_cluster ORDER BY id ASC;
        `, (err, res) => {
            t.error(err);
            if (process.env.UPDATE) {
                fs.writeFileSync(__dirname + '/fixtures/cluster.prune-network.expected.json', JSON.stringify(res.rows, null, 2))
                t.fail();
            } else {
                t.deepEquals(res.rows, require(__dirname + '/fixtures/cluster.prune-network.expected.json'));
            }
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

test('end connection', (t) => {
    pool.end();
    t.end();
});

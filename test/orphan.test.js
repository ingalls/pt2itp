'use strict';

const Orphan = require('../lib/map/orphan');
const {
    pg_optimize,
    cluster_addr
} = require('../native/index.node');
const test = require('tape');

const db = require('./lib/db');

db.init(test);

const { Writable } = require('stream');
const fs = require('fs');
const path = require('path');
const Queue = require('d3-queue').queue;
const readline = require('readline');
const output = fs.createWriteStream(path.resolve(__dirname, '../test/fixtures/orphan-output.geojson'));

test('orphan.address', (t) => {
    const pool = db.get();

    const orphan = new Orphan(pool, {
        props: ['accuracy']
    }, output);
    const popQ = new Queue(1);

    // populate address
    popQ.defer((done) => {
        pool.query(`
            BEGIN;
            INSERT INTO address (names, number, output, geom, netid, props) VALUES ('[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way"}, { "token": "se", "token_type": "Cardinal"}], "display": "Main Street SE", "priority": 0, "freq": 1 }]', 1, true, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-66.97265625,43.96119063892024] }'), 4326), 1, '{ "accuracy": "building" }');
            INSERT INTO address (names, number, output, geom, netid, props) VALUES ('[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way"}, { "token": "se", "token_type": "Cardinal"}], "display": "Main Street SE", "priority": 0, "freq": 1 }]', 2, true, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-66.97265625,43.96119063892024] }'), 4326), 1, '{ "accuracy": "building" }');
            INSERT INTO address (names, number, output, geom, netid, props) VALUES ('[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way"}], "display": "Main Street", "priority": 0, "freq": 1 }]', 3, true, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-105.46875,56.36525013685606] }'), 4326), NULL, '{ "accuracy": "parcel" }');
            INSERT INTO address (names, number, output, geom, netid, props) VALUES ('[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way"}], "display": "Main Street", "priority": 0, "freq": 1 }]', 4, true, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-105.46875,56.36525013685606] }'), 4326), NULL, '{ "accuracy": "parcel" }');
            INSERT INTO address (names, number, output, geom, netid, props) VALUES ('[{ "tokenized": [{ "token": "fake", "token_type": null }, { "token": "av", "token_type": "Way"}], "display": "Fake Avenue", "priority": 0, "freq": 1 }]', 5, true, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-85.25390625,52.908902047770255] }'), 4326), NULL, '{ "accuracy": "building" }');
            INSERT INTO address (names, number, output, geom, netid, props) VALUES ('[{ "tokenized": [{ "token": "fake", "token_type": null }, { "token": "av", "token_type": "Way"}], "display": "Fake Avenue", "priority": 0, "freq": 1 }]', 6, false, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-85.25390625,52.908902047770255] }'), 4326), NULL, '{ "accuracy": "building" }');
            INSERT INTO address (names, number, output, geom, netid, props) VALUES ('[{ "tokenized": [{ "token": "main", "token_type": null }, { "token": "st", "token_type": "Way"}, { "token": "se", "token_type": "Cardinal"}], "display": "Main Street SE", "priority": 0, "freq": 1 }]', 6, true, ST_SetSRID(ST_GeomFromGeoJSON('{ "type": "Point", "coordinates": [-66.97265625,43.96119063892024] }'), 4326), 1, '{ "accuracy": "parcel" }');
            COMMIT;
        `, (err) => {
            t.error(err, 'ok - added addresses to table');

            pg_optimize();

            return done();
        });
    });

    // call orphan.address
    popQ.defer((done) => {
        cluster_addr('pt_test', true);

        orphan.address((err) => {
            t.error(err);
            return done();
        });
    });

    // check address_orphan_cluster
    popQ.defer((done) => {
        pool.query(`
            SELECT names FROM address_orphan_cluster ORDER BY names;
        `, (err, res) => {
            t.error(err);

            t.equals(res.rows.length, 2, 'ok - correct number of orphans');
            t.deepEquals(res.rows[0], { names: [{ freq: 1, display: 'Fake Avenue', priority: 0, tokenized: [{ token: 'fake', token_type: null }, { token: 'av', token_type: 'Way' }] }] }, 'ok - Fake Ave orphaned');
            t.deepEquals(res.rows[1], { names: [{ freq: 1, display: 'Main Street', priority: 0, tokenized: [{ token: 'main', token_type: null }, { token: 'st', token_type: 'Way' }] }] }, 'ok - Main St orphaned');
            return done();
        });
    });

    popQ.await((err) => {
        t.error(err);
        output.end();

        pool.end(() => {
            t.end();
        });
    });
});

test('orphan output', (t) => {

    let counter = 0;
    const orphans = {
        'Main Street': [['3','4']],
        'Fake Avenue': [['5']]
    };

    const rl = readline.createInterface({
        input : fs.createReadStream(path.resolve(__dirname, '../test/fixtures/orphan-output.geojson'))
    });
    rl.on('line', (line) => {
        if (!line) return;
        counter++;
        const feat = JSON.parse(line);

        t.deepEquals(feat.properties['carmen:addressnumber'], orphans[feat.properties['carmen:text']], 'ok - orphan has correct addresses');

        t.ok(feat.properties.accuracy);
    });

    rl.on('close', () => {
        t.equals(counter, 2, 'ok - output had correct number of orphan clusters');
        t.end();
    });
});

test('orphan streets', (t) => {

    const {
        import_net,
        cluster_net,
        intersections
    } = require('../native/index.node');

    import_net({
        db: 'pt_test',
        seq: true,
        input: path.resolve(__dirname, './fixtures/network_orphans.geojson'),
        context: { db: 'pt_test' }
    });

    cluster_net('pt_test');

    intersections('pt_test');

    let outputBuffer = '';
    const output = new Writable({
        write(chunk, encoding, callback) {
            outputBuffer += chunk.toString();
            callback();
        }
    });

    t.test('Should output intersections if requested', (tt) => {

        const pool = db.get();
        const orphan = new Orphan(pool, { intersections: true }, output);

        orphan.network((err) => {
            t.error(err);
            pool.end();
            const result = outputBuffer.split('\n').filter((v) => v.length > 0).map(JSON.parse);
            t.equal(result.length, 2);

            t.deepEqual(result[0].properties['carmen:text'], 'Hobart Place Northwest');
            t.deepEqual(result[0].properties['carmen:intersections'], [null, ['Georgia Avenue Northwest', 'Us 29']]);
            t.deepEqual(result[0].properties['carmen:parityl'], [[], null]);
            t.deepEqual(result[0].properties['carmen:ltohn'], [[], null]);
            t.deepEqual(result[0].properties['carmen:lfromhn'], [[], null]);
            t.deepEqual(result[0].properties['carmen:parityr'], [[], null]);
            t.deepEqual(result[0].properties['carmen:rtohn'], [[], null]);
            t.deepEqual(result[0].properties['carmen:rfromhn'], [[], null]);
            t.deepEqual(result[0].properties['carmen:addressnumber'], undefined);

            t.deepEqual(result[1].properties['carmen:text'], 'Georgia Avenue Northwest,Us 29');
            t.deepEqual(result[1].properties['carmen:intersections'], [null, ['Hobart Place Northwest']]);
            t.deepEqual(result[1].properties['carmen:parityl'], [[], null]);
            t.deepEqual(result[1].properties['carmen:ltohn'], [[], null]);
            t.deepEqual(result[1].properties['carmen:lfromhn'], [[], null]);
            t.deepEqual(result[1].properties['carmen:parityr'], [[], null]);
            t.deepEqual(result[1].properties['carmen:rtohn'], [[], null]);
            t.deepEqual(result[1].properties['carmen:rfromhn'], [[], null]);
            t.deepEqual(result[1].properties['carmen:addressnumber'], undefined);

            tt.end();
        });
    });

    t.test('Should not omit intersections by default', (tt) => {
        outputBuffer = '';

        const pool = db.get();
        const orphan = new Orphan(pool, {}, output);

        orphan.network((err) => {
            t.error(err);
            pool.end();
            const result = outputBuffer.split('\n').filter((v) => v.length > 0).map(JSON.parse);
            t.equal(result.length, 2);

            t.deepEqual(result[0].properties['carmen:text'], 'Hobart Place Northwest');
            t.deepEqual(result[0].properties['carmen:intersections'], undefined);
            t.deepEqual(result[0].properties['carmen:parityl'], [[]]);
            t.deepEqual(result[0].properties['carmen:ltohn'], [[]]);
            t.deepEqual(result[0].properties['carmen:lfromhn'], [[]]);
            t.deepEqual(result[0].properties['carmen:parityr'], [[]]);
            t.deepEqual(result[0].properties['carmen:rtohn'], [[]]);
            t.deepEqual(result[0].properties['carmen:rfromhn'], [[]]);
            t.deepEqual(result[0].properties['carmen:addressnumber'], undefined);

            t.deepEqual(result[1].properties['carmen:text'], 'Georgia Avenue Northwest,Us 29');
            t.deepEqual(result[0].properties['carmen:intersections'], undefined);
            t.deepEqual(result[1].properties['carmen:parityl'], [[]]);
            t.deepEqual(result[1].properties['carmen:ltohn'], [[]]);
            t.deepEqual(result[1].properties['carmen:lfromhn'], [[]]);
            t.deepEqual(result[1].properties['carmen:parityr'], [[]]);
            t.deepEqual(result[1].properties['carmen:rtohn'], [[]]);
            t.deepEqual(result[1].properties['carmen:rfromhn'], [[]]);
            t.deepEqual(result[1].properties['carmen:addressnumber'], undefined);

            tt.end();
        });
    });

    t.end();
});


db.init(test);

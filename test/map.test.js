'use strict';

const ReadLine = require('readline');
const worker = require('../lib/map');

const test = require('tape');
const path = require('path');
const fs = require('fs');
const db = require('./lib/db');

db.init(test);

test('map - in-address error', (t) => {
    worker({
    }, (err) => {
        t.equals(err.toString(), 'Error: --in-address=<FILE.geojson> argument required');
        t.end();
    });
});

db.init(test);

test('map - in-network error', (t) => {
    worker({
        'in-address': path.resolve(__dirname, './fixtures/sg-address.geojson')
    }, (err) => {
        t.equals(err.toString(), 'Error: --in-network=<FILE.geojson> argument required');
        t.end();
    });
});

db.init(test);

test('map - output error', (t) => {
    worker({
        'in-address': path.resolve(__dirname, './fixtures/sg-address.geojson'),
        'in-network': path.resolve(__dirname, './fixtures/sg-network.geojson')
    }, (err) => {
        t.equals(err.toString(), 'Error: --output=<FILE.geojson> argument required');
        t.end();
    });
});

db.init(test);

test('map - db error', (t) => {
    worker({
        'in-address': path.resolve(__dirname, './fixtures/sg-address.geojson'),
        'in-network': path.resolve(__dirname, './fixtures/sg-network.geojson'),
        'output': '/tmp/itp.geojson'
    }, (err) => {
        t.equals(err.toString(), 'Error: --db=<DATABASE> argument required');
        t.end();
    });
});

db.init(test);

test.skip('map - cardinal clustering', (t) => {
    worker({
        'in-address': path.resolve(__dirname, './fixtures/cardinal-address.geojson'),
        'in-network': path.resolve(__dirname, './fixtures/cardinal-network.geojson'),
        output: '/tmp/itp.geojson',
        debug: true,
        db: 'pt_test'
    }, (err) => {
        t.error(err);

        let containsClusterAddresses = false;
        const containsFreeRadicalAddresses = false;

        const rl = ReadLine.createInterface({
            input: fs.createReadStream('/tmp/itp.geojson')
        });

        rl.on('line', (line) => {
            if (!line) return;

            const feat = JSON.parse(line);

            // TODO: fix names once the tests+freeRadicals code work
            const clusterAddresses = [1, 5, 9, 11, 15];
            const freeRadicalAddresses = [3, 7, 13];

            if (feat.properties['carmen:addressnumber'] && feat.properties['carmen:addressnumber'][1]) {

                const addresses = feat.properties['carmen:addressnumber'][1];

                for (const numCluster in clusterAddresses) {
                    if (addresses.indexOf(numCluster) !== -1) containsClusterAddresses = true;
                }

                for (const numFree in freeRadicalAddresses) {
                    if (addresses.indexOf(numFree) !== -1) containsClusterAddresses = true;
                }
            }
        });

        rl.on('error', t.error);

        rl.on('close', () => {
            t.equals(containsClusterAddresses, true, 'ok - contains at least one cluster address');
            t.equals(containsFreeRadicalAddresses, true, 'ok - contains at least one free radical address');
            fs.unlinkSync('/tmp/itp.geojson');
            t.end();
        });
    });
});

db.init(test);

test('map - good run', (t) => {

    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/itp.geojson');
        fs.unlinkSync('/tmp/error-network');
        fs.unlinkSync('/tmp/error-address');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    worker({
        'in-address': path.resolve(__dirname, './fixtures/sg-address.geojson'),
        'in-network': path.resolve(__dirname, './fixtures/sg-network.geojson'),
        stats: path.resolve(__dirname, './fixtures/sg-stats'),
        output: '/tmp/itp.geojson',
        'error-network': '/tmp/error-network',
        'error-address': '/tmp/error-address',
        languages: 'en',
        debug: true,
        db: 'pt_test'
    }, (err) => {
        t.error(err);

        const rl = ReadLine.createInterface({
            input: fs.createReadStream('/tmp/itp.geojson')
        });

        rl.on('line', (line) => {
            if (!line) return;

            // const feat = JSON.parse(line);

            // TODO PT2ITP is not deterministic and subsequent runs can change the output value based on unordered operations.
            //      For these tests to function properly a full deterministic quest will have to be pursued. We should do this
            // if (feat.properties['carmen:text'] === 'Muscat Street') checkFixture(feat, 'muscat-st');
            // if (feat.properties['carmen:text'] === 'Park Road,Parsi Road') checkFixture(feat, 'park-rd');
            // if (feat.properties['carmen:text'] === 'Teck Lim Road') checkFixture(feat, 'teck-lim');
            // if (feat.properties['carmen:text'] === 'Jalan Kelempong') checkFixture(feat, 'jalam-kelempong');
            // if (feat.properties['carmen:text'] === 'Tomlinson Road,Tomlison Road') checkFixture(feat, 'tomlinson');
            // if (feat.properties['carmen:text'] === 'Jalan Sejarah') checkFixture(feat, 'jalan-sejrah');
            // if (feat.properties['carmen:text'] === 'Changi South Street 3') checkFixture(feat, 'changi');
            // if (feat.properties['carmen:text'] === 'Lorong 21a Geylang') checkFixture(feat, 'lorong');
            // if (feat.properties['carmen:text'] === 'Ang Mo Kio Industrial Park 3') checkFixture(feat, 'ang-mo');
            // if (feat.properties['carmen:text'] === 'De Souza Avenue') checkFixture(feat, 'de-souza');
        });

        rl.on('error', t.error);

        rl.on('close', () => {
            t.doesNotThrow(() => {
                fs.accessSync('/tmp/error-network');
                fs.accessSync('/tmp/error-address');
            });

            fs.unlinkSync('/tmp/itp.geojson');
            fs.unlinkSync('/tmp/error-network');
            fs.unlinkSync('/tmp/error-address');
            t.end();
        });
    });
});

db.init(test);

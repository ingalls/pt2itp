const ReadLine = require('readline');
const Index = require('../lib/index');
const worker = require('../lib/map');

const test = require('tape');
const path = require('path');
const fs = require('fs');
const pg = require('pg');

test('map - in-address error', (t) => {
    worker({
    }, (err, res) => {
        t.equals(err.toString(), 'Error: --in-address=<FILE.geojson> argument required');
        t.end();
    });
});

test('map - in-network error', (t) => {
    worker({
        'in-address': './test/fixtures/sg-address.geojson'
    }, (err, res) => {
        t.equals(err.toString(), 'Error: --in-network=<FILE.geojson> argument required');
        t.end();
    });
});

test('map - output error', (t) => {
    worker({
        'in-address': './test/fixtures/sg-address.geojson',
        'in-network': './test/fixtures/sg-network.geojson'
    }, (err, res) => {
        t.equals(err.toString(), 'Error: --output=<FILE.geojson> argument required');
        t.end();
    });
});

test('map - db error', (t) => {
    worker({
        'in-address': './test/fixtures/sg-address.geojson',
        'in-network': './test/fixtures/sg-network.geojson',
        'output': '/tmp/itp.geojson'
    }, (err, res) => {
        t.equals(err.toString(), 'Error: --db=<DATABASE> argument required');
        t.end();
    });
});

test.skip('map - cardinal clustering', (t) => {
    worker({
        'in-address': './test/fixtures/cardinal-address.geojson',
        'in-network': './test/fixtures/cardinal-network.geojson',
        output: '/tmp/itp.geojson',
        debug: true,
        db: 'pt_test'
    }, (err, res) => {
        t.error(err);

        let containsClusterAddresses = false;
        let containsFreeRadicalAddresses = false;

        rl = ReadLine.createInterface({
            input: fs.createReadStream('/tmp/itp.geojson')
        });

        rl.on('line', (line) => {
            if (!line) return;

            feat = JSON.parse(line);

            // TODO: fix names once the tests+freeRadicals code work
            const clusterAddresses = [ 1, 5, 9, 11, 15 ];
            const freeRadicalAddresses = [ 3, 7, 13 ];

            if (feat.properties['carmen:addressnumber'] && feat.properties['carmen:addressnumber'][1]) {

                let addresses = feat.properties['carmen:addressnumber'][1];

                for (numCluster in clusterAddresses) {
                    if (addresses.indexOf(numCluster) != -1) containsClusterAddresses = true;
                }

                for (numFree in freeRadicalAddresses) {
                    if (addresses.indexOf(numFree) != -1) containsClusterAddresses = true;
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

test('drop cardinal database', (t) => {
    let pool = new pg.Pool({
        max: 10,
        user: 'postgres',
        database: 'pt_test',
        idleTimeoutMillis: 30000
    });

    const index = new Index(pool);
    index.init((err, res) => {
        t.error(err);
        pool.end();
        t.end();
    });

});

test('map - good run', (t) => {
    worker({
        'in-address': './test/fixtures/sg-address.geojson',
        'in-network': './test/fixtures/sg-network.geojson',
        output: '/tmp/itp.geojson',
        debug: true,
        db: 'pt_test'
    }, (err, res) => {
        t.error(err);

        rl = ReadLine.createInterface({
            input: fs.createReadStream('/tmp/itp.geojson')
        });

        rl.on('line', (line) => {
            if (!line) return;

            feat = JSON.parse(line);

            //TODO PT2ITP is not deterministic and subsequent runs can change the output value based on unordered operations.
            //      For these tests to function properly a full deterministic quest will have to be pursued. We should do this
            //if (feat.properties['carmen:text'] === 'Muscat Street') checkFixture(feat, 'muscat-st');
            //if (feat.properties['carmen:text'] === 'Park Road,Parsi Road') checkFixture(feat, 'park-rd');
            //if (feat.properties['carmen:text'] === 'Teck Lim Road') checkFixture(feat, 'teck-lim');
            //if (feat.properties['carmen:text'] === 'Jalan Kelempong') checkFixture(feat, 'jalam-kelempong');
            //if (feat.properties['carmen:text'] === 'Tomlinson Road,Tomlison Road') checkFixture(feat, 'tomlinson');
            //if (feat.properties['carmen:text'] === 'Jalan Sejarah') checkFixture(feat, 'jalan-sejrah');
            //if (feat.properties['carmen:text'] === 'Changi South Street 3') checkFixture(feat, 'changi');
            //if (feat.properties['carmen:text'] === 'Lorong 21a Geylang') checkFixture(feat, 'lorong');
            //if (feat.properties['carmen:text'] === 'Ang Mo Kio Industrial Park 3') checkFixture(feat, 'ang-mo');
            //if (feat.properties['carmen:text'] === 'De Souza Avenue') checkFixture(feat, 'de-souza');
        });

        rl.on('error', t.error);

        rl.on('close', () => {
            fs.unlinkSync('/tmp/itp.geojson');
            t.end();
        });

        /**
         * Standard Fixture compare/update
         * @param {Object} res returned result
         * @param {string} fixture Path to expected result file
         */
        function checkFixture(res, fixture) {
            t.ok(res.id);
            delete res.id;

            let known = JSON.parse(fs.readFileSync(path.resolve(__dirname, `./fixtures/sg-${fixture}`)));

            t.deepEquals(res, known);

            if (process.env.UPDATE) {
                t.fail();
                fs.writeFileSync(path.resolve(__dirname, `./fixtures/sg-${fixture}`), JSON.stringify(res, null, 4));
            }
        }
    });
});

test('drop good-run database', (t) => {
    let pool = new pg.Pool({
        max: 10,
        user: 'postgres',
        database: 'pt_test',
        idleTimeoutMillis: 30000
    });

    const index = new Index(pool);
    index.init((err, res) => {
        t.error(err);
        pool.end();
        t.end();
    });

});

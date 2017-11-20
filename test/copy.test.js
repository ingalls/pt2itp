const tape = require('tape');
const tmp = require('tmp');
const os = require('os');
const fs = require('fs');
const path = require('path');
const copy = require('../lib/copy');
const tokenize = require('../lib/tokenize');

tape('copy.js output - address', (t) => {
    let tempFile = tmp.tmpNameSync();
    copy.init({
        id: 0,
        read: __dirname + '/fixtures/copy.sample-input-address.geojson',
        output: tempFile,
        type: 'address',
        total: 1,
        solo: true,
        error: false,
        tokens: tokenize.createReplacer(['et'])
    });
    copy.start(() => {
        if (process.env.UPDATE) {
            fs.createReadStream(tempFile).pipe(fs.createWriteStream(path.resolve(__dirname, './fixtures/copy.sample-output-address.psv')));
            t.fail('updated fixture');
        } else
            t.equal(fs.readFileSync(tempFile).toString(), fs.readFileSync(__dirname + '/fixtures/copy.sample-output-address.psv').toString(), 'output is as expected');
        t.end();
    });
});

tape('copy.js output - network', (t) => {
    let tempFile = tmp.tmpNameSync();
    copy.init({
        id: 0,
        read: __dirname + '/fixtures/copy.sample-input-network.geojson',
        output: tempFile,
        type: 'network',
        total: 1,
        map: __dirname + '/../lib/map/osmium.js',
        solo: true,
        error: false,
        tokens: tokenize.createReplacer(['et'])
    });
    copy.start(() => {
        if (process.env.UPDATE) {
            fs.createReadStream(tempFile).pipe(fs.createWriteStream(path.resolve(__dirname, './fixtures/copy.sample-output-network.psv')));
            t.fail('updated fixture');
        } else
            t.equal(fs.readFileSync(tempFile).toString(), fs.readFileSync(__dirname + '/fixtures/copy.sample-output-network.psv').toString(), 'output is as expected');
        t.end();
    });
});

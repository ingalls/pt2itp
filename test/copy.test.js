const tape = require('tape');
const tmp = require('tmp');
const os = require('os');
const fs = require('fs');
const copy = require('../lib/copy');
const tokenize = require('../lib/tokenize');

tape('copy.js output', (t) => {
    let tempFile = tmp.tmpNameSync();
    copy.init({
        id: 0,
        read: __dirname + '/fixtures/copy.sample-geojson-input.geojson',
        output: tempFile,
        type: 'address',
        total: 1,
        solo: true,
        error: false,
        tokens: tokenize.createReplacer(['et'])
    });
    copy.start(() => {
        if (process.env.UPDATE) {
            fs.rename(tempFile, __dirname + '/fixtures/copy.sample-geojson-output.psv');
            t.fail('updated fixture');
        }
        else
            t.equal(fs.readFileSync(tempFile).toString(), fs.readFileSync(__dirname + '/fixtures/copy.sample-geojson-output.psv').toString(), 'output is as expected');
        t.end();
    });
});

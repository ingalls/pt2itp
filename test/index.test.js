const tape = require('tape');
const tmp = require('tmp');
const os = require('os');
const fs = require('fs');
const copy = require('../lib/copy');
const index = require('../lib/index');
const tokenize = require('../lib/tokenize');

tape('copy.js output', (t) => {
    let file = tmp.tmpNameSync();
    index.copy(file, type, opts, cb);
});

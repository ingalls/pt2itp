const fs = require('fs');
const turf = require('@turf/turf');
const path = require('path');
const prog = require('progress');
const readline = require('readline');

module.exports = function(argv, cb) {
    if (!argv) return cb(new Error('options object required'))

    let inStream;

    if (argv[3]) {
        inStream = fs.createReadStream(path.resolve(__dirname, '..', argv[3]));
    } else {
        process.stdin.setEncoding('utf8');
        process.stdin.resume();
        inStream = process.stdin;
    }

    let rl = readline.createInterface({
        input: inStream
    });

    let addrCount = 0;
    let itpCount = 0;
    let totCount = 0;

    rl.on('line', (line) => {
        if (!line) return;

        let feat = JSON.parse(line);

        totCount++;

        if (feat.properties['carmen:addressnumber']) {
            for (sngFeat of feat.properties['carmen:addressnumber']) {
                if (!sngFeat) continue;

                addrCount = addrCount + sngFeat.length;
            }
        }

        for (geom of feat.geometry.geometries) {
            if (geom.type !== "MultiLineString") continue;

            itpCount = itpCount + geom.coordinates.length;
        }

    });

    rl.on('error', (err) => {
        return cb(err);
    });

    rl.on('close', () => {
        console.error('Stats:');
        console.error(`Addresses: ${addrCount}`);
        console.error(`Networks: ${itpCount}`);
        console.error(`Features: ${totCount}`)

        return cb();
    });
}

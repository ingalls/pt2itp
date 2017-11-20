const tokenize = require('./tokenize');
const tokens = require('@mapbox/geocoder-abbreviations');
const diacritics = require('diacritics').remove;
const readline = require('readline');
const Units = require('./units');
const turf = require('@turf/turf');
const csv = require('csv-stringify/lib/sync');
const fs = require('fs');

let opts = {};

let unit_it = 0;
let reverseMap = new Map();
let tokenRegex = tokenize.createGlobalReplacer(tokens().global);

const units = new Units();

process.on('message', (message) => {
    init(message);

    process.title = `COPY - ${opts.type} - ${opts.id}`;

    return start();
});

/**
 * Start reading given input GeoJSON file and write output to csv to be COPYied into the database
 * @param {Function} callback Optional callback for those not using in a childprocess (listen to process.message by default)
 * @return {Function|false} Return callback if defined or false when completed
 */
function start(callback) {
    rl = readline.createInterface({
        input: opts.read,
        output: opts.output
    });

    let num = 0;

    rl.on('close', () => {
        if (!opts.solo) {
            opts.output.end(() => {
                process.send(true);
            });
        }
        if (callback && (typeof callback === 'function'))
            return callback();
    });

    rl.on('line', (data) => {
        if (!data || !data.length) return;

        num++;

        if (num % opts.total !== opts.id) return; //Distribute tasks evenly accross workers

        let features = false;

        //The new GeoJSONSeq schema uses record separators
        data = data.replace(RegExp(String.fromCharCode(30), 'g'), '');

        try {
            if (opts.map)
                features = opts.map(JSON.parse(data), opts.context);
            else
                features = JSON.parse(data);
        } catch (err) {
            if (opts.error) process.stderr.write(`Unable to parse: ${err.toString()}\t${data}\n`);
        }

        if (!Array.isArray(features))
            features = [ features ];

        for (let feat of features) {
            if (!feat || typeof feat !== 'object' || feat instanceof Error) {
                //map errors that matter are Error objects, features that are thrown away for valid reasons are simply false
                //Only log actual errors to disk
                if (feat instanceof Error) {
                    if (opts.error) process.stderr.write(`Rejected by map module: ${feat.toString()}\t${data}\n`);
                }
                return;
            }

            feat = turf.truncate(feat, 6, 2, true);
            //Streets will attempt to be named if they are missing later on
            if (opts.type === 'address' && !feat.properties.street) {
                if (opts.error) process.stderr.write(`Missing street name\t${data}\n`);
                return;
            }

            if (opts.type === 'address') {
                if (Array.isArray(feat.properties.street))
                    feat.properties.street = feat.properties.street.join(',');
            } else if (Array.isArray(feat.properties.street)) {
                // we no longer allow arrays in .street for networks
                process.stderr.write(`network feature ${feat.propertied.id} has an array as its 'street' property\n`);
                return;
            }

            if (feat.properties.street.trim().length === 0)
                feat.properties.street = '';

            // the feature _text value that is displayed to users is determined later, in map.js w/ a pluggable lib/labels/*.js system
            feat.properties._text = feat.properties.street;

            let tokens = tokenize.main(feat.properties.street, opts.tokens, true);
            feat.properties.street = tokenize.replaceToken(tokenRegex, diacritics(tokens.tokens.join(' '))); // The street is standardized and it what is used to compare to the address cluster
            feat.properties.streetTokenless = diacritics(tokens.tokenless.join(' ')); // we will also use the tokenless form during the linker phase

            if (opts.type === 'address') {
                if (feat.properties.number === null) {
                    if (opts.error) process.stderr.write(`.number cannot be null\t${data}\n`);
                    return;
                }

                feat.properties.number = units.encode(feat.properties.number, {
                    output: feat.properties.output
                }) || '';

                feat.properties.source = feat.properties.source || '';

                if (feat.properties.output !== false) feat.properties.output = 1;
                else feat.properties.output = 0;

                rl.output.write(csv([[
                    str(feat.properties.street),
                    str(feat.properties.streetTokenless),
                    str(feat.properties._text),
                    feat.geometry.coordinates[0],
                    feat.geometry.coordinates[1],
                    str(feat.properties.number),
                    str(feat.properties.source),
                    feat.properties.output
                ]], {
                    delimiter: '|',
                    quote: String.fromCharCode(30)
                }));
            } else {
                // set z coord to feature ID so it survives clustering
                if (!feat.properties.id) feat.properties.id = 0;
                feat.geometry.coordinates = feat.geometry.coordinates.map((coord) => {
                    coord.push(feat.properties.id);
                    return coord;
                });
                rl.output.write(csv([[
                    str(feat.properties.id),
                    str(feat.properties.street),
                    str(feat.properties.streetTokenless),
                    str(feat.properties._text),
                    str(JSON.stringify(feat.geometry)),
                    str(turf.lineDistance(feat.geometry).toFixed(6))
                ]], {
                    delimiter: '|',
                    quote: String.fromCharCode(30)
                }));
            }
        }
    });
}

/**
 * Instantiate copy class with required parameters before start is called
 * @param {Object} o Argument object
 * @param {string} o.map Optionally use map file to convert line delimited input into PT2ITP supported GeoJSON
 * @param {string} o.read Path to input file
 * @param {string} o.output Path to output file (will be overwritten if exists)
 * @param {string} o.type One of 'address' or 'network' depending on the input type
 * @param {boolean} o.error If true print errors to stderr
 * @param {numeric} o.id ID of process batch
 * @param {numeric} o.total Total number of batches to process
 * @return {boolean} return true when initiated
 */
function init(o) {
    opts = o;
    opts.map = opts.map ? require(opts.map).map : false;
    opts.context = opts.context ? opts.context : false;

    opts.read = fs.createReadStream(opts.read);
    opts.output = fs.createWriteStream(opts.output);

    return true;
}

/**
 * Remove `|` character from output strings to ensure PSV file is valid
 * @param {string} s String to validate
 * @return {string} validated string
 */
function str(s) {
    if (typeof s === 'string') return s.replace(/\|/g, '');
    return s;
}

module.exports.init = init;
module.exports.str = str;
module.exports.start = start;

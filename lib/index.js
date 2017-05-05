module.exports.str = str;
module.exports.init = init;
module.exports.optimize = optimize;
module.exports.copy = copy;
module.exports.itp = itp;

const readline = require('readline');
const tokenize = require('./tokenize');
const os = require('os');
const fs = require('fs');
const _ = require('lodash');

function str(s) {
    if (typeof s === 'string') return s.replace(/\|/g, '');
    return s;
}

function init(pool, cb) {
    pool.connect((err, client, release) => {
        if (err) return cb(err);

        client.query(`
            ABORT;
            BEGIN;
            DROP TABLE IF EXISTS address;
            DROP TABLE IF EXISTS network;
            CREATE TABLE address (id SERIAL, text TEXT, _text TEXT, number NUMERIC, lon TEXT, lat TEXT, geom GEOMETRY(POINTZ, 4326));
            CREATE TABLE network (id SERIAL, text TEXT, _text TEXT, named BOOLEAN, geomtext TEXT, geom GEOMETRY(LINESTRING, 4326));
            COMMIT;
        `, (err, res) => {
            client.release();
            return cb(err);
        });
    });
}

/**
 * Import a stream of 'map' module generated ITP Features into a given database
 * (Currently used to bring map geojson back into database for debug mode
 *
 * @param {Pool}        pool    PostgreSQL Client Pool
 * @param {string}      path    to itp geojson file
 * @param {Object}      opts    optional args
 * @param {Function}    cb      Callback
 * @return {Function}           in form fxn(err)
 */
function itp(pool, path, opts = {}, cb) {
    pool.query(`
        BEGIN;

        CREATE EXTENSION IF NOT EXISTS POSTGIS;

        DROP TABLE IF EXISTS itp;

        CREATE TABLE itp (id BIGINT, blob JSONB, geom GEOMETRY(GEOMETRY, 4326) );

        COPY itp (blob) FROM '${path}' WITH CSV DELIMITER '|' QUOTE E'\b' NULL AS '';

        UPDATE itp
            SET
                geom = ST_Envelope(ST_SetSRID(ST_GeomFromGeoJSON(blob->>'geometry'), 4326)),
                id = (blob->>'id')::BIGINT;

        CREATE INDEX itp_gix ON itp USING GIST (geom);

        COMMIT;
    `, (err) => {
        return cb(err);
    });
}

/**
 * Index/bucket a stream of geojson features into groups of similiarly named features
 *
 * @param {Pool}   pool     Postgresql Client Pool
 * @param {Stream} stream   of geojson Features to be indexed by `street` property
 * @param {string} type     type of geojson feature - either `address` or `network`
 * @param {Object} opts     optional arguments
 *                          opts.tokens - JSON Object in the form of a token replacement file. See ./lib/tokens/ for examples
 *                          opts.map    - JS module to filter/convert input into pt2itp accepted format
 *                          opts.error  - File to write invalid features to
 * @param {Function} cb     callback funtion
 * @return {Function}       in the form fxn(err)
*/
function copy(pool, stream, type, opts = {}, cb) {
    const map = opts.map ? require(opts.map).map : false;

    let unit_it = 0;
    let reverseMap = new Map();

    let rl = readline.createInterface({
        input: stream,
        output: fs.createWriteStream(`${os.tmpDir()}/${type}.psv`)
    });

    rl.on('line', (line) => {
        if (!line.length) return;

        if (opts.bar) opts.bar.tick(Buffer.byteLength(line, 'utf8'));

        let feat = false;
        try {
            feat = JSON.parse(line);
            if (map) feat = map(feat);
        } catch (err) {
            if (opts.error) {
                opts.error.write(`Unable to parse: ${err.toString()}\t${line}\n`);
            }
            feat = false;
        }

        if (!feat || typeof feat !== 'object' || feat instanceof Error) {
            //map errors that matter are Error objects, features that are thrown away for valid reasons are simply false
            //Only log actual errors to disk
            if (opts.error && feat instanceof Error) {
                opts.error.write(`Rejected by map module: ${feat.toString()}\t${line}\n`);
            }
            return;
        }

        if (!feat.properties.street) {
            if (opts.error) {
                opts.error.write(`Missing street name\t${line}\n`);
            }
            return;
        }

        if (Array.isArray(feat.properties.street)) feat.properties._text = feat.properties.street.join(',');
        else feat.properties._text = feat.properties.street;

        if (feat.properties._text === feat.properties._text.toUpperCase()) {
            feat.properties._text = _.startCase(feat.properties.street);
        }

        if (feat.properties.street.length > 0) {
            //@TODO HACK - need to support alt names eventually
            if (Array.isArray(feat.properties.street)) feat.properties.street = feat.properties.street[0];

            feat.properties.street = tokenize(feat.properties.street, opts.tokens).join(' ');
        } else {
            feat.properties.street = '';
        }

        if (type === 'address') {
            if (feat.properties.number === null) {
                if (opts.error) {
                    opts.error.write(`.number cannot be null\t${line}\n`);
                }
                return;
            }

            if (opts.unitMap && isNaN(Number(feat.properties.number))) {
                let unit = feat.properties.number.replace(/^\d+/, '');
                let num = feat.properties.number.match(/^\d+/)[0];

                if (reverseMap.has(unit)) {
                    num = `${num}.${reverseMap.get(unit)}`;
                } else {
                    opts.unitMap.set(++unit_it, unit);
                    reverseMap.set(unit, unit_it);
                    num = `${num}.${unit_it}`;
                }

                feat.properties.number = num;
            }

            rl.output.write(`${str(feat.properties.street)}|${str(feat.properties._text)}|${JSON.stringify(str(feat.geometry.coordinates[0]))}|${JSON.stringify(str(feat.geometry.coordinates[1]))}|${str(feat.properties.number)}\n`);
        } else {
            rl.output.write(`${str(feat.properties.street)}|${str(feat.properties._text)}|${str(JSON.stringify(feat.geometry))}\n`);
        }
    });

    rl.on('error', (err) => {
        return cb(err);
    });

    rl.on('close', () => {
        pool.connect((err, client, release) => {
            if (err) return cb(err);

            let query;
            if (type === 'address') query = `COPY address (text, _text, lon, lat, number) FROM '${os.tmpDir()}/address.psv' WITH CSV DELIMITER '|' QUOTE E'\b' NULL AS '';`;
            else query = `COPY network (text, _text, geomtext) FROM '${os.tmpDir()}/network.psv' WITH CSV DELIMITER '|' QUOTE E'\b' NULL AS '';`;

            client.query(String(query), (err, res) => {
                cb(err);
                client.release();
            });
        });
    });
}

function optimize(pool, cb) {
    pool.connect((err, client, release) => {
        if (err) return cb(err);

        //This is so beautifully hacky it makes me want to cry.
        //ST_ClusterWithin is lossy and individual ids can't be tracked through
        //But it's not calculated in 3D space, but retains 3D coord
        //Set number as 3D coord to track through :') tears of painful happiness
        client.query(`
            BEGIN;
            UPDATE address SET geom = ST_SetSRID(ST_MakePoint(lon::NUMERIC, lat::NUMERIC, number), 4326);
            UPDATE network SET geom = ST_SetSRID(ST_GeomFromGeoJSON(geomtext), 4326);

            CREATE INDEX network_idx ON network (text);
            CREATE INDEX network_gix ON network USING GIST (geom);
            CLUSTER network USING network_idx;
            ANALYZE network;

            CREATE INDEX address_idx ON address (text);
            CREATE INDEX address_gix ON address USING GIST (geom);
            CLUSTER address USING address_idx;
            ANALYZE address;

            COMMIT;
        `, (err, res) => {
            if (err) return cb(err);

            client.release();
            return cb(err);
        });
    });
}

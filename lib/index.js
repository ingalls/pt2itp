const os = require('os');
const fs = require('fs');
const turf = require('@turf/turf');
const readline = require('readline');
const title = require('to-title-case');
const diacritics = require('diacritics').remove;
const tokenize = require('./tokenize');
const tokens = require('@mapbox/geocoder-abbreviations');

class Index {
    constructor(pool) {
        this.pool = pool;
    }

    str(s) {
        if (typeof s === 'string') return s.replace(/\|/g, '');
        return s;
    }

    init(cb) {
        this.pool.connect((err, client, release) => {
            if (err) return cb(err);

            client.query(`
                ABORT;
                BEGIN;
                DROP TABLE IF EXISTS meta;
                DROP TABLE IF EXISTS address;
                DROP TABLE IF EXISTS network;
                DROP TABLE IF EXISTS children;
                CREATE TABLE address (id SERIAL, text TEXT, _text TEXT, number NUMERIC, lon TEXT, lat TEXT, geom GEOMETRY(POINTZ, 4326));
                CREATE TABLE network (id SERIAL, text TEXT, _text TEXT, named BOOLEAN, geomtext TEXT, geom GEOMETRY(LINESTRING, 4326));
                CREATE TABLE children (id SERIAL, blob JSONB, geom GEOMETRY(MULTIPOLYGON, 4326));
                CREATE TABLE meta (k TEXT UNIQUE, v TEXT);
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
     * @param {String}      path    to itp geojson file
     * @param {Object}      opts    optional args
     * @param {Function}    cb      Callback
     * @return {Function}           in form fxn(err)
     */
    itp(path, opts = {}, cb) {
        this.pool.query(`
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
     * Import a stream of GeoJSON (Multi)Polygon Features to use to split the clusering operation by
     *
     * @param {String}      path    to itp geojson file
     * @param {Object}      opts    optional args
     * @param {Function}    cb      Callback
     * @return {Function}           in form fxn(err)
     */
    children(path, opts, cb) {
        this.pool.query(`
            BEGIN;

            COPY children (blob) FROM '${path}' WITH CSV DELIMITER '|' QUOTE E'\b' NULL AS '';

            UPDATE children
                SET
                    geom = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(blob->>'geometry'), 4326))

            CREATE INDEX children_gix ON children USING GIST (geom);

            COMMIT;
        `, (err) => {
            return cb(err);
        });

    }

    /**
     * Index/bucket a stream of geojson features into groups of similiarly named features
     *
     * @param {Stream} stream   of geojson Features to be indexed by `street` property
     * @param {String} type     type of geojson feature - either `address` or `network`
     * @param {Object} opts     optional arguments
     *                          opts.tokens - JSON Object in the form of a token replacement file. See ./lib/tokens/ for examples
     *                          opts.map    - JS module to filter/convert input into pt2itp accepted format
     *                          opts.error  - File to write invalid features to
     * @param {Function} cb     callback funtion
     * @return {Function}       in the form fxn(err)
    */
    copy(stream, type, opts = {}, cb) {
        const map = opts.map ? require(opts.map).map : false;

        let unit_it = 0;
        let reverseMap = new Map();

        let psv = `${os.tmpDir()}/${type}-${(new Date).getTime()}.psv`

        let rl = readline.createInterface({
            input: stream,
            output: fs.createWriteStream(psv)
        });

        let tokenRegex = tokenize.createGlobalReplacer(tokens().global);
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

            feat = turf.truncate(feat, 6, 2, true);

            //Streets will attempt to be named if they are missing later on
            if (type === 'address' && !feat.properties.street) {
                if (opts.error) {
                    opts.error.write(`Missing street name\t${line}\n`);
                }
                return;
            }

            if (Array.isArray(feat.properties.street)) feat.properties._text = feat.properties.street.join(',');
            else feat.properties._text = feat.properties.street;

            if (feat.properties.street.length > 0) {
                //@TODO HACK - need to support alt names eventually
                if (Array.isArray(feat.properties.street)) feat.properties.street = feat.properties.street[0];

            } else {
                feat.properties.street = '';
            }

            feat.properties._text = title(feat.properties.street);                                  //The _text value is what is displayed to the user - it should not be modified after this

            feat.properties.street = diacritics(tokenize.main(feat.properties.street, opts.tokens).join(' '));       //The street is standardized and it what is used to compare to the address cluster
            feat.properties.steet = tokenize.replaceToken(tokenRegex, feat.properties.street);

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
                        opts.unitMap[++unit_it] = unit;
                        reverseMap.set(unit, unit_it);
                        num = `${num}.${unit_it}`;
                    }

                    feat.properties.number = num;
                }

                rl.output.write(`${this.str(feat.properties.street)}|${this.str(feat.properties._text)}|${JSON.stringify(this.str(feat.geometry.coordinates[0]))}|${JSON.stringify(this.str(feat.geometry.coordinates[1]))}|${this.str(feat.properties.number)}\n`);
            } else {
                rl.output.write(`${this.str(feat.properties.street)}|${this.str(feat.properties._text)}|${this.str(JSON.stringify(feat.geometry))}\n`);
            }
        });

        rl.on('error', (err) => {
            return cb(err);
        });

        rl.on('close', () => {
            this.pool.connect((err, client, release) => {
                if (err) return cb(err);

                let query;
                if (type === 'address') query = `COPY address (text, _text, lon, lat, number) FROM '${psv}' WITH CSV DELIMITER '|' QUOTE E'\b' NULL AS '';`;
                else query = `COPY network (text, _text, geomtext) FROM '${psv}' WITH CSV DELIMITER '|' QUOTE E'\b' NULL AS '';`;

                client.query(String(query), (err, res) => {
                    cb(err);
                    client.release();
                });
            });
        });
    }

    setMeta(key, value, cb) {
        if (typeof value === 'object') value = JSON.stringify(value);

        this.pool.query(`
            INSERT INTO meta (k, v)
                VALUES ('${key}', '${value}')
                ON CONFLICT (k) DO
                    UPDATE SET v = '${value}';
        `, (err, res) => {
            if (cb) return cb(err);
            else if (err) throw err;
        });
    }

    getMeta(key, cb) {
        if (key === true) { //Return all meta
            this.pool.query(`
                SELECT * FROM meta;
            `, (err, res) => {
                if (err) return cb(err);
                if (!res.rows.length) return cb(null, {});

                let meta = {};

                for (let r of res.rows) {
                    try {
                        meta[r.k] = JSON.parse(r.v);
                    } catch (err) {
                        meta[r.k] = r.v;
                    }
                }

                return cb(null, meta);
            });
        } else {
            this.pool.query(`
                SELECT v
                    FROM
                        meta
                    WHERE
                        k = '${key}';
            `, (err, res) => {
                if (!res.rows.length) return cb(new Error('Key not found'));

                let val;
                try {
                    val = JSON.parse(res.rows[0].v);
                } catch (err) {
                    val = res.rows[0].v;
                }

                return cb(err, val);
            });
        }
    }

    optimize(cb) {
        //This is so beautifully hacky it makes me want to cry.
        //ST_ClusterWithin is lossy and individual ids can't be tracked through
        //But it's not calculated in 3D space, but retains 3D coord
        //Set number as 3D coord to track through :') tears of painful happiness
        this.pool.query(`
            BEGIN;
            DELETE FROM address WHERE length(number::TEXT) > 10;

            UPDATE address SET geom = ST_SetSRID(ST_MakePoint(substring(lon from 1 for 10)::NUMERIC, substring(lat from 1 for 10)::NUMERIC, number), 4326);
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

            return cb(err);
        });
    }
}

module.exports = Index;

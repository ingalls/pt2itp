module.exports = index;

const readline = require('readline');
const tokenize = require('./tokenize');

/**
 * Index/bucket a stream of geojson features into groups of similiarly named features
 *
 * @param {Stream} stream   of geojson Features to be indexed by `street` property
 * @param {String} type     type of geojson feature - either `address` or `network`
 * @param {Object} opts     optional arguments
 *                          opts.tokens - JSON Object in the form of a token replacement file. See ./lib/tokens/ for examples
 *                          opts.map    - JS module to filter/convert input into pt2itp accepted format
 * @param {Function} cb     callback funtion
*/
function index(pool, stream, type, opts, cb) {
    var lineID = -1;

    var map = false;
    if (opts.map) {
        map = require(__dirname + '/../' + opts.map);
        if (!map.map || typeof map.map !== 'function') return cb(new Error('--map module must expose map function'));
    }

    pool.connect(function(err, client, release) {
        if (err) return cb(err);

        if (type === 'address') {
            client.query(`
                BEGIN;
                CREATE TABLE address (id SERIAL, text TEXT, _text TEXT, number INT, geom GEOMETRY(POINT, 4326));
                CREATE TABLE address_cluster (id SERIAL, text TEXT, _text TEXT, number TEXT, geom GEOMETRY(MULTIPOINT, 4326));
                COMMIT;
            `, function(err, res) {
                if (err) return cb(err);

                createRL(client, release);
            });
        } else {
            client.query(`
                BEGIN;
                CREATE TABLE network (id SERIAL, text TEXT, _text TEXT, named BOOLEAN, geom GEOMETRY(LINESTRING, 4326));
                CREATE TABLE network_cluster (id SERIAL, text TEXT, _text TEXT, address INT, geom GEOMETRY(MULTILINESTRING, 4326), buffer geom GEOMETRY(MULTIPOLYGON, 4326));
                COMMIT;
            `, function(err, res) {
                if (err) return cb(err);

                createRL(client, release);
            });
        }
    });

    function createRL(client, release) {
        var ql = 'BEGIN;';

        var rl = readline.createInterface({
            input: stream,
            output: null
        });

        rl.on('line', function(line) {
            if (!line.length) return; //Usually an empty line

            var currentID = ++lineID;

            var ender = false;
            if (currentID % 1000 === 0 && currentID !== 0) {
                rl.pause();
                ender = true;
            }

            var feat = JSON.parse(line);

            if (map) feat = map.map(feat);

            if (feat === false && ender) {
                return commit();
            } else if (feat === false) {
                return;
            }

            if (feat.properties.street === undefined) return cb(new Error('missing street property'));

            if (feat.properties.street.length > 0) {
                //@TODO HACK - need to support alt names eventually
                if (Array.isArray(feat.properties.street)) feat.properties.street = feat.properties.street[0];

                feat.properties.street = tokenize(feat.properties.street, opts.tokens).join(' ');
            } else {
                feat.properties.street = '';
            }

            feat.properties['carmen:text'] = feat.properties.street; //Retain original formatting

            if (type === 'address') {
                ql = ql + `
                    INSERT INTO ${type} (text, _text, geom, number) VALUES (
                        '${feat.properties.street}',
                        '${feat.properties['carmen:text'].replace("'", "''", 'g')}',
                        ST_SetSRID(ST_GeomFromGeoJSON('${JSON.stringify(feat.geometry)}'), 4326),
                        ${feat.properties.number}
                    );
                `;
            } else {
                ql = ql + `
                    INSERT INTO ${type} (text, _text, geom) VALUES (
                        '${feat.properties.street}',
                        '${feat.properties['carmen:text'].replace("'", "''", 'g')}',
                        ST_SetSRID(ST_GeomFromGeoJSON('${JSON.stringify(feat.geometry)}'), 4326)
                    );
                `;
            }

            if (ender) {
                commit();
            }

            function commit() {
                ql = ql + "COMMIT;";

                query = ql;
                client.query(query, function(err, res) {
                    if (err) return cb(err);

                    rl.resume();
                });
                ql = "BEGIN;";
            }
        });

        rl.on('error', function(err) {
            return cb(err);
        });

        rl.on('close', function() {
            client.query(ql + 'COMMIT;', function(err, res) {
                if (err) return cb(err);

                client.query(`
                    BEGIN;
                    CREATE INDEX ${type}_gix ON ${type} USING GIST (geom);
                    CLUSTER ${type} USING ${type}_gix;
                    ANALYZE ${type};
                    COMMIT;
                `, function(err, res) {
                    client.release();

                    return cb(err);
                });
            });
        });
    }
}

const Queue = require('d3-queue').queue;
const Cursor = require('pg-cursor');
const path = require('path');
const pg = require('pg');
const fs = require('fs');

const cluster = require('./cluster');
const buffer = require('./buffer');
const split = require('./split');
const index = require('./index');
const freq = require('./freq');

module.exports = function(argv, cb) {
    if (!cb || typeof cb !== 'function') throw new Error('lib/map.js requires a callback parameter');

    if (Array.isArray(argv)) {
        var argv = require('minimist')(argv, {
            string: [
                "output",
                "in-network",
                "in-address",
                "map-network",
                "map-address",
                "tokens",
                "db"
            ],
            boolean: [
                "name"
            ],
            alias: {
                "in-address": "in-addresses",
                "map-address": "map-addresses",
                "output": "o",
                "tokens": "token"
            }
        });
    }

    if (!argv['in-address']) {
        return cb(new Error('--in-address=<FILE.geojson> argument required'));
    } else if (!argv['in-network']) {
        return cb(new Error('--in-network=<FILE.geojson> argument required'));
    } else if (!argv['output']) {
        return cb(new Error('--output=<FILE.geojson> argument required'));
    } else if (!argv.db) {
        return cb(new Error('--db=<DATABASE> argument required'));
    }

    if (argv['tokens']) {
        var parsed =  JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', argv.tokens), 'utf8'));
        var tokens = {};
        parsed.forEach(function(parse) {
            parse.sort(function(a, b) {
                return a.length > b.length
            });
            if (parse.length === 1) {
                throw new Error('tokens must be in a min group of two');
            } else if (parse.length > 2) {
                parse.forEach(function(token, it) {
                    if (it === 0) return;

                    tokens[token.toLowerCase()] = parse[0].toLowerCase();
                });
            } else {
                tokens[parse[1].toLowerCase()] = parse[0].toLowerCase();
            }

            argv['tokens'] = tokens;
        });

    }

    var output = fs.createWriteStream(path.resolve(__dirname, '..', argv.output));

    var pool = new pg.Pool({
        max: 10,
        user: 'postgres',
        database: argv.db,
        idleTimeoutMillis: 30000
    });

    indexFeat();

    //Import address/network into postgres database
    function indexFeat() {
        var indexQ = Queue();

        indexQ.defer(function(done) {
            addressStream = fs.createReadStream(path.resolve(__dirname, '..',  argv['in-address']));

            index(pool, addressStream, 'address', {
                tokens: argv['tokens'],
                map: argv['map-address']
            }, function(err, res) {
                if (err) return done(err);
                return done(null, res);
            });
        });

        indexQ.defer(function(done) {
            networkStream = fs.createReadStream(path.resolve(__dirname, '..', argv['in-network']));

            index(pool, networkStream, 'network', {
                tokens: argv['tokens'],
                map: argv['map-network']
            }, function(err, res) {
                if (err) return done(err);
                return done(null, res);
            });
        });

        indexQ.awaitAll(function(err, res) {
            if (err) return cb(err);

            console.error('ok - imported data');

            nameNetwork();
        });
    }

    function nameNetwork() {
        pool.connect(function(err, client, pg_done) {
            if (err) return cb(err);

            var cursor = client.query(new Cursor(`SELECT id FROM network WHERE text = '';`));

            var batch = 0;

            return iterate();

            function iterate() {
                cursor.read(100, function(err, rows) {
                    if (!rows.length) {
                        pg_done();
                        return getNames();
                    }

                    var nameQ = Queue();

                    for (var row_it = 0; row_it < rows.length; row_it++) {
                        nameQ.defer(cluster.name, rows[row_it].id, pool);
                    }

                    nameQ.await(function(err) {
                        if (err) return cb(err);

                        console.log('ok - named unnamed streets ' + batch);
                        batch++;

                        return iterate();
                    });
                });
            }
        });
    }

    function getNames() {
        var nameQ = Queue();

        nameQ.defer(function(done) {
            networkTerms = pool.query('SELECT text FROM network GROUP BY text', function(err, res) {
                if (err) return done(err);

                res = res.rows.map(function(a) {
                    return a.text;
                });

                return done(null, { network: res });
            });

        });

        nameQ.defer(function(done) {
            addressTerms = pool.query('SELECT text FROM address GROUP BY text', function(err, res) {
                if (err) return done(err);

                res = res.rows.map(function(a) {
                    return a.text;
                });

                return done(null, { address: res });
            });
        });

        nameQ.awaitAll(function(err, res) {
            if (err) return cb(err);

            console.log('ok - clustered names');

            mergeNames({
                address: res[0].address ? res[0].address : res[1].address,
                network: res[0].network ? res[0].network : res[1].network
            });
        });
    }

    function mergeNames(names) {
        var mergeQ = Queue();

        mergeQ.defer(address_next, 0);
        mergeQ.defer(network_next, 0);

        mergeQ.await(function(err) {
            if (err) return cb(err);

            console.log('ok - geometries clustered');

            pool.query(`
                BEGIN;
                CREATE INDEX address_cluster_gix ON address_cluster USING GIST (geom);
                CREATE INDEX network_cluster_gix ON network_cluster USING GIST (geom);
                CLUSTER address_cluster USING address_cluster_gix;
                CLUSTER network_cluster USING network_cluster_gix;
                ANALYZE address_cluster;
                ANALYZE network_cluster;
                COMMIT;
            `, function(err, res) {
                if (err) return cb(err);

                console.log('ok - created cluster indexes');

                var calcFreq = freq(names.network, names.address);

                console.log('ok - calculated frequency');

                matcher(calcFreq);
            });
        });

        function address_next(it, done) {
            var addressQ = new Queue();

            for (var address_it = it; address_it < it+100; address_it++) {
                if (!names.address[address_it]) break;
                addressQ.defer(cluster.address, names.address[address_it], pool);
            }

            addressQ.await(function(err) {
                if (err) return cb(err);

                console.log(`ok - address cluster ${it}/${names.address.length}`);

                if (it > names.address.length) return done();
                return address_next(it+100, done);
            });
        }

        function network_next(it, done) {
            var networkQ = new Queue();

            for (var network_it = it; network_it < it+100; network_it++) {
                if (!names.network[network_it]) break;
                networkQ.defer(cluster.network, names.network[network_it], pool);
            }

            networkQ.await(function(err) {
                if (err) return cb(err);

                console.log(`ok - network cluster ${it}/${names.network.length}`);

                if (it > names.network.length) return done();
                return network_next(it+100, done);
            });
        }
    }

    function matcher(calcFreq) {
        pool.connect(function(err, client, pg_done) {
            if (err) return cb(err);

            var cursor = client.query(new Cursor(`SELECT id FROM network_cluster WHERE text != '';`));
            var batch = 0;

            return iterate();

            function iterate() {
                cursor.read(100, function(err, rows) {
                    if (!rows.length) {
                        pg_done();
                        return splitter();
                    }

                    var matchQ = Queue();

                    for (var row_it = 0; row_it < rows.length; row_it++) {
                        matchQ.defer(cluster.match, rows[row_it].id, calcFreq, pool);
                    }

                    matchQ.await(function(err) {
                        if (err) return cb(err);

                        console.log('ok - matched network with addresses ' + batch);
                        batch++;

                        return iterate();
                    });
                });
            }
        });
    }

    function splitter() {
        pool.connect(function(err, client, pg_done) {
            if (err) return cb(err);

            //If we want all streets and not just clusters that have an address cluster match we need to write addresses
            //  to file that are WHERE text != '' AND address IS NULL;
            var cursor = client.query(new Cursor(`SELECT id FROM network_cluster WHERE text != '' AND address IS NOT NULL;`));
            var batch = 0;

            return iterate();

            function iterate() {
                cursor.read(100, function(err, rows) {
                    if (!rows.length) {
                        pg_done();
                        return finalize();
                    }

                    var splitQ = Queue();

                    for (var row_it = 0; row_it < rows.length; row_it++) {
                        splitQ.defer(split, rows[row_it].id, pool, output);
                    }

                    splitQ.await(function(err) {
                        if (err) return cb(err);

                        console.log('ok - split batch: ' + batch);
                        batch++;

                        return iterate();
                    });
                });
            }
        });
    }

    function finalize() {
        console.log('ok - addresses assigned to linestring');
        output.end();
        pool.end();

        return cb();
    }
}

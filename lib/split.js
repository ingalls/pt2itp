const Post = require('./post');
const Units = require('./units');

const interpolize = require('./interpolize');
const Explode = require('./explode');
const Cluster = require('./cluster');
const diacritics = require('diacritics').remove;
const Queue = require('d3-queue').queue;
const turf = require('@turf/turf');
const pg = require('pg');

const Misc = require('./misc');
const misc = new Misc();

let opts, pool, id, label, cluster;

const explode = new Explode();
const units = new Units();

process.on('message', (message) => {
    if (Array.isArray(message)) {
        const splitQ = new Queue();

        for (let nid of message) {
            if (!nid) continue;
            splitQ.defer(split, nid);
        }

        splitQ.await((err) => {
            process.send({
                id: id,
                error: err,
                jobs: message.length
            });
        });
    } else {
        if (message.type && (message.type === 'end')) {
            kill();
        } else {
            init(message);
            id = message.id;
        }

        process.send({
            type: message.type || false,
            id: id,
            jobs: 0
        });
    }
});

/**
 * Only called by tests - child process kills this automatically
 * @return {boolean} Returns true after pool is ended.
 */
function kill() {
    pool.end();

    return true;
}

/**
 * Intilize the split child process with given arguments and then wait for data messages to process
 * @param {Object} o Argument object
 * @param {boolean} o.stdout Turn off stdout - true by default
 * @param {Array} o.post Array of non-default post operations to perform on output
 * @param {string} o.label Use non-default label formatter - ./label/titlecase is default
 * @param {Object} o.pool PG Pool Instance to use to communicate with the database
 * @return {boolean} Returns true after split is initialized
 */
function init(o) {
    opts = o;

    if (opts.stdout === undefined) opts.stdout = true; //Output to STDOUT by default - set to false for tests and (err, res) callback will be used

    opts.post = new Post(opts);

    pool = new pg.Pool(opts.pool);

    cluster = new Cluster({ pool: pool });

    if (!opts.label) {
        label = require('./label/titlecase')({ language: 'en', synonym: true });
    } else {
        label = require('./label/' + opts.label)({ language: opts.tokens.join(',') || 'en', synonym: true });
    }

    return true;
}

/**
 * Join addresses from a single MultiPoint collection into an array of [ Address, Corresponding Network Segments, Numbers ]
 * @param {Object} network GeoJSON FeatureCollection of network segments
 * @param {Array} coords Coordinates for address points
 * @param {Array} number Corresponding civic numbers - parallel to coordinates array
 * @return {Array} Return array of matched segments
 */
function distribute(network, coords, number) {
    let addressCluster = [];
    let numberCluster = [];

    network.features = network.features.filter((feat) => {
        if (turf.lineDistance(feat, 'kilometers') > 0.001) return true;
        return false;
    });

    for (let it = 0; it < coords.length; it++) {
        let pt = turf.point(coords[it]);

        let currentMatch = {
            dist: Infinity,
            ln: false
        };

        for (let ln_it = 0; ln_it < network.features.length; ln_it++) {
            let ln = network.features[ln_it].geometry;

            let dist = turf.distance(turf.pointOnLine(ln, pt), pt);

            if (dist < currentMatch.dist) {
                currentMatch = { dist: dist, ln: ln_it, num: number[it] };
            }
        }

        if (!addressCluster[currentMatch.ln]) addressCluster[currentMatch.ln] = [];
        if (!numberCluster[currentMatch.ln]) numberCluster[currentMatch.ln] = [];
        addressCluster[currentMatch.ln].push(pt.geometry.coordinates);
        numberCluster[currentMatch.ln].push(number[it]);
    }
    let segs = [];

    for (let it = 0; it < addressCluster.length; it++) {
        segs.push({
            address: addressCluster[it] ? turf.multiPoint(addressCluster[it]) : null,
            number: numberCluster[it] ? numberCluster[it] : null,
            network: turf.feature(network.features[it].geometry)
        });
    }

    return segs;
}


/**
 * Get a given cluster by nid and split into matched addr=>network segments and interpolize
 * @param {boolean} nid Network id in database to process
 * @param {Function} cb Callback function (err, res)
 * @return {Function} Return cb function
 */
function split(nid, cb) {
    pool.query(`
        SELECT
            network_cluster.text                AS ntext,
            network_cluster._text               AS network_text,
            address_cluster._text               AS address_text,
            ST_AsGeoJSON(network_cluster.geom)  AS network,
            ST_AsGeoJSON(address_cluster.geom)  AS address
        FROM
            network_cluster,
            address_cluster
        WHERE
            network_cluster.id = ${nid} AND
            network_cluster.address = address_cluster.id
    `, (err, res) => {
        if (err) return cb(err);

        res = res.rows[0];

        let network = JSON.parse(res.network);
        let address = JSON.parse(res.address);
        let number = [];
        let coords = [];

        let text = label({
            ntext: res.ntext,
            network_text: res.network_text,
            address_text: res.address_text.join(',')
        }, true);

        //Sort coords for consistent input into interpolate
        address.coordinates.sort((a, b) => {
            if (a[2] > b[2]) return 1;
            if (a[2] < b[2]) return -1;

            if (a[0] > b[0]) return 1;
            if (a[0] < b[0]) return -1;

            if (a[1] > b[1]) return 1;
            if (a[1] < b[1]) return -1;

            return 0;
        });

        //Convert 3 element coords to lat/lng + number array
        address.coordinates.forEach((addr) => {
            let num = units.decode(addr.pop());

            if (!num) return;

            number.push(num);
            coords.push(addr);
        });

        network = explode.join({
            type: 'FeatureCollection',
            features: [ turf.feature(network) ]
        });

        let segs = [];

        if (misc.hasDupAddressWithin(number.map((num) => { return num.num }), coords)) {
            let tmpSegs = distribute(network, coords, number);

            let potentialSegs = cluster.break(tmpSegs);

            if (potentialSegs) {
                segs = potentialSegs.map((seg) => {
                    return distribute(explode.split(seg.network), seg.address, seg.number)
                });
            } else {
                network = explode.split(network);
                segs = [ distribute(network, coords, number) ];
            }
        } else {
            network = explode.split(network);
            segs = [ distribute(network, coords, number) ];
        }


        let itpFinal = [];
        for (let seg of segs) {

            let potential = interpolize(text, seg, {
                debug: opts.debug,
                post: opts.post,
                country: opts.country
            });

            if (!potential) continue;

            itpFinal.push(potential);
        }

        let output = itpFinal.map((itp) => {
            return JSON.stringify(itp);
        }).join('\n') + '\n';

        if (opts.stdout) return process.stdout.write(output, cb);
        else return cb(null, itpFinal);
    });
}

module.exports = {
    distribute: distribute,
    split: split,
    init: init,
    kill: kill
}

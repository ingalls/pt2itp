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
/**
 * @class Split
 */
class Split {
    /**
     * Intilize the split child process with given arguments and then wait for data messages to process
     * @param {Object} o Argument object
     * @param {boolean} o.stdout Turn off stdout - true by default
     * @param {Array} o.post Array of non-default post operations to perform on output
     * @param {string} o.label Use non-default label formatter - ./label/titlecase is default
     * @param {Object} o.pool PG Pool Instance to use to communicate with the database
     * @return {boolean} Returns true after split is initialized
     */
    constructor(o) {
        this.opts = o;

        this.id = this.opts.id;

        this.misc = new Misc();
        this.explode = new Explode();
        this.units = new Units();

        this.pool = new pg.Pool(this.opts.pool);

        this.cluster = new Cluster({ pool: this.pool });

        if (this.opts.stdout === undefined) this.opts.stdout = true; //Output to STDOUT by default - set to false for tests and (err, res) callback will be used

        this.opts.post = new Post(this.opts);
    }

    /**
     * Get a given cluster by nid and split into matched addr=>network segments and interpolize
     * @param {boolean} nid Network id in database to process
     * @param {Function} cb Callback function (err, res)
     * @return {Function} Return cb function
     */
    split(nid, cb) {
        this.pool.query(`
            SELECT
                network_cluster.name || address_cluster.name    AS name,
                ST_AsGeoJSON(network_cluster.geom)::JSON        AS network,
                ST_AsGeoJSON(address_cluster.geom)::JSON        AS address
            FROM
                network_cluster,
                address_cluster
            WHERE
                network_cluster.id = ${nid}
                AND network_cluster.address = address_cluster.id
        `, (err, res) => {
            if (err) return cb(err);

            res = res.rows[0];

            if (!res.name.some(name => { return name.display.trim().length })) return cb();

            let number = [];
            let coords = [];

            //Sort coords for consistent input into interpolate
            res.address.coordinates.sort((a, b) => {
                if (a[2] > b[2]) return 1;
                if (a[2] < b[2]) return -1;

                if (a[0] > b[0]) return 1;
                if (a[0] < b[0]) return -1;

                if (a[1] > b[1]) return 1;
                if (a[1] < b[1]) return -1;

                return 0;
            });

            //Convert 3 element coords to lat/lng + number array
            res.address.coordinates.forEach((addr) => {
                let num = this.units.decode(addr.pop());

                if (!num) return;

                number.push(num);
                coords.push(addr);
            });

            let network = this.explode.join({
                type: 'FeatureCollection',
                features: [ turf.feature(res.network) ]
            });

            let segs = [];

            /*
             * If there are duplicate addresses - ensure they are actual duplicates and not distinct addresses
             * with the same number. If they are distinct, break network into 2 distinct features.
             */
            if (this.misc.hasDupAddressWithin(number.map((num) => { return num.num }), coords)) {
                let tmpSegs = this.distribute(network, coords, number);

                let potentialSegs = this.cluster.break(tmpSegs, nid);

                if (potentialSegs) {
                    segs = potentialSegs.map((seg) => {
                        return this.distribute(this.explode.split(seg.network), seg.address, seg.number)
                    });
                } else {
                    segs = [ this.distribute(this.explode.split(network), coords, number) ];
                }
            } else {
                segs = [ this.distribute(this.explode.split(network), coords, number) ];
            }

            let itpFinal = [];
            for (let seg of segs) {
                let itp = interpolize(seg, { debug: this.opts.debug });

                if (!itp) continue;

                res.name = res.name.filter(name => {
                    if (!name.display) return false;
                    return true;
                });

                itp.properties['carmen:text'] = res.name;
                if (this.opts.country) itp.properties['carmen:geocoder_stack'] = this.opts.country;

                itp = this.opts.post.feat(itp);

                itpFinal.push(itp);
            }

            let output = itpFinal.map((itp) => {
                return JSON.stringify(itp);
            }).join('\n') + '\n';

            if (this.opts.stdout) return process.stdout.write(output, cb);
            else return cb(null, itpFinal);
        });
    }

    /**
     * Join addresses from a single MultiPoint collection into an array of [ Address, Corresponding Network Segments, Numbers ]
     * @param {Object} network GeoJSON FeatureCollection of network segments
     * @param {Array} coords Coordinates for address points
     * @param {Array} number Corresponding civic numbers - parallel to coordinates array
     * @return {Array} Return array of matched segments
     */
    distribute(network, coords, number) {
        let addressCluster = [];
        let numberCluster = [];

        network.features = network.features.filter((feat) => {
            if (turf.lineDistance(feat) > 0.001) return true;
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
     * Only called by tests - child process kills this automatically
     * @return {boolean} Returns true after pool is ended.
     */
    kill() {
        this.pool.end();

        return true;
    }
}



let split;
process.on('message', (message) => {
    if (Array.isArray(message)) {
        const splitQ = new Queue();

        for (let nid of message) {
            if (!nid) continue;
            splitQ.defer((nid, done) => {
                split.split(nid, done);
            }, nid);
        }

        splitQ.await((err) => {
            process.send({
                id: split.id,
                error: err ? err.message : false,
                jobs: message.length
            });
        });
    } else {
        if (message.type && (message.type === 'end')) {
            split.kill();
        } else {
            split = new Split(message);
        }

        process.send({
            type: message.type || false,
            id: split.id,
            jobs: 0
        });
    }
});


module.exports = Split;

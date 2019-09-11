'use strict';

const Post = require('./post');

const interpolize = require('./interpolize');
const Explode = require('./explode');
const Cluster = require('./cluster');
const Queue = require('d3-queue').queue;
const turf = require('@turf/turf');
const pg = require('pg');

const Misc = require('../util/misc');

/**
 * @typedef {Object} Segment
 * @property {Object[]} address - MultiPoint GeoJSON features
 * @property {AddressNumber[]} number
 * @property {Array} network - LineString GeoJSON features
 * @property {Array} intersections - MultiPoint GeoJSON features
 * @property {Number|undefined} prevDelta Address number difference from previous cluster.
 * @property {Number|undefined} nextDelta Address number difference to next cluster
 */

/**
 * @typedef {Object} AddressNumber
 * @property {Number} id
 * @property {Boolean} output
 * @property {String} number
 * @property {Object} props
 */


/**
 * An individual feature that will be processed by the Split class
 * @class SplitFeat
 */
class SplitFeat {
    /**
     * Intilize the split child process with given arguments and then wait for data messages to process
     *
     * @param {Number} id Network Cluster ID for debugging
     * @param {Array} name Array of display objects pertaining to this feature
     * @param {Object} props Lookup array from id => properties
     * @param {Object} network Network LineString Geometry
     * @param {Object} address Address MultiPoint Geometry
     * @param {Object} intersections
     */
    constructor(id, name, props, network, address, intersections) {
        if (!name) throw new Error('name array required');
        if (!props) throw new Error('props object required');
        if (!network) throw new Error('network geometry required');
        if (!address) throw new Error('address geometry required');
        if (!intersections) throw new Error('intersections required');

        // Legacy Conversion
        for (const id of Object.keys(props)) {
            if (!props[id].props) props[id].props = {};
            props[id].number = String(props[id].number);
        }

        this.id = id;
        this.name = name;

        this.intersections = intersections || [];

        // id => { id, number, props } Object
        this.props = props;

        this.network = network;
        this.address = address;
    }

    /**
     * Create a new SplitFeat object given a network_cluster id & database connection
     *
     * @param {Object} pool Postgres Pool Object
     * @param {number} nid network_cluster id to build a SplitFeat from
     * @param {Function} cb (err, res) style callback
     */
    static from_id(pool, nid, cb) {
        pool.query(`
            SELECT
                network_cluster.names || address_cluster.names    AS name,
                ST_AsGeoJSON(network_cluster.geom)::JSON        AS network,
                ST_AsGeoJSON(address_cluster.geom)::JSON        AS address,
                json_agg(json_build_object(
                     'id', address.id,
                     'number', address.number,
                     'props', address.props,
                     'output', address.output
                )) AS address_props,
                (
                    SELECT
                        JSON_Agg(JSON_Build_Object(
                            'id', intersections.id,
                            'a_id', intersections.a_id,
                            'b_id', intersections.b_id,
                            'a_street', intersections.a_street,
                            'b_street', intersections.b_street,
                            'geom', ST_AsGeoJSON(intersections.geom)::JSON
                        ))
                    FROM
                        intersections
                    WHERE
                        intersections.a_id = ${nid}
                        OR intersections.b_id = ${nid}
                ) AS intersections
            FROM
                network_cluster
                    JOIN
                address_cluster ON (network_cluster.address = address_cluster.id)
                    JOIN
                address_cluster_id_to_z on (address_cluster.id = address_cluster_id_to_z.id)
                    JOIN
                address on (address_cluster_id_to_z.z = address.id)
            WHERE
                network_cluster.id = ${nid}
            GROUP BY
                network_cluster.names || address_cluster.names,
                network_cluster.geom,
                address_cluster.geom
        `, (err, res) => {
            if (err) return cb(err);

            res = res.rows[0];

            if (!res.addressprops) res.adressprops = [];
            if (!res.intersections) res.intersections = [];

            const lookup = {};
            for (const prop of res.address_props) {
                lookup[prop.id] = prop;
            }

            const feat = new SplitFeat(nid, res.name, lookup, res.network, res.address, res.intersections);

            return cb(null, feat);
        });
    }
}

/**
 * @class Split
 */
class Split {
    static async prepare(pg, cb) {
        try {
            await pg.query(`
                DROP TABLE IF EXISTS address_cluster_id_to_z
            `);
            await pg.query(`
                CREATE TABLE IF NOT EXISTS address_cluster_id_to_z as
                    SELECT
                        id,
                        ST_Z((ST_Dump(geom)).geom)::bigint AS z
                    FROM
                        address_cluster
            `);

            await pg.query(`
                CREATE INDEX IF NOT EXISTS
                    address_cluster_id_to_z__id
                ON
                    address_cluster_id_to_z (id)
            `);
            await pg.query(`
                CREATE INDEX IF NOT EXISTS
                    address_cluster_id_to_z__z
                ON
                    address_cluster_id_to_z (z)
            `);
            await pg.query(`
                CREATE INDEX IF NOT EXISTS
                    network_cluster__address_idx
                ON
                    network_cluster (address)
            `);
            await pg.query(`
                CREATE INDEX IF NOT EXISTS
                    intersections__a_id__idx
                ON
                    intersections (a_id)
            `);
            await pg.query(`
                CREATE INDEX IF NOT EXISTS
                    intersections_b_id__idx
                ON
                    intersections (b_id)
            `);
        } catch (err) {
            return cb(err);
        }

        return cb();
    }

    /**
     * Intilize the split child process with given arguments and then wait for data messages to process
     * @param {Object} o Argument object
     * @param {boolean} o.stdout Turn off stdout - true by default
     * @param {Array} o.post Array of non-default post operations to perform on output
     * @param {Array} o.props Properties to output on Cluster Geometries
     */
    constructor(o) {
        this.opts = o;

        this.id = this.opts.id;

        this.explode = new Explode();

        if (this.opts.stdout === undefined) this.opts.stdout = true; // Output to STDOUT by default - set to false for tests and (err, res) callback will be used

        this.props = o.props;
        this.post = new Post(this.opts, {
            intersections: this.opts.intersections,
            props: this.opts.props
        });
    }

    /**
     * Get a given cluster by nid and split into matched addr=>network segments and interpolize
     * @param {SplitFeat} feat SplitFeat to process
     * @param {Function} cb Callback function (err, res)
     * @return {Function} Return cb function
     */
    split(feat, cb) {
        if (!(feat instanceof SplitFeat)) return cb(new Error('feat param must be SplitFeat class'));

        if (!feat.name.some((name) => { return name.display.trim().length; })) return cb();

        const props = [];

        // Sort coords for consistent input into interpolate
        feat.address.coordinates.sort((a, b) => {
            if (parseInt(feat.props[a[2]].number) > parseInt(feat.props[b[2]].number)) return 1;
            if (parseInt(feat.props[a[2]].number) < parseInt(feat.props[b[2]].number)) return -1;

            if (a[0] > b[0]) return 1;
            if (a[0] < b[0]) return -1;

            if (a[1] > b[1]) return 1;
            if (a[1] < b[1]) return -1;

            return 0;
        });

        const intersections = feat.intersections || [];

        const coords = feat.address.coordinates.map((coords) => {
            props.push(feat.props[coords[2]]);
            return coords;
        });

        const network = this.explode.join({
            type: 'FeatureCollection',
            features: [turf.feature(feat.network)]
        });

        let segs = [];

        function intersectionsToPoints(intersections) {
            return intersections.map((intsec) => {
                return turf.point(intsec.geom.coordinates);
            });
        }
        /*
         * If there are duplicate addresses - ensure they are actual duplicates and not distinct addresses
         * with the same number. If they are distinct, break network into 2 distinct features.
         */
        if (Misc.hasDupAddressWithin(props.map((prop) => { return prop.number; }), coords)) {
            const tmpSegs = this.distribute(network, coords, props, intersections);

            const potentialSegs = Cluster.break(tmpSegs.segs, feat.id);

            if (potentialSegs) {
                segs = potentialSegs.map((seg) => {
                    return this.distribute(this.explode.split(seg.network, intersectionsToPoints(seg.intersections)),
                        seg.address, seg.number, seg.intersections, seg.prevDelta, seg.nextDelta);
                });
            } else {
                segs = [this.distribute(this.explode.split(network, intersectionsToPoints(intersections)), coords, props, intersections)];
            }
        } else {
            segs = [this.distribute(this.explode.split(network, intersectionsToPoints(intersections)), coords, props, intersections)];
        }

        const itpFinal = [];
        for (const split of segs) {
            let itp = interpolize(split, { debug: this.opts.debug });

            if (!itp) continue;

            feat.name = feat.name.filter((name) => {
                if (!name.display) return false;
                return true;
            });

            itp.properties['carmen:text'] = feat.name;
            if (this.opts.country) itp.properties['carmen:geocoder_stack'] = this.opts.country;

            itp.properties['internal:nid'] = feat.id;

            itp = this.post.feat(itp);

            itpFinal.push(itp);
        }

        const output = itpFinal.map((itp) => {
            return JSON.stringify(itp);
        }).join('\n') + '\n';

        if (this.opts.stdout) return process.stdout.write(output, cb);
        else return cb(null, itpFinal);
    }

    /**
     * Join addresses from a single MultiPoint collection into an array of [ Address, Corresponding Network Segments, Numbers ]
     *
     * @param {Object} network GeoJSON FeatureCollection of network segments
     * @param {Array} coords Coordinates for address points
     * @param {AddressNumber[]} props Corresponding address properties - parallel to coordinates array
     * @param {Array} intersections Corresponding intersection points
     * @param {Number|undefined} prevDelta Address number difference from previous cluster.
     * @param {Number|undefined} nextDelta Address number difference to next cluster
     * @return {Segment[]} Return array of matched segments
     */
    distribute(network, coords, props, intersections, prevDelta, nextDelta) {
        const addressCluster = [];
        const numberCluster = [];

        network.features = network.features.filter((feat) => {
            if (turf.lineDistance(feat) > 0.001) return true;
            return false;
        });

        // Match Address points to closest segment
        for (let it = 0; it < coords.length; it++) {
            const pt = turf.point(coords[it]);

            let currentMatch = {
                dist: Infinity,
                ln: false
            };

            for (let ln_it = 0; ln_it < network.features.length; ln_it++) {
                const ln = network.features[ln_it].geometry;

                const dist = turf.distance(turf.pointOnLine(ln, pt), pt);

                if (dist < currentMatch.dist) {
                    currentMatch = { dist: dist, ln: ln_it, num: props[it] };
                }
            }

            if (!addressCluster[currentMatch.ln]) addressCluster[currentMatch.ln] = [];
            if (!numberCluster[currentMatch.ln]) numberCluster[currentMatch.ln] = [];
            addressCluster[currentMatch.ln].push(pt.geometry.coordinates);
            numberCluster[currentMatch.ln].push(props[it]);
        }

        const segs = [];

        for (let it = 0; it < addressCluster.length; it++) {
            segs.push({
                address: addressCluster[it] ? turf.multiPoint(addressCluster[it]) : null,
                number: numberCluster[it] ? numberCluster[it] : null,
                network: turf.feature(network.features[it].geometry),
                intersections: []
            });
        }

        // Match intersections to closest segment
        for (const intsec of intersections) {
            let currentMatch = {
                dist: Infinity,
                seg: false
            };

            for (const seg of segs) {
                try {
                    const dist = turf.distance(turf.pointOnLine(seg.network.geometry, intsec.geom), intsec.geom);

                    if (dist < currentMatch.dist) {
                        currentMatch = { dist: dist, seg: seg };
                    }
                } catch (err) {
                    console.error('---');
                    console.error('CurrentMatch', JSON.stringify(currentMatch.seg));
                    console.error('Intersections', JSON.stringify(intersections));
                    console.error('IntSec', JSON.stringify(intsec));
                }
            }

            currentMatch.seg.intersections.push(intsec);
        }

        for (const seg of segs) {
            if (!seg.intersections) seg.intersections = [];
        }

        return { segs, prevDelta, nextDelta };
    }
}

let split, pool;
process.on('message', (message) => {
    if (Array.isArray(message)) {
        const splitQ = new Queue(1);

        for (const nid of message) {
            if (!nid) continue;
            splitQ.defer((nid, done) => {
                SplitFeat.from_id(pool, nid, (err, feat) => {
                    if (err) return done(err);

                    split.split(feat, done);
                });
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
            pool.end();
        } else {
            pool = new pg.Pool(message.pool);
            split = new Split(message);
        }

        process.send({
            type: message.type || false,
            id: split.id,
            jobs: 0
        });
    }
});


module.exports.Split = Split;
module.exports.SplitFeat = SplitFeat;

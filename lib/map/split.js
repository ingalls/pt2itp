'use strict';

const Post = require('./post');

const interpolize = require('./interpolize').interpolize;
const Explode = require('./explode');
const Cluster = require('./cluster');
const asGeoJSON = require('./asgeojson.js');
const Queue = require('d3-queue').queue;
const turf = require('@turf/turf');
const pg = require('pg');

/**
 * @typedef {Object} AddressNumber  TODO rename
 *
 * @property {Number} id
 * @property {Boolean} outlier - Address will not be used to calculate interpolation ranges if true. TODO implement
 * @property {Boolean} output - Address will be in the final point output in true.
 * @property {String} number - The address number itself. TODO remove
 * @property {Object} props - Address properties
 */

/**
 * @typedef {Object} AttachedPoints
 *
 * @property {Number} dist - distance from line segment in meters
 * @property {Number} location - distance along line from origin in meters
 * @property {Number[]} coords - lon, lat
 * @property {AddressNumber} props
 * @property {Number} segment - index of matched segment in network.features array
 * @property {Number} idx - index of corresponding element in coords array
 */

/**
 * Internal representation of the road segment geometry, addresses and intersection points that can
 * be used to calculate interpolation ranges.
 *
 * @typedef {Object} AddressCluster
 * @property {Object} network - GeoJSON LineString
 * @property {AttachedPoints[]} addressPoints
 * @property {AttachedPoints[]} intersectionPoints
 *
 */

/**
 * Internal representation of single interpolable range within a address cluster.
 *
 * @typedef {Object} InterpolableSegment
 *
 * @property {Object} network - GeoJSON lineString
 * @property {AttachedPoints[]} addressPoints
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

const midpoint = (addressPoints, breakIndex) => {
    const lower = addressPoints[breakIndex].location;
    const upper = addressPoints[breakIndex + 1].location;

    return lower + ((upper - lower) / 2);
};

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
     *
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

        // Discard network segments that are less that 1 meter
        network.features = network.features.filter((feat) => turf.lineDistance(feat) > 0.001);

        // Place points on line
        let addressLocations = Split.attachPoints(network, coords, props);

        // Run metrics
        // TODO For compatibility, remove later
        addressLocations = addressLocations.map((v) => {
            v.number = v.props.number;
            return v;
        });
        const distDelta = addressLocations.reduce((m, v, i, a) => {
            if (i > 0) {
                const deltaNum = a[i].number - a[i - 1].number;
                m.push([a[i].location, deltaNum > 0 ? 1 : -1]);
            }
            return m;
        }, []);
        // end compatibility

        const breaks = [];
        Cluster.detectCliffs(breaks, addressLocations, distDelta);
        Cluster.detectPeaks(breaks, addressLocations, distDelta);

        // Place intersections on line
        const intersectionCoords = [];
        const intersectionProps = [];
        for (const intersection of intersections) {
            intersectionCoords.push(intersection.geom.coordinates);
            intersectionProps.push({
                a_id: intersection.a_id,
                a_street: intersection.a_street,
                b_id: intersection.b_id,
                b_street: intersection.b_street
            });
        }
        const intersectionLocations = Split.attachPoints(network, intersectionCoords, intersectionProps);

        // Create a cluster for each distinct network feature
        const clusters = [];
        for (let i = 0; i < network.features.length; i++) {
            clusters[i] = {
                network: network.features[i],
                addressPoints: [],
                intersectionPoints: []
            };
        }
        for (let i = 0; i < addressLocations.length; i++) {
            const pt = addressLocations[i];
            clusters[pt.segment].addressPoints.push(pt);
        }
        for (let i = 0; i < intersectionLocations.length; i++) {
            const pt = intersectionLocations[i];
            clusters[pt.segment].intersectionPoints.push(pt);
        }

        // TODO call splitCluster on each cluster in the array.
        // clusters = cluster.reduce(splitClusters, [], breaks);

        const itpFinal = [];
        for (const cluster of clusters) {
            // TODO we demand address points b/c we use the interpolated network line to get a
            // centerpoint for the feature. There are other ways.
            if (cluster.addressPoints.length === 0) continue;

            const itps = interpolize(Split.splitSegments(cluster), { debug: this.opts.debug });
            const pts = asGeoJSON.addressPointsFeature(cluster.addressPoints);

            // Intersections can be disabled, we only add them to the output if requested.
            let ints;
            if (this.opts.intersections && feat.intersections) {
                ints = asGeoJSON.intersectionFeature(cluster.intersectionPoints, feat.id);
            }

            const result = asGeoJSON.mergeFeatures(itps, pts, ints);

            result.properties['carmen:text'] = feat.name.filter((name) => !!name.display);
            result.properties['internal:nid'] = feat.id;

            if (this.opts.country) result.properties['carmen:geocoder_stack'] = this.opts.country;

            itpFinal.push(this.post.feat(result));
        }

        const output = itpFinal.map((itp) => {
            return JSON.stringify(itp);
        }).join('\n') + '\n';

        if (this.opts.stdout) return process.stdout.write(output, cb);
        else return cb(null, itpFinal);
    }

    /**
     * Attach addresses from a single MultiPoint collection onto Network
     *
     * @param {Object} network GeoJSON LineString
     * @param {Array.<Number[]>} coords Coordinates for address points
     * @param {AddressNumber[] | undefined} props Corresponding address properties - parallel to coordinates array
     * @return {AttachedPoints[]}
     */
    static attachPoints(network, coords, props) {
        const attached = new Array(coords.length);

        for (let i = 0; i < coords.length; i++) {
            for (let j = 0; j < network.features.length; j++) {

                const pt = turf.pointOnLine(network.features[j], coords[i]);

                if (attached[i] === undefined ||  attached[i].dist > pt.properties.dist) {
                    attached[i] = {
                        coords: [coords[i][0], coords[i][1]],
                        dist: pt.properties.dist,
                        location: pt.properties.location,
                        props: props === undefined ? undefined : props[i],
                        segment: j
                    };
                }
            }
        }

        attached.sort((a, b) => {
            if (a.segment === b.segment) {
                return a.location -  b.location;
            } else {
                return a.segment - b.segment;
            }
        });

        return attached;
    }

    /**
     * Split a cluster at provided locations
     *
     * @param {AddressCluster} cluster - address cluster to split
     * @param {Number[]} breaks - indexes of the addressPoints array at which to split the clusters
     * @return {AddressCluster[]}
     */
    static splitCluster(cluster, breaks) {
        if (!breaks || breaks.length === 0) return [cluster];

        const res = [];

        breaks.sort((a, b) => a - b);

        let intsecIdx = 0;
        for (let i = 0; i < breaks.length; i++) {
            const isFirst = i === 0;
            const isLast = i === breaks.length - 1;

            const breakStartLocation = isFirst ? 0 : midpoint(cluster.addressPoints, breaks[i - 1]);
            const breakEndLocation = midpoint(cluster.addressPoints, breaks[i]);

            if (res.length === 0 && breakStartLocation === breakEndLocation) {
                breaks[i] = isFirst ? 0 : breaks[i - 1];
                continue;
            }

            const addrStart = isFirst ? 0 : breaks[i - 1] + 1;
            const addrEnd = breaks[i] + 1;

            const intersectionPoints = [];
            let intsec = cluster.intersectionPoints[intsecIdx];
            while (intsec && intsec.location >= breakStartLocation && intsec.location <= breakEndLocation) {
                intersectionPoints.push(intsec);
                intsec = cluster.intersectionPoints[++intsecIdx];
            }

            const addressPoints = cluster.addressPoints.slice(addrStart, addrEnd);

            if (breakStartLocation === breakEndLocation) {
                res[res.length - 1].addressPoints.push(...addressPoints);
                res[res.length - 1].intersectionPoints.push(...intersectionPoints);
            } else {
                res.push({
                    network: turf.lineSliceAlong(cluster.network, breakStartLocation, breakEndLocation),
                    addressPoints,
                    intersectionPoints
                });
            }

            // add remaining segment
            if (isLast) {
                const finalBreakStart = breakEndLocation;
                const finalBreakEnd = turf.length(cluster.network);

                const finalIntersectionPoints = [];
                while (intsecIdx < cluster.intersectionPoints.length) {
                    finalIntersectionPoints.push(intsec);
                    intsec = cluster.intersectionPoints[++intsecIdx];
                }

                const finalAddressPoints = cluster.addressPoints.slice(breaks[i] + 1);

                if (finalBreakStart === finalBreakEnd) {
                    res[res.length - 1].addressPoints.push(...finalAddressPoints);
                    res[res.length - 1].intersectionPoints.push(...finalIntersectionPoints);
                } else {
                    res.push({
                        network: turf.lineSliceAlong(cluster.network, finalBreakStart, finalBreakEnd),
                        addressPoints: finalAddressPoints,
                        intersectionPoints: finalIntersectionPoints
                    });
                }
            }
        }

        return res;
    }

    /**
     * Break a cluster into segments for interpolation.
     *
     * @param {AddressCluster} cluster
     * @param {Number[]} breaks
     * @return {InterpolableSegment[]}
     */
    static splitSegments(cluster) {
        if (cluster.network.type !== 'Feature' || cluster.network.geometry.type !== 'LineString') {
            throw new Error('Refusing to split segment for unexpected geometry');
        }

        const len = turf.lineDistance(cluster.network);

        // TODO capture interpolation segment length limit in global

        // Assemble start & end location for interpolation segments, start with first use intersectons.
        const breaks = new Set();
        breaks.add(len);
        for (const intersection of cluster.intersectionPoints) {
            if (intersection.location !== 0) {
                breaks.add(intersection.location);
            }
        }

        // If the total network length is over 500m review interpolation segments
        if (len > 0.5) {
            const dists = Array.from(breaks);
            let prev = 0;
            for (let i = 0; i < breaks.length; i++) {
                // If a segment is over 500m, break it.
                if (dists[i] - prev > 0.5) {
                    for (let d = prev; d <= dists[i]; d += 0.5) breaks.add(d);
                }
                prev = dists[i];
            }
            if (dists.length === 1) {
                // Handle unsplit networks
                for (let d = 0; d <= len; d += 0.5) breaks.add(d);
            }
        }

        const dists = Array.from(breaks);
        dists.sort((a, b) => a - b);

        const segments = [];
        let currentPoints = [];
        let addressIdx = 0;
        for (let i = 0; i < dists.length; i++) {
            const start = i === 0 ? 0 :  dists[i - 1];
            const end = dists[i];

            // Ignore 0 length segments, ie; from intersections at start or end of segment
            if (start === end)  continue;

            // Review remaining addresses and attempt to match them to this segment.
            while (addressIdx < cluster.addressPoints.length) {
                const address = cluster.addressPoints[addressIdx];
                if (address.location >= start && address.location <= end) {
                    currentPoints.push(address);
                    addressIdx++;
                } else {
                    if (currentPoints.length > 0) {
                        segments.push({
                            network: turf.lineSliceAlong(cluster.network, start, end),
                            addressPoints: currentPoints
                        });
                        currentPoints = [];
                    }
                    break; // Last reviewed address didn't fit, break and try next segment.
                }
            }

            // All addresses have been reviewed, make sure we have a segments accounted for so that
            // the network doesn't have missing pieces.
            if (addressIdx === cluster.addressPoints.length) {
                segments.push({
                    network: turf.lineSliceAlong(cluster.network, start, end),
                    addressPoints: currentPoints
                });
                currentPoints = [];
            }
        }

        return segments;
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

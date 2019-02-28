const fs = require('fs');
const turf = require('@turf/turf');
const Queue = require('d3-queue').queue;
const _ = require('lodash');
const wk = require('wellknown');
const simple = require('simple-statistics');
const Misc = require('../util/misc');
const misc = new Misc();
const linker = require('./linker');
const numCaseChanges = require('../label/util').numCaseChanges;

/**
 * @class Cluster
 */
class Cluster {
    constructor(opts) {
        opts = opts || {};

        if (opts.warn) {
            this.warn = fs.createWriteStream(args.warn, {
                flags: 'a'
            });
        }

        this.pool = opts.pool;
        if (opts.label) {
            this.label = require('../label/' + opts.label)();
        } else {
            this.label = require('../label/titlecase')();
        }
    }

    /**
     * Attenpt to break a single NetworkCluster into n network clusters where there are dup addresses
     *
     * --Dup accross segments -- (TYPE: ClusterDup)
     * Output:        | Input:
     * --1--   --2--  | --1a-- --1b--
     * 1 2 3   3 2 1  | 1 2 3   3 2 1
     *
     *
     * -- Dup within Segment -- (TYPE SegDup)
     * Output:        | Input:
     * --1--   --2--  | ------1------
     * 1 2 3   3 2 1  | 1 2 3   3 2 1
     *
     * Note: This uses the misc.hasDupAddresswithin test and as such assumes ordered numbers within each segment
     *
     * @param {Array} segs Array of addr/number/lnstring segmtents to attempt to split
     * @param {number} id Optional network_cluster id for debugging
     * @return {Array} New segments array
     */
    static break(segs, id) {
        //Classify into SegDup or Clusterdup
        let segDup = []; //Parallel array to segs of whether it contains a dup (bool)
        for (let seg_it = 0; seg_it < segs.length; seg_it++) {
            const seg = segs[seg_it];

            if (!seg.number) {
                segDup[seg_it] = false;
            } else if (Misc.hasDupAddressWithin(seg.number.map(prop => { return prop.number }), seg.address.geometry.coordinates)) {
                segDup[seg_it] = true;
            } else {
                segDup[seg_it] = false;
            }
        }

        //Attempt to handle and split a ClusterDup
        //TODO: This currently only handles segs with a length of 2, a full implmentation to handle
        //  segs > 2 has yet to be written
        if (!segDup.some((dup) => { return dup }) && segs.length === 2) {
            return segs.map(seg => {
                return {
                    number: seg.number,
                    address: seg.address.geometry.coordinates,
                    network: turf.featureCollection([seg.network]),
                    intersections: seg.intersections
                };
            });
        } else if (!segDup.some((dup) => { return dup })) {
            if (this.warn) {
                this.warn.write(`WARN: detected unhandled ClusterDup on network_cluster.id: ${id}\n`);
            }
        }

        let orphanSegs = []; //Segs that needs to be matched based on prox. at the end with segments in newSegs
        let newSegs = []; //Break apart cluster into new clusters

        //Attempt to handle and split a SegDup
        for (let seg_it = 0; seg_it < segs.length; seg_it++) {
            const seg = segs[seg_it];

            //If the seg doesn't have addresses, or has addresses with no dups,
            //don't attempt to break it, set it aside in orphanSegs for later
            if (!segDup[seg_it] || !seg.address || turf.lineDistance(seg.network) < 1) {
                orphanSegs.push(seg);
                continue;
            }

            //Dist array contains an ordering of the address points based on distance to origin
            let dist = [];
            for (let addr_it = 0; addr_it < seg.number.length; addr_it++) {
                let addr = turf.point(seg.address.geometry.coordinates[addr_it]);
                let linept = turf.pointOnLine(seg.network, addr);

                let res = {
                    distOnLine: turf.lineDistance(turf.lineSlice(turf.point(seg.network.geometry.coordinates[0]), linept, seg.network)),
                    distFromLine: turf.distance(addr, linept),
                    geometry: addr,
                    number: parseInt(seg.number[addr_it].number),
                    original: seg.number[addr_it],
                    output: seg.number[addr_it].output
                };

                dist.push(res);
            }

            //Sort from origin => end
            dist.sort((a, b) => {
                if (a.distOnLine < b.distOnLine) return -1;
                if (a.distOnLine > b.distOnLine) return 1;
                if (a.distOnLine === b.distOnLine) return a.distFromLine - b.distFromLine;
            });

            //Calculate the dist delta for the segments, basically an array with a +1, 0, or -1 to show the relationship
            //with the previous address. IE: [1, 3, 5, 9, 9, 5, 3] => [1, 1, 1, 1, 0, -1, -1 ]
            let distDelta = [];
            for (let d_it = 1; d_it < dist.length; d_it++) {
                let deltaNum = dist[d_it].number - dist[d_it - 1].number;
                distDelta.push([dist[d_it].distOnLine, deltaNum > 0 ? 1 : -1]);
            }

            let breaks = []; //Array indices to break on

            { //Address Cliff Detection - 1 2 3 1 2 3
                let floating_min = 0;
                let floating_max = 0;
                let floating_delta = null;
                for (let dist_it = 0; dist_it < dist.length - 1; dist_it++) {
                    if (!floating_delta) floating_delta = distDelta[dist_it][1];

                    //Anytime the dist delta changes, check it for an address cliff
                    if (floating_delta !== distDelta[dist_it][1] && dist[dist_it].number < (floating_max - floating_min) * 0.25) {
                        breaks.push(dist_it);
                        floating_min = 0;
                        floating_max = 0;
                        floating_delta = null;
                        continue;
                    }

                    if (dist[dist_it].number < floating_min) floating_min = dist[dist_it].number;
                    if (dist[dist_it].number > floating_max) floating_max = dist[dist_it].number;
                }
            }

            { // Address Hump Detecton - 1 2 3 3 2 1
                let avg_window = Math.min(dist.length / 10, 10);

                //Perform a moving average filter to reduce random noise and allow identification as a next step
                const avg = distDelta.map((el) => {
                    return el[1];
                }).map((el, idx, arr) => {
                    return arr.filter((el_sub, idx_sub) => {
                        return idx_sub <= idx && idx_sub > idx - avg_window
                    }).reduce((curr, last) => {
                        return (curr + last);
                    }) / (idx || 1);
                });

                let floating_sin = avg[0] > 0 ? true : false;
                for (let avg_it = 1; avg_it < avg.length; avg_it++) {
                    if (floating_sin === avg[avg_it] > 0 ? true : false) continue;

                    let curr_break = null;

                    //Determine exact beginning of new avg - this loop checks if the actual number is before the avg crosses the x axis
                    for (let avg_sub_it = avg_it - 1; avg_sub_it >= Math.max(0, avg_it - Math.ceil(avg_window / 2)); avg_sub_it--) {
                        if (floating_sin !== distDelta[avg_sub_it] > 0 ? true : false) curr_break = avg_sub_it;
                    }

                    if (floating_sin !== distDelta[avg_it] > 0 ? true : false) curr_break = avg_it;

                    //and if no value is found, check if it crosses after
                    if (!curr_break) {
                        for (let avg_sub_it = avg_it + 1; avg_sub_it <= Math.min(avg.length, avg_it + Math.ceil(avg_window / 2)); avg_sub_it++) {
                            if (floating_sin !== distDelta[avg_sub_it] > 0 ? true : false) curr_break = check;
                        }
                    }

                    if (curr_break) {
                        breaks.push(curr_break);
                        floating_sin = avg[avg_it] > 0 ? true : false;
                    }
                }
            }

            if (!breaks.length) {
                orphanSegs.push(seg);
                continue;
            }

            breaks = breaks.sort((a, b) => a - b);

            //For Each break start at the previous (or 0th) element and return the address/network/numbers in between
            for (let brk_it = 0; brk_it < breaks.length; brk_it++) {
                const brk = breaks[brk_it];

                const isFirst = breaks[brk_it - 1] ? false : true;

                const brk_dist_start = isFirst ? 0 : dist[breaks[brk_it - 1]].distOnLine + (dist[breaks[brk_it - 1] + 1].distOnLine - dist[breaks[brk_it - 1]].distOnLine) / 2;
                const brk_dist_end = dist[brk].distOnLine + (dist[brk + 1].distOnLine - dist[brk].distOnLine) / 2;

                newSegs.push({
                    address: turf.multiPoint(dist.slice(isFirst ? 0 : breaks[brk_it - 1] + 1, brk + 1).map((d) => {
                        return d.geometry.geometry.coordinates;
                    })).geometry.coordinates,
                    number: dist.slice(isFirst ? 0 : breaks[brk_it - 1] + 1, brk + 1).map((d) => {
                        return d.original;
                    }),
                    network: brk_dist_start !== brk_dist_end ? turf.lineSliceAlong(seg.network, brk_dist_start, brk_dist_end) : false,
                    intersections: []
                });
            }

            //Push remaining portion of segment
            let brk_dist_start = dist[breaks[breaks.length - 1]].distOnLine + (dist[breaks[breaks.length - 1] + 1].distOnLine - dist[breaks[breaks.length - 1]].distOnLine) / 2;
            let brk_dist_end = turf.length(seg.network);

            newSegs.push({
                address: turf.multiPoint(dist.slice(breaks[breaks.length - 1] + 1).map((d) => {
                    return d.geometry.geometry.coordinates;
                })).geometry.coordinates,
                number: dist.slice(breaks[breaks.length - 1] + 1).map((d) => {
                    return d.original;
                }),
                network: brk_dist_start !== brk_dist_end ? turf.lineSliceAlong(seg.network, brk_dist_start, brk_dist_end) : false,
                intersections: []
            });
        }

        if (!newSegs.length) return false;

        newSegs = newSegs.map((seg) => {
            if (seg.network) {
                seg.network = turf.featureCollection([seg.network]);
            } else {
                seg.network = turf.featureCollection([]);
            }

            return seg;
        });

        for (let oSeg of orphanSegs) {
            let closest = {
                dist: false,
                ele: false
            }

            for (let n_it = 0; n_it < newSegs.length; n_it++) {
                let nseg = newSegs[n_it];

                if (!nseg.network.features.length) continue;

                let d = turf.distance(turf.center(oSeg.network), turf.center(nseg.network));

                if (!closest.dist || closest.dist > d) {
                    closest.dist = d;
                    closest.ele = n_it;
                }
            }

            newSegs[closest.ele].network ? newSegs[closest.ele].network.features.push(oSeg.network) : newSegs[closest.ele].network = { type: 'FeatureCollection', features: [oSeg.network] };
            if (oSeg.address && oSeg.number) {
                newSegs[closest.ele].address = newSegs[closest.ele].address.concat(oSeg.address.geometry.coordinates);
                newSegs[closest.ele].number = newSegs[closest.ele].number.concat(oSeg.number);
            }
        }

        return newSegs;
    }

    /**
     * Cluster orphan address points
     * @param {Function} cb Callback in (err, res)
     * @return {Function} Callback
     */
    orphan(cb) {
        this.pool.query(`
            INSERT INTO address_orphan_cluster (name, geom)
                SELECT
                    addr.names,
                    ST_Multi(ST_CollectionExtract(addr.geom, 1)) AS geom
                FROM (
                    SELECT
                        names,
                        unnest(ST_ClusterWithin(geom, 0.005)) AS geom
                    FROM address
                    WHERE netid IS NULL
                    GROUP BY names
                ) addr;
        `, (err, res) => {
            return cb(err);
        });
    }

    /**
     * Cluster address points that have been matched to the network
     * @param {Function} cb Callback in (err, res)
     * @return {Function} Callback
     */
    address(cb) {
        this.pool.query(`
            BEGIN;

            INSERT INTO address_cluster (name, geom, netid)
                SELECT
                    JSON_Agg(a.names||('{ "freq": '::TEXT||ST_NPoints(geom)||'}')::JSONB ORDER BY ST_NPoints(geom) DESC),
                    ST_Multi(ST_CollectionExtract(ST_Collect(a.geom), 1)) AS geom,
                    a.netid
                FROM (
                    SELECT
                        jsonb_array_elements(names) AS names,
                        netid,
                        ST_Multi(ST_CollectionExtract(ST_Collect(geom), 1)) AS geom
                    FROM
                        address
                    WHERE
                        netid IS NOT NULL
                    GROUP BY
                        netid,
                        names
                ) a
                GROUP BY
                    netid;

            UPDATE network_cluster n
                SET address = a.id
                FROM address_cluster a
                WHERE n.id = a.netid;

            COMMIT;
        `, (err, res) => {
            return cb(err);
        });
    }

    /**
     * Cluster network lines within a given segment
     * @param {Function} cb Callback in (err, res)
     * @return {Function} Callback
     */
    network(cb) {
        this.pool.query(`
            BEGIN TRANSACTION;

            INSERT INTO network_cluster(geom)
                SELECT
                    geom
                FROM (
                    SELECT
                        names,
                        ST_Multi(ST_CollectionExtract(netw.geom, 2)) AS geom
                    FROM (
                        SELECT
                            json_array_elements(json_array_elements(JSON_AGG(names)))::JSONB AS names,
                            unnest(ST_ClusterWithin(geom, 0.005)) AS geom
                        FROM network
                        WHERE names->0->>'tokenized' != ''
                        GROUP BY names->0
                    ) netw
                    GROUP BY
                        geom,
                        names
                    ORDER BY
                        names->>'priority'
                ) final
                WHERE geom IS NOT NULL
                GROUP BY geom;

            -- extracts distinct Z coordinates from a multilinestring
            CREATE OR REPLACE FUNCTION get_source_ids(geometry(MultiLineStringZ))
            RETURNS BIGINT[]
            AS
            $$
            DECLARE
                mls ALIAS FOR $1;
                ls geometry(LineStringZ);
                retVal BIGINT[];
                j BIGINT;
            BEGIN
                j := 1;
                FOR ls IN SELECT (ST_Dump(mls)).geom LOOP
                    FOR i IN 1..ST_NPoints(ls) LOOP
                        retVal[j] := ST_Z(ST_PointN(ls, i));
                        j := j + 1;
                    END LOOP;
                END LOOP;
                retVal := ARRAY(SELECT DISTINCT UNNEST(retVal) ORDER BY 1);
            RETURN retVal;
            END;
            $$
            LANGUAGE plpgsql
               STABLE
            RETURNS NULL ON NULL INPUT;

            UPDATE network_cluster
                SET source_ids = get_source_ids(geom);

            UPDATE network_cluster
                SET name = final.name
                FROM (
                    SELECT
                        joined.id,
                        json_agg(joined.name) AS name
                    FROM (
                        SELECT DISTINCT
                            nc.id,
                            jsonb_array_elements(n.names) AS name
                        FROM
                            (
                                SELECT
                                    id,
                                    unnest(source_ids) AS sources
                                FROM
                                    network_cluster
                            ) nc,
                            network n
                        WHERE n.id = sources
                    ) joined
                    GROUP BY joined.id
                ) final
                WHERE
                    final.id = network_cluster.id;

            ALTER TABLE network_cluster
                ADD COLUMN geom_flat geometry(geometry, 4326);

            UPDATE network_cluster
                SET geom_flat = ST_SetSRID(ST_Force2D(geom), 4326);

            ALTER TABLE network_cluster
                DROP COLUMN geom;

            ALTER TABLE network_cluster
                RENAME geom_flat TO geom;

            COMMIT;
        `, (err, res) => {
            return cb(err);
        });
    }

    /**
    * Optimize cluster databases with Geometric indexes
    * @param {Function} cb Callback in (err, res)
    * @return {Function} cb
    */
    optimize(cb) {
        this.pool.query(`
            BEGIN;
            CREATE INDEX IF NOT EXISTS network_cluster_gix ON network_cluster USING GIST (geom);
            CREATE INDEX IF NOT EXISTS address_cluster_gix ON address_cluster USING GIST (geom);

            CLUSTER address_cluster USING address_cluster_gix;
            CLUSTER network_cluster USING network_cluster_gix;

            ANALYZE network_cluster;
            ANALYZE address;
            COMMIT;
        `, (err, res) => {
            return cb(err);
        });
    }
}

module.exports = Cluster;

const buffer = require('./buffer');
const dist = require('fast-levenshtein').get;
const Cursor = require('pg-cursor');
const turf = require('@turf/turf');
const Queue = require('d3-queue').queue;
const _ = require('lodash');
const wk = require('wellknown');
const simple = require('simple-statistics');
const Misc = require('./misc');
const misc = new Misc();

/**
 * @class Cluster
 */
class Cluster {
    constructor(pool) {
        this.pool = pool;
    }

    break(segs) {
        let newSegs = []; //Break apart cluster into two new clusters

        let orphanSegs = []; //Segs that needs to be matched based on prox. at the end with segments in newSegs

        for (let seg of segs) {
            if (!seg.address || turf.lineDistance(seg.network) < 1) {
                orphanSegs.push(seg);
                continue;
            }

            let dist = [];

            for (let addr_it = 0; addr_it < seg.number.length; addr_it++) {
                let addr = turf.point(seg.address.geometry.coordinates[addr_it]);
                let linept = turf.pointOnLine(seg.network, addr);

                let res = {
                    'distOnLine': turf.lineDistance(turf.lineSlice(turf.point(seg.network.geometry.coordinates[0]), linept, seg.network), 'kilometers'),
                    'distFromLine': turf.distance(addr, linept, 'kilometers'),
                    'geometry': addr,
                    'number': parseInt(seg.number[addr_it])
                };

                dist.push(res);
            }

            //Sort from origin => end
            dist.sort((a, b) => {
                if (a.distOnLine < b.distOnLine) return -1;
                if (a.distOnLine > b.distOnLine) return 1;
                if (a.distOnLine === b.distOnLine) {
                    return a.distFromLine - b.distFromLine;
                }
            });

            let distDelta = [];
            for (let d_it = 1; d_it < dist.length; d_it++) {
                let deltaNum = dist[d_it].number - dist[d_it - 1].number;
                distDelta.push([dist[d_it].distOnLine, deltaNum > 0 ? 1 : -1]);
            }

            let ln = simple.linearRegression(distDelta)

            if (isNaN(ln.b) || isNaN(ln.m)) {
                orphanSegs.push(seg);
                continue;
            }

            let xInt = (-ln.b) / ln.m;

            //XIntercept is before or after the line
            if (isNaN(xInt) || xInt <= 0 || xInt >= turf.lineDistance(seg.network)) {
                orphanSegs.push(seg);
                continue;
            }

            let networkStart = turf.lineSliceAlong(seg.network, 0, xInt)
            let networkEnd = turf.lineSliceAlong(seg.network, xInt, turf.lineDistance(seg.network));

            let tmpSeg = [{
                network: networkStart,
                address: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'MultiPoint',
                        coordinates: []
                    }
                },
                number: []
            },{
                network: networkEnd,
                address: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'MultiPoint',
                        coordinates: []
                    }
                },
                number: []
            }];

            for (let d_it = 0; d_it < dist.length; d_it++) {
                if (dist[d_it].distOnLine < xInt) {
                    tmpSeg[0].number.push(dist[d_it].number);
                    tmpSeg[0].address.geometry.coordinates.push(dist[d_it].geometry.geometry.coordinates);
                } else {
                    tmpSeg[1].number.push(dist[d_it].number);
                    tmpSeg[1].address.geometry.coordinates.push(dist[d_it].geometry.geometry.coordinates);
                }
            }

            newSegs.push([tmpSeg[0]]);
            newSegs.push([tmpSeg[1]]);
        }

        if (!newSegs.length) return false; //No change between new & original segs

        for (let oSeg of orphanSegs) {
            let closest = {
                dist: false,
                ele: false
            }

            for (let n_it = 0; n_it < newSegs.length; n_it++) {
                let segs = newSegs[n_it];

                let d = turf.distance(turf.center(oSeg.network), turf.center(turf.featureCollection(segs.map((seg) => { return seg.network}))))

                if (!closest.dist || closest.dist > d) {
                    closest.dist = d;
                    closest.ele = n_it;
                }
            }

            newSegs[closest.ele].push(oSeg);
        }

        return newSegs;
    }

    /**
     * Cluster address points within a given segment
     * @param {boolean} segment Segment ID to cluster within
     * @param {Function} cb Callback in (err, res)
     * @return {Function} Callback
     */
    address(segment = 1, cb) {
        this.pool.query(`
            INSERT INTO address_cluster (text, _text, text_tokenless, geom)
                SELECT
                    addr.text,
                    addr._text,
                    addr.text_tokenless,
                    ST_Multi(ST_CollectionExtract(addr.geom, 1)) AS geom
                FROM (
                    SELECT
                        text,
                        MAX(_text) AS _text,
                        MAX(text_tokenless) AS text_tokenless,
                        unnest(ST_ClusterWithin(geom, 0.01)) AS geom
                    FROM address
                    WHERE segment = ${segment}
                    GROUP BY text
                ) addr;
        `, (err, res) => {
            console.error(`ok - clustered addresses - seg: ${segment}`);

            return cb(err);
        });
    }

    /**
     * Cluster network lines within a given segment
     * @param {boolean} segment Segment ID to cluster within
     * @param {Function} cb Callback in (err, res)
     * @return {Function} Callback
     */
    network(segment = 1, cb) {
        this.pool.query(`
            INSERT INTO network_cluster (text, _text, text_tokenless, geom, buffer)
                SELECT
                    netw.text,
                    netw._text,
                    netw.text_tokenless,
                    ST_Multi(ST_CollectionExtract(netw.geom, 2)) AS geom,
                     ST_Buffer(ST_Envelope(geom), 0.01) AS buffer
                FROM (
                    SELECT
                        text,
                        MAX(_text) AS _text,
                        MAX(text_tokenless) AS text_tokenless,
                        unnest(ST_ClusterWithin(geom, 0.01)) AS geom
                    FROM network
                    WHERE segment = ${segment}
                    GROUP BY text
                ) netw;
        `, (err, res) => {
            console.error(`ok - clustered network - seg: ${segment}`);

            return cb(err);
        });
    }


    /**
    * Expands address_clusters with identically-named but unmatched nearby address clusters
    * @param {Function} cb Callback in (err, res)
    * @return {Function} cb
    **/
    adoption(cb) {
        this.pool.query(`
            BEGIN;

            ALTER TABLE network_cluster DROP COLUMN IF EXISTS address_text;
            ALTER TABLE network_cluster ADD COLUMN address_text TEXT;
            ALTER TABLE address_cluster ADD COLUMN name_uniqueness NUMERIC DEFAULT 0;

            CREATE INDEX address_cluster_text_idx ON address_cluster (_text);
            CREATE INDEX network_cluster_address_idx ON network_cluster (address);

            UPDATE network_cluster n
                SET address_text = a._text
                FROM address_cluster a
                WHERE n.address = a.id;

            CREATE TEMPORARY TABLE name_count ON COMMIT DROP AS SELECT _text, COUNT(id) AS cnt FROM address_cluster GROUP BY _text;
            CREATE INDEX name_cluster_text_idx ON name_count (_text);
            UPDATE address_cluster ac
                 SET name_uniqueness = nc.cnt
                 FROM name_count nc
                 WHERE ac._text=nc._text;

            ALTER TABLE address_cluster ADD COLUMN orphan_adoptive_parent BIGINT DEFAULT NULL;

            CREATE INDEX orphan_adoptive_parent_idx ON address_cluster (orphan_adoptive_parent);
            CREATE INDEX network_cluster_text_idx ON network_cluster (address_text);

            UPDATE address_cluster a
                SET orphan_adoptive_parent = n.address
                FROM network_cluster n
                WHERE
                    a.name_uniqueness > 1
                    AND
                    (
                        a.id = n.address
                        OR
                        (
                            a._text = n.address_text
                            AND ST_Intersects(n.buffer, a.geom)
                            AND a.id NOT IN (SELECT address FROM network_cluster WHERE address IS NOT NULL)
                        )
                    );

            CREATE TEMPORARY TABLE orphan_groups
                ON COMMIT DROP AS
                    SELECT
                        orphan_adoptive_parent,
                        ST_CollectionExtract(ST_Collect(geom),1) AS geom
                    FROM address_cluster
                    WHERE orphan_adoptive_parent IS NOT NULL
                    GROUP BY orphan_adoptive_parent;

            UPDATE address_cluster a
                SET geom = o.geom
                FROM orphan_groups o
                WHERE
                    o.orphan_adoptive_parent = a.id
                AND
                    o.orphan_adoptive_parent IS NOT NULL;

            DELETE FROM address_cluster
                WHERE
                    id IN (SELECT id FROM address_cluster WHERE orphan_adoptive_parent IS NOT NULL)
                AND
                    id NOT IN (SELECT address FROM network_cluster WHERE address IS NOT NULL);

            ALTER TABLE address_cluster DROP COLUMN orphan_adoptive_parent;

            COMMIT;
        `, cb)
    }

    /**
    * Prune network_cluster assignments where the address_cluster is assigned to more than one
    * @param {Function} cb Callback in (err, res)
    * @return {Function} cb
    **/
    prune(cb) {
        let that = this;
        this.pool.connect((err, client, pg_done) => {
            if (err) return cb(err);
            const cursor = client.query(new Cursor(`
                SELECT
                    a.id AS address_id,
                    a.text AS address_text,
                    a.text_tokenless AS address_text_tokenless,
                    n.id AS network_id,
                    n.text AS network_text,
                    n.text_tokenless AS network_text_tokenless
                FROM network_cluster n inner join address_cluster a ON n.address=a.id
                WHERE n.address IN
                    (SELECT address FROM network_cluster WHERE address IS NOT NULL GROUP BY address HAVING COUNT(address) > 1)
                ORDER BY a.id ASC;
            `));

            /**
             * Iterate through batch of potential matches to find the best single match
             * @param {Array} batch Array of batches to process
             * @param {Function} cb2 Callback in (err, res)
             * @return {Function} cb2
             */
            function pruneBatch(batch, cb2) {
                let bestMatch = null;
                for (let batchi = 0; batchi < batch.length; batchi++) {
                    let cur = batch[batchi];
                    let curDist;
                    if (cur.address_text_tokenless && cur.network_text_tokenless)
                        curDist = (0.25 * dist(cur.address_text, cur.network_text)) + (0.75 * dist(cur.address_text_tokenless, cur.network_text_tokenless));
                    else
                        curDist = dist(cur.address_text, cur.network_text);
                    if (!bestMatch || (curDist < bestMatch[0]))
                        bestMatch = [curDist, cur.network_id];
                }
                // return a list of all network_ids that are not the best match
                return cb2(null, batch.map((x) => { return x.network_id; }).filter((x) => { return x !== bestMatch[1]; }));
            }

            let batch = [];
            let q = Queue();

            iterate();

            /**
             * Iterative wrapper around pg_cursor to allow for better memory management of in-memory network_clusters being pruned
             */
            function iterate() {
                cursor.read(100, (err, rows) => {
                    if (!rows.length) {
                        if (batch.length)
                            q.defer(pruneBatch, batch);
                        q.awaitAll((err, results) => {
                            let deleteMe = results.reduce((prev, cur) => { return prev.concat(cur); }, []).join(',');
                            that.pool.query(`UPDATE network_cluster SET address=NULL WHERE id IN (${deleteMe});`, (err, res) => {
                            if (err) return cb(err);
                            pg_done();
                            return cb();
                            });
                        });
                    }
                    else {
                        rows.forEach((row) => {
                            if ((batch.length > 0) && (batch[batch.length - 1].address_id !== row.address_id)) {
                                q.defer(pruneBatch, batch.slice(0));
                                batch = [];
                            }
                            batch.push(row);
                        });

                        return iterate();
                    }
                });
            }
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
            CREATE INDEX IF NOT EXISTS address_cluster_gix ON address_cluster USING GIST (geom);
            CREATE INDEX IF NOT EXISTS network_cluster_gix ON network_cluster USING GIST (geom);
            CLUSTER address_cluster USING address_cluster_gix;
            CLUSTER network_cluster USING network_cluster_gix;
            ANALYZE address_cluster;
            ANALYZE network_cluster;
            COMMIT;
        `, (err, res) => {
            return cb(err);
        });
    }

    /**
     * Attempt to autoname unnamed streets by using surrounding address points
     * @param {numeric} id ID of network to attempt to name
     * @param {Function} cb Callback in (err, res)
     * @return {Function} cb
     */
    name(id, cb) {
        this.pool.query(`SELECT ST_AsGeoJSON(geom) AS geom FROM network WHERE id = ${id}`, (err, res) => {
            if (err) return cb(err);

            let str = JSON.parse(res.rows[0].geom);

            let buff = buffer(str, 0.1).geometry;

            let names = {};

            this.pool.query(`SELECT text, text_tokenless, _text FROM address WHERE ST_Within(geom, ST_SetSRID(ST_GeomFromGeoJSON('${JSON.stringify(buff)}'), 4326))`, (err, res) => {
                if (err) return cb(err);

                for (let res_it = 0; res_it < res.rows.length; res_it++) {
                    let text = JSON.stringify([
                        res.rows[res_it].text,
                        res.rows[res_it].text_tokenless,
                        res.rows[res_it]._text
                    ]);

                    if (!names[text]) names[text] = 1;
                    else names[text]++;
                }

                let str = Object.keys(names);

                str.sort((a, b) => {
                    return names[b] - names[a];
                });

                if (!str.length) return cb();

                let text = JSON.parse(str[0]);

                this.pool.query(`
                    UPDATE
                        network
                    SET
                        text = '${text[0]}',
                        text_tokenless = '${text[1]}',
                        _text = '${text[2]}',
                        named = TRUE
                    WHERE
                        id = ${id}
                `, (err, res) => {
                    return cb(err);
                });
            });
        });
    }
}

module.exports = Cluster;

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
const linker = require('./linker');
const numCaseChanges = require('./label/util').numCaseChanges;


/**
 * @class Cluster
 */
class Cluster {
    constructor(opts) {
        opts = opts || {};
        this.pool = opts.pool;
        if (opts.label)
            this.label = require('./label/' + opts.label)();
        else
            this.label = require('./label/titlecase')();
    }

    /**
     * Attenpt to break a single NetworkCluster into 2 network clusters where there are dup addresses
     *
     * Output:        | Input:
     * ------ ------  | -------------
     * 1 2 3   3 2 1  | 1 2 3   3 2 1
     *
     * @param {Array} segs Array of addr/number/lnstring segmtents to attempt to split
     * @return {Array} New segments array
     */
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
                    distOnLine: turf.lineDistance(turf.lineSlice(turf.point(seg.network.geometry.coordinates[0]), linept, seg.network), 'kilometers'),
                    distFromLine: turf.distance(addr, linept, 'kilometers'),
                    geometry: addr,
                    number: parseInt(seg.number[addr_it].num),
                    output: seg.number[addr_it].output
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

            let networkStart = turf.featureCollection([turf.lineSliceAlong(seg.network, 0, xInt)]);
            let networkEnd = turf.featureCollection([turf.lineSliceAlong(seg.network, xInt, turf.lineDistance(seg.network))]);

            if (turf.lineDistance(networkStart) < 0.001 || turf.lineDistance(networkEnd) < 0.001) return false;


            let tmpSeg = [{
                network: networkStart,
                address: [],
                number: []
            },{
                network: networkEnd,
                address: [],
                number: []
            }];

            for (let d_it = 0; d_it < dist.length; d_it++) {
                if (dist[d_it].distOnLine < xInt) {
                    tmpSeg[0].number.push({
                        num: dist[d_it].number,
                        output: dist[d_it].output
                    });
                    tmpSeg[0].address.push(dist[d_it].geometry.geometry.coordinates);
                } else {
                    tmpSeg[1].number.push({
                        num: dist[d_it].number,
                        output: dist[d_it].output
                    });
                    tmpSeg[1].address.push(dist[d_it].geometry.geometry.coordinates);
                }
            }

            newSegs.push(tmpSeg[0]);
            newSegs.push(tmpSeg[1]);
        }

        if (!newSegs.length) return false; //No change between new & original segs

        for (let oSeg of orphanSegs) {
            let closest = {
                dist: false,
                ele: false
            }

            for (let n_it = 0; n_it < newSegs.length; n_it++) {
                let nseg = newSegs[n_it];

                let d = turf.distance(turf.center(oSeg.network), turf.center(nseg.network));

                if (!closest.dist || closest.dist > d) {
                    closest.dist = d;
                    closest.ele = n_it;
                }
            }

            newSegs[closest.ele].network.features.push(oSeg.network);
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
            INSERT INTO address_orphan_cluster (text, _text, text_tokenless, geom)
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
                        unnest(ST_ClusterWithin(geom, 0.005)) AS geom
                    FROM address
                    WHERE netid IS NULL
                    GROUP BY text
                ) addr;
        `, (err, res) => {
            if (!err) console.error('ok - clustered orphan addresses');
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

            INSERT INTO address_cluster (text, _text, text_tokenless, geom, netid)
                SELECT
                    Array_Agg(a.text ORDER BY ST_NPoints(geom) DESC),
                    Array_Agg(a._text ORDER BY ST_NPoints(geom) DESC),
                    Array_Agg(a.text_tokenless ORDER BY ST_NumPoints(geom) DESC),
                    ST_Multi(ST_CollectionExtract(ST_Collect(a.geom), 1)) AS geom,
                    a.netid
                FROM (
                    SELECT
                        text,
                        MAX(_text) AS _text,
                        text_tokenless,
                        netid,
                        ST_Multi(ST_CollectionExtract(ST_Collect(geom), 1)) AS geom
                    FROM
                        address
                    WHERE
                        netid IS NOT NULL
                    GROUP BY
                        netid,
                        text,
                        text_tokenless
                ) a
                GROUP BY
                    netid;

            UPDATE network_cluster n
                SET address = a.id
                FROM address_cluster a
                WHERE n.id = a.netid;

            COMMIT;
        `, (err, res) => {
            if (!err) console.error('ok - clustered addresses');
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

            INSERT INTO network_cluster (text, _text, text_tokenless, geom)
                SELECT
                    netw.text,
                    netw._text,
                    netw.text_tokenless,
                    ST_Multi(ST_CollectionExtract(netw.geom, 2)) AS geom
                FROM (
                    SELECT
                        text,
                        MAX(_text) AS _text,
                        MAX(text_tokenless) AS text_tokenless,
                        unnest(ST_ClusterWithin(geom, 0.005)) AS geom
                    FROM network
                    GROUP BY text
                ) netw;


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

            UPDATE network_cluster SET source_ids = get_source_ids(geom);

            ALTER TABLE network_cluster ADD COLUMN geom_flat geometry(geometry, 4326);

            UPDATE network_cluster SET geom_flat=ST_SetSRID(ST_Force2D(geom), 4326);

            ALTER TABLE network_cluster DROP COLUMN geom;

            ALTER TABLE network_cluster RENAME geom_flat TO geom;

            COMMIT;
        `, (err, res) => {
            return cb(err);
        });
    }

    /**
    * Collapse together duplicate network_clusters
    * @param {Function} cb Callback func (err, res)
    * @return {Function} callback
    **/
    collapse(cb) {
        let that = this;

        /**
        * Wrapper func to output stats on what's been done & how quickly
        * @param {string} stepName name of step for logging
        * @param {Function} stepFunc function to call for this step func (cb)
        * @return {Function} callback
        **/
        function doStep(stepName, stepFunc, cb) {
            that.startTime = +(new Date());
            that.mergeCount = 0;
            that.mergeRemoveCount = 0;
            return stepFunc((err) => {
                if (!err) console.log(`ok - collapse.${stepName} - performed ${that.mergeCount} merges, removing ${that.mergeRemoveCount} network clusters in ${Math.round(+(new Date()) - that.startTime)} ms`);

                return cb(err);
            });
        }

        let collapseQ = new Queue(1);

        collapseQ.defer(doStep, 'collapseDupes', collapseDupes);
        collapseQ.defer(that.optimize.bind(that)); // javascript is gaaaaaarbaaaaaage
        collapseQ.defer(doStep, 'collapseSubstantialOverlap', collapseSubstantialOverlap);
        //collapseQ.defer(reassignMismatchedPoints); // not implemented

        collapseQ.awaitAll((err, results) => {
            if (err) console.log(`not ok - error during cluster.collapse: ${err}`);

            return cb(err);
        });

        /**
        * collapse one or more network clusters and their address clusters
        * (if any) into a target network cluster & its address cluster
        * @param {number} collapseInto id of network_cluster to be expanded
        * @param {Array} otherClusters ids of network_clusters to be collapsed into collapseInto
        * @param {Function} cnCallback callback
        **/
        function collapseNetworkClusters(collapseInto, otherClusters, opts, cnCallback) {
            opts = opts || {};

            // we only rewrite the network cluster geometry when necessary -- ie when the clusters
            // don't already share identical source segments
            let networkGeomRewriteSql = '';
            if (opts.redoNetworkGeometry) {
                networkGeomRewriteSql = `
                    UPDATE
                        network_cluster nc
                    SET
                        geom = a.geom
                    FROM (
                        SELECT
                            ST_Collect(b.geom) AS geom
                        FROM
                            (
                                SELECT
                                    DISTINCT ON (n.id)
                                    ST_Force2D(n.geom) AS geom
                                FROM network n
                                WHERE
                                    n.id IN (SELECT UNNEST(nc2.source_ids) FROM network_cluster nc2 WHERE nc2.id=${collapseInto})
                                ORDER BY n.id ASC -- network table id is shared across duplicate geometry w/ diff names
                            ) b
                        ) a
                    WHERE nc.id = ${collapseInto};
                `;
            }

            that.pool.query(`
                BEGIN TRANSACTION;

                -- combine address cluster geometry; currently ignores text
                UPDATE address_cluster a1
                    SET
                        geom = a2.geom
                    FROM (
                        SELECT
                            ST_CollectionExtract(ST_Collect(geom),1) AS geom
                        FROM
                            address_cluster
                        WHERE
                            id IN (
                                SELECT
                                    address
                                FROM
                                    network_cluster
                                WHERE
                                    address IS NOT NULL
                                AND
                                    id IN (${collapseInto},${otherClusters.join(',')})
                            )
                    ) a2
                    WHERE
                        a1.id=(SELECT address FROM network_cluster WHERE id=${collapseInto})
                        AND a1.id IS NOT NULL;

                -- delete the collapsed address clusters
                DELETE FROM address_cluster a
                    WHERE
                        id IN (
                            SELECT
                                address
                            FROM
                                network_cluster n
                            WHERE
                                id IN (${otherClusters.join(',')})
                        )
                    AND id IS NOT NULL;

                -- combine network cluster names
                UPDATE network_cluster n1
                    SET
                        _text=(CASE n1._text WHEN NULL THEN '' ELSE n1._text||',' END)||na._text,
                        "text"=(CASE n1."text" WHEN NULL THEN '' ELSE n1."text"||',' END)||na."text",
                        text_tokenless=(CASE n1.text_tokenless WHEN NULL THEN '' ELSE n1.text_tokenless||',' END)||na.text_tokenless
                    FROM (
                        SELECT
                            STRING_AGG(n2._text, ',' ORDER BY n2.id ASC) AS _text,
                            STRING_AGG(n2."text", ',' ORDER BY n2.id ASC) AS "text",
                            STRING_AGG(n2.text_tokenless, ',' ORDER BY n2.id ASC) AS text_tokenless
                        FROM
                            network_cluster n2
                        WHERE n2.id IN (${otherClusters.join(',')})
                    ) na
                    WHERE
                        n1.id=${collapseInto};

                -- update source IDs
                UPDATE network_cluster n1
                    SET source_ids=na.source_ids
                    FROM (
                        SELECT
                        ARRAY_AGG(DISTINCT source_id ORDER BY source_id) AS source_ids
                        FROM
                        network_cluster n2,
                        UNNEST(source_ids) source_id
                        WHERE n2.id IN (${collapseInto},${otherClusters.join(',')})
                    ) na
                    WHERE
                        n1.id=${collapseInto};

                -- update network cluster geom if necessary
                ${networkGeomRewriteSql}

                -- delete the extraneous network clusters
                DELETE FROM network_cluster WHERE id IN (${otherClusters.join(',')});

                COMMIT;
            `, (err) => {
                if (!err) {
                    that.mergeCount++;
                    that.mergeRemoveCount += otherClusters.length;
                }
                return cnCallback(err);
            });
        }

        /**
        * first step of cluster.collapse -- eliminate network clusters
        * that have entirely identical source_id provenance
        * @param {Function} collapseDupesCallback callback
        *
        * aaaaaaaaaa aaaaaaaaa aaaaaaa a    Main St
        * bbbbbbbbbb bbbbbbbbb bbbbbbb b    RT 50
        **/
        function collapseDupes(collapseDupesCallback) {

            // setup accounting tables/columns -- can't use IF NOT EXISTS bc circle runs an old postgres version
            that.pool.query(`
                DO $$
                BEGIN
                    BEGIN
                        ALTER TABLE network_cluster ADD COLUMN point_count BIGINT;
                    EXCEPTION
                        WHEN duplicate_column THEN RAISE NOTICE 'column point_count already exists in network_cluster';
                    END;
                END;
                $$
            `, (err) => {
                if (err) return collapseDupesCallback(err);

                that.pool.query(`
                    UPDATE network_cluster n SET
                        point_count = acpc.total
                    FROM
                        (
                            SELECT
                                a.id AS id,
                                COUNT(a.id) AS total
                            FROM
                                (SELECT id, ST_Dump(geom) FROM address_cluster) a
                            GROUP BY a.id
                        ) acpc
                    WHERE
                        n.address IS NOT NULL
                    AND
                        acpc.id=n.address;

                    DROP TABLE IF EXISTS dupes;
                    CREATE TABLE dupes AS
                    SELECT
                        n1.id AS id,
                        MAX(n1._text) AS _text,
                        STRING_AGG(n2.id::text, ',' ORDER BY COALESCE(n2.point_count,0) DESC, n2.id ASC) AS contained_cluster_ids,
                        STRING_AGG(n2._text::text, ',' ORDER BY COALESCE(n2.point_count,0) DESC, n2.id ASC) AS contained_cluster_names,
                        STRING_AGG(COALESCE(n2.address,-1)::text, ',' ORDER BY COALESCE(n2.point_count,0) DESC, n2.id ASC) AS contained_cluster_address,
                        STRING_AGG(COALESCE(n2.point_count,0)::text, ',' ORDER BY COALESCE(n2.point_count,0) DESC, n2.id ASC) AS address_cluster_point_count
                    FROM
                        network_cluster n1 INNER JOIN network_cluster n2
                    ON
                        n1.source_ids = n2.source_ids
                    GROUP BY
                        n1.id
                    HAVING
                        COUNT(n2.id) > 1; -- otherwise we get a row for every cluster

                `, (err) => {
                    if (err) return collapseDupesCallback(err);

                    let q = new Queue(10);
                    that.pool.connect((err, client, pg_done) => {
                        if (err) return collapseDupesCallback(err);
                        const cursor = client.query(new Cursor(`
                            SELECT
                                id,
                                _text,
                                contained_cluster_ids,
                                contained_cluster_names,
                                contained_cluster_address,
                                address_cluster_point_count
                            FROM dupes
                            ORDER BY id ASC;`));

                        let processedIds = [];

                        /**
                         * Iterative wrapper around pg_cursor to allow for better memory management of in-memory network_clusters being pruned
                         */
                        function collapseDupesIterate() {
                            cursor.read(100, (err, rows) => {
                                if (err) return collapseDupesCallback(err);
                                if (rows.length) {
                                    rows.forEach((row) => {
                                        let clusterIds = row.contained_cluster_ids
                                            .split(',')
                                            .map((x) => parseInt(x))
                                            .filter((x) => { return processedIds.indexOf(x) === -1; });

                                        if (clusterIds.length > 1) {
                                            for (let clusterId of clusterIds)
                                                processedIds.push(clusterId);
                                            let collapseInto = clusterIds.shift();
                                            q.defer(collapseNetworkClusters, collapseInto, clusterIds, false);
                                        }
                                    });

                                    return collapseDupesIterate();
                                } else {
                                    q.awaitAll((err, results) => {
                                        if (err) return collapseDupesCallback(err);
                                        that.pool.query(`DROP TABLE dupes;`, (err, res) => {
                                            pg_done();
                                            if (err) return cb(err);
                                            return collapseDupesCallback();
                                        });
                                    });
                                }
                            });
                        }

                        collapseDupesIterate();
                    });
                });
            });
        }

        /**
        * second step of cluster.collapse -- eliminate network clusters
        * that have substantial but not 100% overlap by length and also
        * strong text similarity
        * @param {Function} collapseOverlapCallback callback
        *
        * aaaaaaaaaa aaaaaaaaa aaaaaaa      Main St
        * bbbbbbbbbb bbbbbbbbb bbbbbbb b    Main Ave
        **/
        function collapseSubstantialOverlap(collapseOverlapCallback) {
            let networkLengths = {};

            that.pool.connect((err, client, pg_done) => {
                if (err) return collapseOverlapCallback(err);

                const lengthCursor = client.query(new Cursor(`SELECT id, network_length FROM network;`));

                /**
                 * Iterative wrapper around pg_cursor to allow for better memory management of in-memory network_clusters being pruned
                 */
                function lengthIterate() {
                    lengthCursor.read(1000, (err, rows) => {
                        if (err) return collapseOverlapCallback(err);
                        if (!rows.length) {
                            pg_done();
                            return processOverlap();
                        } else {
                            for (let row of rows)
                                networkLengths[row.id] = parseFloat(row.network_length);
                            return lengthIterate();
                        }
                    });
                }

                lengthIterate();
            });

            let processedIds = [];

            /**
            * perform actual substant of overlap collapse
            * @returns {Function} callback
            **/
            function processOverlap() {
                let q = new Queue(10);
                that.pool.connect((err, client, pg_done) => {
                    if (err) return collapseOverlapCallback(err);
                    const processCursor = client.query(new Cursor(`
                        SELECT
                             n1.id AS id,
                             MAX(n1._text) AS _text,
                             STRING_AGG(n2.id::text, '|' ORDER BY n2.id ASC) AS cluster_ids,
                             STRING_AGG(n2.source_ids::text, '|' ORDER BY n2.id ASC) AS cluster_source_ids,
                             STRING_AGG(n2._text, '|' ORDER BY n2.id ASC) AS cluster__texts,
                             STRING_AGG(n2.text, '|' ORDER BY n2.id ASC) AS cluster_texts,
                             STRING_AGG(COALESCE(n2.text_tokenless, ''), '|' ORDER BY n2.id ASC) AS cluster_text_tokenlesses,
                             STRING_AGG(COALESCE(n2.address::text, '-1'), '|' ORDER BY n2.id ASC) AS cluster_address
                         FROM
                             network_cluster n1 INNER JOIN network_cluster n2
                         ON
                             n1.source_ids && n2.source_ids
                         GROUP BY
                             n1.id;
                    `));

                    /**
                    * calculate network length by segment IDs
                    * @param {Array} networkIds array of network table ids (integers)
                    * @returns {number}
                    **/
                    function networkLength(networkIds) {
                        return networkIds.reduce((prev, cur) => {
                            return prev + (networkLengths[cur] || 0);
                        }, 0);
                    }

                    let processedIds = [];

                    /**
                     * Iterative wrapper around pg_cursor to allow for better memory management of in-memory network_clusters being pruned
                     */
                    function processOverlapIterate() {
                        processCursor.read(100, (err, rows) => {
                            if (err) return collapseOverlapCallback(err);
                            if (rows.length) {
                                for (let row of rows) {
                                    let cluster_ids = row.cluster_ids.split('|').map((x) => parseInt(x));
                                    let cluster_source_ids = row.cluster_source_ids
                                        .split('|')
                                        .map((x) => { return x.replace(/[\{\}]/g, '').split(',').map((y) => parseInt(y)) });

                                    let cluster__texts = row.cluster__texts.split('|');
                                    let cluster_texts = row.cluster_texts.split('|');
                                    let cluster_text_tokenlesses = row.cluster_text_tokenlesses.split('|');
                                    let cluster_address = row.cluster_address.split('|').map((y) => parseInt(y));

                                    let clusters = [];
                                    for (let i = 0; i < cluster_ids.length; i++) {
                                        clusters.push({
                                            id: cluster_ids[i],
                                            source_ids: cluster_source_ids[i],
                                            _text: cluster__texts[i],
                                            text: cluster_texts[i],
                                            text_tokenless: cluster_text_tokenlesses[i].length > 0 ? cluster_text_tokenlesses[i] : null,
                                            address: cluster_address[i],
                                            network_length: networkLength(cluster_source_ids[i])
                                        });
                                    }

                                    // put longest cluster in first position
                                    clusters.sort((a, b) => {
                                        if (a.network_length > b.network_length)
                                            return -1;
                                        else if (a.network_length < b.network_length)
                                            return 1;
                                        return 0;
                                    });

                                    let parentCluster = clusters.shift();
                                    let collapseMe = [];

                                    let linkerResult = linker({
                                        id: parentCluster.id,
                                        text: parentCluster.text.split(',')[0],
                                        _text: parentCluster._text.split(',')[0],
                                        text_tokenless: parentCluster.text_tokenless ? parentCluster.text_tokenless.split(',')[0] : null
                                    }, clusters, true);
                                    let textOverlapScore = {};
                                    if (linkerResult)
                                        for (let lr of linkerResult)
                                            textOverlapScore[lr.id] = lr.score;

                                    for (let child of clusters) {
                                        child.overlapLength = networkLength(child.source_ids.filter((x) => { return parentCluster.source_ids.indexOf(x) !== -1; }));

                                        if (processedIds.indexOf(child.id) === -1) {
                                            let geomOverlapPct = child.overlapLength / parentCluster.network_length;
                                            if ((geomOverlapPct > 0.95) && ((textOverlapScore[child.id] || 0) > 70)) {
                                                // debug
                                                if (process.env.PT2ITP_DEBUG) {
                                                    console.log();
                                                    console.log('Collapsing network clusters (indented into nonindented):');
                                                    console.log(JSON.stringify(parentCluster));
                                                    console.log('    ' + JSON.stringify(child));
                                                }

                                                collapseMe.push(child.id);
                                                processedIds.push(child.id);
                                            }
                                        }
                                    }
                                    if (collapseMe.length > 0)
                                        q.defer(collapseNetworkClusters, parentCluster.id, collapseMe, { redoNetworkGeometry: true });
                                }
                                return processOverlapIterate();
                            } else {
                                q.awaitAll((err, results) => {
                                    pg_done();
                                    return collapseOverlapCallback(err);
                                });
                            }
                        });
                    }

                    processOverlapIterate();
                });
            }
        }

        // THESE ARE NOT IMPLEMENTED:

        // * clusters where points span longer segment, name matches shorter segment
        // * addresses should be reassigned to the longer segment & the name added
        //        bbbbbbbbb                  Main st
        // aaaaaa aaaaaaaaa aaaaaaaaaaaaa    RT 50
        // B  B   BB   B    B     B   B B    Main st (addresses)
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

    /**
     * Attempt to autoname unnamed streets by using surrounding address points
     * @param {numeric} id ID of network to attempt to name
     * @param {Function} cb Callback in (err, res)
     * @return {Function} cb
     */
    name(id, cb) {
        let that = this;
        this.pool.query(`SELECT ST_AsGeoJSON(geom) AS geom FROM network WHERE id = ${id}`, (err, res) => {
            if (err) return cb(err);

            let str = JSON.parse(res.rows[0].geom);

            let buff = buffer(str, 0.1).geometry;

            let names = {};

            this.pool.query(`SELECT text, text_tokenless, _text FROM address WHERE ST_Within(geom, ST_SetSRID(ST_GeomFromGeoJSON('${JSON.stringify(buff)}'), 4326))`, (err, res) => {
                if (err) return cb(err);

                for (let res_it = 0; res_it < res.rows.length; res_it++) {
                    // only consider results that have non-empty _text strings
                    if (res.rows[res_it]._text) {
                        let text = JSON.stringify([
                            res.rows[res_it].text,
                            res.rows[res_it].text_tokenless,
                            res.rows[res_it]._text
                        ]);

                        if (!names[text]) {
                            names[text] = 1;
                        } else {
                            names[text]++;
                        }
                    }
                }

                let namelist = Object.keys(names);


                if (res.rows.length == 0 || !namelist.length) {
                    this.pool.query(`
                        UPDATE
                            network
                        SET
                            named = FALSE
                        WHERE
                            id = ${id}
                    `, (err, res) => {
                        return cb(err);
                    });
                } else {
                    namelist.sort((a, b) => {
                        return names[b] - names[a];
                    });

                    let new_text_values = JSON.parse(namelist[0]);

                    for (let k = 0; k < new_text_values.length; k++) {
                        if (!new_text_values[k]) {
                            // anything falsey should become empty string
                            new_text_values[k] = '';
                        } else {
                            // titlecase / run label func if zero case changes -- but only for _text
                            if ((k === 2) && (numCaseChanges(new_text_values[k]) === 0))
                                new_text_values[k] = that.label(new_text_values[k]);

                            // any string needs to be made sql safe: replace single quote with two single quotes
                            new_text_values[k] = new_text_values[k].replace(/'/g, "''");
                        }
                    }

                    this.pool.query(`
                        UPDATE
                            network
                        SET
                            text = '${new_text_values[0]}',
                            text_tokenless = '${new_text_values[1]}',
                            _text = '${new_text_values[2]}',
                            named = TRUE
                        WHERE
                            id = ${id}
                    `, (err, res) => {
                        return cb(err);
                    });
                }
            });
        });
    }
}

module.exports = Cluster;

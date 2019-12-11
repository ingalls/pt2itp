'use strict';

const Cursor = require('pg-cursor');
const turf = require('@turf/turf');
const Post = require('./post');
const asGeoJSON = require('./asgeojson.js');

/**
 * @class Orphan
 */
class Orphan {
    constructor(pool, opts, output) {
        this.pool = pool;
        this.opts = opts;
        this.output = output;
        this.post = new Post(opts, opts);
    }

    /**
     * Cluster all orphan addresses not matched to a network_cluster,
     * output the resulting clusters to geojson.
     * @param {Function} cb Callback in (err, res)
     */
    address(cb) {
        const self = this;

        this.pool.connect((err, client, done) => {
            if (err) return cb(err);

            const shouldAbort = (err) => {
                if (err) {
                    console.error('Error in transaction', err.stack);
                    client.query('ROLLBACK', (err) => {
                        if (err) {
                            console.error('Error rolling back client', err.stack);
                        }
                        // release the client back to the pool
                        done();
                    });
                }
                return !!err;
            };

            const dropJoinTable = 'DROP TABLE IF EXISTS address_orphan_cluster_id_to_z';
            const createJoinTable = `
                CREATE TABLE IF NOT EXISTS address_orphan_cluster_id_to_z as
                SELECT
                    id,
                    ST_Z((ST_Dump(geom)).geom)::bigint AS z
                FROM
                    address_orphan_cluster`;
            const createJoinTableIdIndex = `
                create index if not exists address_orphan_cluster_id_to_z__id
                on address_orphan_cluster_id_to_z (id);`;
            const createJoinTableZIndex = `
                create index if not exists address_orphan_cluster_id_to_z__z
                on address_orphan_cluster_id_to_z (z);`;
            const selectOrphans = `
                SELECT
                    names AS name,
                    ST_AsGeoJSON(geom)::JSON AS geom,
                    json_agg(props) as props
                FROM (
                    SELECT
                        address.id AS id,
                        address_orphan_cluster.names,
                        address_orphan_cluster.geom,
                        json_build_object(
                            'id', address.id,
                            'number', address.number,
                            'props', address.props,
                            'output', address.output
                        ) as props
                    FROM
                        address_orphan_cluster
                            join
                        address_orphan_cluster_id_to_z
                                on (address_orphan_cluster.id = address_orphan_cluster_id_to_z.id)
                            join
                        address
                                on (address.id = address_orphan_cluster_id_to_z.z)
                ) a
                GROUP BY
                    names,
                    geom
            `;

            let cursor;
            client.query('BEGIN', (err) => {
                if (shouldAbort(err)) return cb(err);
                client.query(dropJoinTable, (err) => {
                    if (shouldAbort(err)) return cb(err);
                    client.query(createJoinTable, (err) => {
                        if (shouldAbort(err)) return cb(err);
                        client.query(createJoinTableIdIndex, (err) => {
                            if (shouldAbort(err)) return cb(err);
                            client.query(createJoinTableZIndex, (err) => {
                                if (shouldAbort(err)) return cb(err);
                                client.query('COMMIT', (err) => {
                                    if (err) return cb(err);
                                    cursor = client.query(new Cursor(selectOrphans));
                                    return iterate();
                                });
                            });
                        });
                    });
                });
            });

            /**
             * Iterate over unmatched address clusters using PG Cursor to avoid memory over utilization
             */
            function iterate() {
                cursor.read(1000, (err, rows) => {
                    if (err) return cb(err);

                    if (!rows.length) {
                        done();
                        return cb();
                    }

                    rows.forEach((row) => {
                        if (!row.name.some((name) => { return name.display.trim().length; })) return;

                        let feat = {
                            type: 'Feature',
                            properties: {
                                address_props: [],
                                'carmen:text': row.name,
                                'carmen:addressnumber': [[]]
                            },
                            geometry: {
                                type: 'GeometryCollection',
                                geometries: [{
                                    type: 'MultiPoint',
                                    coordinates: []
                                }]
                            }
                        };

                        const geom_hash = {};
                        for (const coord of row.geom.coordinates) {
                            geom_hash[coord.pop()] = coord;
                        }

                        for (const prop of row.props) {
                            if (prop.output === true) {
                                feat.geometry.geometries[0].coordinates.push(geom_hash[prop.id]);
                                feat.properties['carmen:addressnumber'][0].push(prop.number);
                                feat.properties.address_props.push(prop.props);
                            }
                        }

                        if (feat.geometry.geometries[0].coordinates.length) {
                            if (self.opts.country) feat.properties['carmen:geocoder_stack'] = self.opts.country;

                            feat = self.post.feat(feat);

                            if (feat) self.output.write(JSON.stringify(feat) + '\n');
                        }
                    });

                    return iterate();
                });
            }
        });
    }

    /**
     * Output all network_clusters not matched to an address_cluster
     * @param {Function} cb Callback in (err, res)
     */
    network(cb) {
        const self = this;

        this.pool.connect((err, client, done) => {
            if (err) return cb(err);

            const cursor = client.query(new Cursor(`
                SELECT
                    network_cluster.id AS nid,
                    names AS name,
                    ST_AsGeoJSON(geom)::JSON AS geom,
                    (
                        SELECT
                            json_agg(json_build_object(
                                 'id', i.id,
                                 'a_id', i.a_id,
                                 'b_id', i.b_id,
                                 'a_street', i.a_street,
                                 'b_street', i.b_street,
                                 'geom', i.geom::JSON
                            ))
                        FROM (
                            SELECT
                                intersections.id AS id,
                                intersections.a_id AS a_id,
                                intersections.b_id AS b_id,
                                intersections.a_street AS a_street,
                                intersections.b_street AS b_street,
                                ST_AsGeoJSON(intersections.geom)::JSON AS geom
                            FROM
                                intersections
                            WHERE
                                intersections.a_id = network_cluster.id
                                OR intersections.b_id = network_cluster.id
                        ) i
                    ) AS intersections
                FROM
                    network_cluster
                WHERE
                    network_cluster.address IS NULL
                    AND network_cluster.geom is NOT NULL
            `));

            return iterate();

            /**
             * Iterate over unmatched networks using PG Cursor to avoid memory over utilization
             */
            function iterate() {
                cursor.read(1000, (err, rows) => {
                    if (err) return cb(err);

                    if (!rows.length) {
                        done();
                        return cb();
                    }

                    for (const row of rows) {
                        if (turf.lineDistance(row.geom) < 0.001) continue;

                        row.name = row.name.filter((name) => !!name.display);

                        if (!row.name.length) continue;

                        let ints;
                        if (Array.isArray(row.intersections)) {
                            ints = asGeoJSON.intersectionFeature(row.intersections.map((v) => {
                                return { props: v, coords: v.geom.coordinates };
                            }), row.nid);
                        }

                        const properties = {
                            'carmen:parityl': [],
                            'carmen:lfromhn': [],
                            'carmen:ltohn': [],
                            'carmen:parityr': [],
                            'carmen:rfromhn': [],
                            'carmen:rtohn': []
                        };

                        properties['carmen:text'] = row.name;

                        const network = turf.feature(row.geom, properties);

                        // Note: output features generated here will be slighly different than non-
                        // orphan ones as there are no actual address points nor interpolated
                        // ranges.
                        let feat = asGeoJSON.mergeFeatures(network, undefined, ints);

                        feat.properties['carmen:text'] = row.name;
                        feat.properties['internal:nid'] = row.id;

                        // TODO consider changing how this is assigned in mergeFeatures
                        delete feat.properties['carmen:addressnumber'];

                        if (self.opts.country) feat.properties['carmen:geocoder_stack'] = self.opts.country;

                        feat = self.post.feat(feat);
                        if (feat) self.output.write(JSON.stringify(feat) + '\n');
                    }

                    return iterate();
                });
            }
        });
    }
}

module.exports = Orphan;

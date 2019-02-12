const Cluster = require('./cluster');
const Cursor = require('pg-cursor');
const turf = require('@turf/turf');
const Post = require('./post');

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
     * @return {Function} cb
     */
    address(cb) {
        const self = this;

        const cluster = new Cluster({ pool: this.pool });

        cluster.orphan((err) => {

            this.pool.connect((err, client, done) => {
                if (err) return cb(err);

                const cursor = client.query(new Cursor(`
                    SELECT
                        name AS name,
                        ST_AsGeoJSON(geom)::JSON AS geom,
                        (
                            SELECT
                                json_agg(json_build_object(
                                     'id', r.id,
                                     'number', r.number,
                                     'props', r.props,
                                     'output', r.output
                                ))
                            FROM (
                                SELECT
                                    a.id AS id,
                                    address.number AS number,
                                    address.props AS props,
                                    address.output as output
                                FROM
                                    (
                                        SELECT ST_Z((ST_Dump(address_orphan_cluster.geom)).geom) AS id
                                    ) a,
                                    address
                                WHERE
                                    a.id = address.id
                            ) r
                        ) as props
                    FROM
                        address_orphan_cluster;
                `));

                return iterate();

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
                            if (!row.name.some(name => { return name.display.trim().length })) return;

                            let feat = {
                                type: 'Feature',
                                properties: {
                                    address_props: [],
                                    'carmen:text': row.name,
                                    'carmen:addressnumber': []
                                },
                                geometry: {
                                    type: 'GeometryCollection',
                                    geometries: [{
                                        type: 'MultiPoint',
                                        coordinates: []
                                    }]
                                }
                            };

                            row.geom.coordinates.forEach((coord) => {
                                coord.pop();
                                feat.geometry.geometries[0].coordinates.push(coord);
                            });

                            row.props.forEach((prop) => {
                                feat.properties['carmen:addressnumber'].push(prop.number);

                                feat.properties.address_props.push(prop.props);
                            });

                            if (feat.geometry.geometries[0].coordinates.length) {
                                feat.properties['carmen:addressnumber'] = [ feat.properties['carmen:addressnumber'] ];

                                if (self.opts.country) feat.properties['carmen:geocoder_stack'] = self.opts.country;
                                feat = self.post.feat(feat);

                                if (feat) self.output.write(JSON.stringify(feat) + '\n');
                            }
                        });

                        return iterate();
                    });
                }
            });
        });

    }

    /**
     * Output all network_clusters not matched to an address_cluster
     * @param {Function} cb Callback in (err, res)
     * @return {Function} cb
     */
    network(cb) {
        const self = this;

        this.pool.connect((err, client, done) => {
            if (err) return cb(err);

            const cursor = client.query(new Cursor(`
                SELECT
                    network_cluster.id AS nid,
                    name AS name,
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

                    for (let row of rows) {
                        if (turf.lineDistance(row.geom) < 0.001) continue;

                        row.name = row.name.filter(name => {
                            if (!name.display) return false;
                            return true;
                        });

                        if (!row.name.length) continue;

                        let feat = {
                            type: 'Feature',
                            properties: {
                                'internal:nid': row.nid,
                                'carmen:intersections': row.intersections,
                                'carmen:text': row.name,
                                'carmen:rangetype': 'tiger',
                                'carmen:parityl': [[]],
                                'carmen:parityr': [[]],
                                'carmen:lfromhn': [[]],
                                'carmen:rfromhn': [[]],
                                'carmen:ltohn': [[]],
                                'carmen:rtohn': [[]]
                            },
                            geometry: {
                                type: 'GeometryCollection',
                                geometries: [
                                    row.geom
                                ]
                            }
                        };

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

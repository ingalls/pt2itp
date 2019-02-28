const pg = require('pg');
const Post = require('../map/post');

/**
 * Generate Intersections from the provided network
 *
 * @class Intersections
 */
class Intersections {

    /**
     * Intilize the intersections object
     * @param {Object} o Argument object
     * @param {Object} o.pool PG Pool Instance to use to communicate with the database
     * @return {boolean} Returns true after intersection is initialized
     */
    constructor(opts = {}) {
        this.opts = opts;

        this.post = new Post({
            noDefaults: true,
            post: [
                'id',
                'centre'
            ]
        });
    }

    /**
     * Generate Intersections, removing duplicates where possible
     * @return {Promise}
     */
    generate() {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.opts.pool) throw new Error('pg pool not instantiated');

                await this.opts.pool.query(`
                    INSERT INTO intersections (a_id, b_id, a_street, b_street, geom) (
                        SELECT
                            a.id,
                            b.id,
                            a.name AS a_street,
                            b.name AS b_street,
                            ST_PointOnSurface(ST_Intersection(a.geom, b.geom)) AS geom
                        FROM
                            network_cluster AS a,
                            network_cluster AS b
                        WHERE
                            a.id != b.id
                            AND ST_Intersects(a.geom, b.geom)
                    )
                `);

                return resolve();
            } catch (err) {
                return reject(err);
            }
        });
    }
}

module.exports = Intersections;

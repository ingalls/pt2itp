'use strict';

const linker = require('./linker');
const pg = require('pg');
const Q = require('d3-queue').queue;

let pool, id;

process.on('message', (message) => {
    if (message.min && message.max) {
        match(message.min, message.max, (err) => {
            process.send({
                id: id,
                error: err,
                jobs: message.max - message.min
            });
        });
    } else {
        init(message);

        process.send({
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
 * @param {Object} o.pool PG Pool Instance to use to communicate with the database
 * @return {boolean} Returns true after match is initialized
 */
function init(o) {
    pool = new pg.Pool(o.pool);
    id = o.id;

    return true;
}

/**
 * Perform a matching operation between network and addresses on a given address id
 * @param {number} min Min ID batch to process
 * @param {number} max Max ID batch to process
 * @param {Function} cb Callback in (err, res)
 */
function match(min, max, cb) {
    pool.query(`
        SELECT
            a.id AS id,
            a.names AS name,
            (Array_Agg(
                JSON_Build_Object(
                    'id', nc.id,
                    'name', nc.names::JSON,
                    'dist', ST_Distance(nc.geom, a.geom)
                )
                ORDER BY ST_Distance(nc.geom, a.geom)
            ))[:10] AS nets
        FROM
            address a
            INNER JOIN network_cluster nc
            ON ST_DWithin(a.geom, nc.geom, 0.02)
        WHERE a.id >= ${min} AND a.id <= ${max}
        GROUP BY
            a.id,
            a.names,
            a.geom
    `, (err, res) => {
        if (err) return cb(err);
        if (res.rows.length === 0) return cb();

        const linkerRes = [];
        for (const row of res.rows) {
            if (!row || !row.nets || !row.nets.length) continue;

            const match_nets = [];
            for (const net of row.nets) {
                for (const net_name of net.name) {
                    if (net_name.display && net_name.display.trim().length) {
                        match_nets.push({
                            id: net.id,
                            name: net_name,
                            dist: net.dist
                        });
                    }
                }
            }

            row.nets = match_nets;

            const nets = linker(row.name, row.nets);

            if (!nets || !nets.length === 0) continue;

            nets.sort((a, b) => {
                return a.dist - b.dist;
            });

            linkerRes.push({
                id: row.id,
                net: nets[0]
            });
        }

        pool.connect((err, trans, pg_done) => {
            trans.query(`
                BEGIN;
            `, (err) => {
                if (err) return cb(err);

                const dbQ = new Q();

                for (const lRes of linkerRes) {
                    dbQ.defer(commit, trans, lRes.id, lRes.net);
                }

                dbQ.await((err) => {
                    if (err) return cb(err);

                    trans.query(`
                        COMMIT;
                    `, (err) => {
                        pg_done();
                        return cb(err);
                    });
                });
            });
        });

        /**
         * Commit an individual matched result into the DB
         * @param {Object} trans Postgres client
         * @param {number} id ID of address feature to update
         * @param {Array} net Array of potential valid network matches - dist attribute will pick top result
         * @param {function} done Callback in form (err, res)
         */
        function commit(trans, id, net, done) {
            trans.query(`
                UPDATE address
                    SET netid = ${net.id}
                    WHERE id = ${id};
            `, (err) => {
                return done(err);
            });
        }
    });
}

module.exports.main = match;
module.exports.init = init;
module.exports.kill = kill;

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
 * @return {Function} Callback
 */
function match(min, max, cb) {
    pool.query(`
        SELECT
            a.id AS id,
            MAX(a.text) AS address,
            MAX(a._text) AS address_text,
            MAX(a.text_tokenless) AS address_text_tokenless,
            (
                SELECT
                    json_agg(row_to_json(row(r.*))) AS col
                FROM (
                    SELECT
                        n.id,
                        n.text,
                        n._text,
                        n.text_tokenless,
                        ST_Distance(ST_ClosestPoint(n.geom, MAX(a.geom)::GEOMETRY), MAX(a.geom)::GEOMETRY) AS dist
                    FROM
                        network_cluster n
                    WHERE
                        ST_Intersects(ST_Buffer(MAX(a.geom), 0.00018), n.geom)
                    ORDER BY dist
                ) r
            ) AS nets
        FROM
            address a
        WHERE
            a.id >= ${min} AND a.id <= ${max}
        GROUP BY
            a.id;
    `, (err, res) => {
        if (err) return cb(err);
        if (res.rows.length === 0) return cb(new Error(`No addresses between id: ${min}->${max}`));

        let linkerRes = [];
        for (let row of res.rows) {
            if (!row || !row.nets || !row.nets.length) continue;

            let nets = linker({
                id: row.id,
                text: row.address,
                _text: row.address_text,
                text_tokenless: row.address_text_tokenless
            }, row.nets.map((net) => {
                return {
                    id: net.f1,
                    dist: net.f5,
                    text: net.f2,
                    _text: net.f3,
                    text_tokenless: net.f4
                };
            }));

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
            `, (err, res) => {
                if (err) return cb(err);

                const dbQ = new Q();

                for (let lRes of linkerRes) {
                    dbQ.defer(commit, trans, lRes.id, lRes.net);
                }

                dbQ.await((err) => {
                    if (err) return cb(err);

                    trans.query(`
                        COMMIT;
                    `, (err, res) => {
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
         * @return {function} callback in form (err, res)
         */
        function commit(trans, id, net, done) {
            trans.query(`
                UPDATE address
                    SET netid = ${net.id}
                    WHERE id = ${id};
            `, (err, res) => {
                return done(err);
            });
        }
    });
}

module.exports.main = match;
module.exports.init = init;
module.exports.kill = kill;

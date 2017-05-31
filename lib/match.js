const linker = require('./linker');
const pg = require('pg');
const Queue = require('d3-queue').queue;

let pool;
let id;

process.on('message', (message) => {
    if (Array.isArray(message)) {
        const matchQ = Queue();

        for (id of message) {
             matchQ.defer(match, id);
        }

        matchQ.await((err) => {
            process.send({
                error: err,
                jobs: message.length
            });
        });
    } else {
        pool = new pg.Pool(message.pool);        
        id = message.id;

        process.send({
            jobs: 0
        });
    }
});

function match(id, cb) {
    this.pool.query(`
        SELECT
            network.text AS network,
            network.text_tokenless AS network_text_tokenless,
            addr.id,
            addr.text,
            addr.text_tokenless AS text_tokenless
        FROM
            address_cluster addr,
            network_cluster AS network
        WHERE
            network.id = ${id} AND
            ST_Intersects(network.buffer, addr.geom);
    `, (err, res) => {
        if (err) return cb(err);

        if (!res.rows.length) return cb();

        let address = linker({
            id: id,
            text: res.rows[0].network,
            text_tokenless: res.rows[0].network_text_tokenless
        }, res.rows)

        if (!address) return cb();

        this.pool.query(`
            UPDATE network_cluster
            SET address = ${address.id}
            WHERE network_cluster.id = ${id};
        `, (err, res) => {
            return cb(err);
        });
    });
}

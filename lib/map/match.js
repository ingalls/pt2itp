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

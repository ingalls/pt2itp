'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const pg = require('pg');

const Index = require('./map/index');

const app = express();
const router = new express.Router();

let pool = false;

app.disable('x-powered-by');

app.use(express.static(path.resolve(__dirname, '..', 'web')));
app.use('/api/', router);

/**
 * Import ITP data into database and then start web debug interface
 * @param {Object|Array} argv Argument object - Array if passed straight from cli (process.argv) Object if calling from a module
 * @param {Function} cb Callback once server has started in (err, res)
 * @return {Function} cb
 */
function main(argv, cb) {
    if (!cb || typeof cb !== 'function') throw new Error('lib/debug.js requires a callback parameter');

    if (Array.isArray(argv)) {
        argv = require('minimist')(argv, {
            string: [
                'itp',
                'db'
            ],
            boolean: [
                'skip-import'
            ],
            alias: {
                database: 'db'
            }
        });
    }

    if (!argv.db) {
        return cb(new Error('--db option required for debug mode'));
    } else if (!argv.itp && !argv['skip-import']) {
        return cb(new Error('--itp option required for debug mode'));
    }

    pool = new pg.Pool({
        max: 10,
        user: 'postgres',
        database: argv.db,
        idleTimeoutMillis: 30000
    });

    const index = new Index(pool);

    if (argv['skip-import']) return serve(cb);

    fs.stat(path.resolve(__dirname, '..', argv.itp), () => {
        index.itp(path.resolve(__dirname, '..', argv.itp), (err) => {
            if (err) return cb(err);

            console.error('ok - imported itp data');

            return serve(cb);
        });
    });
}

/**
 * Once the ITP data is imported into backend, start the express server
 * @param {Function} cb Callback in (err, res)
 * @return {Function} cb once the server has started
 */
function serve(cb) {
    console.error('ok - server started');

    router.use((req, res, next) => {
        console.error('[%s] /api%s', req.method, req.url);
        return next();
    });

    // Display individual ITP based on numeric id
    router.get('/id/:id', (req, res) => {
        pool.query(`
            SELECT blob FROM itp WHERE id = ${parseInt(req.params.id)}
        `, (err, itp) => {
            if (err) return cb(err);

            if (itp.rows.length) {
                res.send(itp.rows[0].blob);
            } else {
                res.status(404).send("Sorry can't find that!");
            }
        });
    });

    router.get('/bounds', (req, res) => {
        pool.query(`
            SELECT ST_Extent(geom) AS bounds FROM itp;
        `, (err, bounds) => {
            if (err) return cb(err);

            const bb = bounds.rows[0].bounds.replace('BOX(', '').replace(')','').split(',').map((coords) => {
                return coords.split(' ');
            });

            res.send(bb);
        });
    });

    router.get('/coords/:latlng', (req, res) => {
        pool.query(`
            SELECT
                blob
            FROM
                itp
            WHERE
                ST_Intersects(geom, ST_SetSRID(ST_MakePoint(${req.params.latlng.split(',')[0]}, ${req.params.latlng.split(',')[1]}), 4326))
            ORDER BY
                ST_Distance(
                    ST_ClosestPoint(
                        ST_SetSRID(ST_GeomFromGeoJSON(blob->>'geometry'), 4326),
                        ST_SetSRID(ST_MakePoint(${req.params.latlng.split(',')[0]}, ${req.params.latlng.split(',')[1]}), 4326)
                    ),
                    ST_SetSRID(ST_MakePoint(${req.params.latlng.split(',')[0]}, ${req.params.latlng.split(',')[1]}), 4326)
                ) ASC
            LIMIT 1;
        `, (err, itp) => {
            if (err) return cb(err);

            if (itp.rows.length) {
                res.send(itp.rows[0].blob);
            } else {
                res.status(404).send("Sorry can't find that!");
            }
        });
    });

    app.listen(4000, (err) => {
        if (err) return cb(err);

        console.log('Server listening http://localhost:4000');

        return cb();
    });
}

module.exports = main;

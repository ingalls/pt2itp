const os = require('os');
const fs = require('fs');
const turf = require('@turf/turf');
const path = require('path');
const readline = require('readline');
const CP = require('child_process');
const Queue = require('d3-queue').queue;
const _ = require('lodash');
const pgcopy = require('pg-copy-streams').from;

const CPUS = os.cpus().length;

const tokenize = require('../util/tokenize');
const tokens = require('@mapbox/geocoder-abbreviations');

/**
 * @class Index
 */
class Index {
    constructor(pool) {
        this.pool = pool;
    }

    /**
     * Initialize an empty conflate database with required tables
     * @param {Function} cb Callback in (err, res)
     * @return {Function} cb
     */
    init(cb) {
        this.pool.connect((err, client, release) => {
            if (err) return cb(err);

            client.query(`
                ABORT;
                BEGIN;

                CREATE EXTENSION IF NOT EXISTS POSTGIS;

                DROP TABLE IF EXISTS modified;
                CREATE TABLE modified (id BIGINT, version BIGINT, props JSONB, geom GEOMETRY(POINT, 4326));

                COMMIT;
            `, (err, res) => {
                client.release();
                return cb(err);
            });
        });
    }

    /**
     * Add indexes to persistent table
     * @param {Function} cb Callback in (err, res)
     * @return {Function} cb
     */
    optimize(cb) {
        const self = this;

        this.pool.query(`
            BEGIN;

            CREATE INDEX modified_persistent_gix ON modified USING GIST(geom);

            COMMIT;
        `, cb);
    }
}

module.exports = Index;

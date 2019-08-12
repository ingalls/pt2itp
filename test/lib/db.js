'use strict';

const pg = require('pg');
const pg_init = require('../../native/index.node').pg_init;

/**
 * Wipe/Reset test database
 * @param {Object} test Tape object
 */
function init(test) {
    test('Database Reset', (t) => {
        const pool = new pg.Pool({
            max: 10,
            user: 'postgres',
            database: 'postgres',
            idleTimeoutMillis: 30000
        });

        t.test('Close Connections', (q) => {
            pool.query(`
                SELECT
                    pg_terminate_backend(pg_stat_activity.pid)
                FROM
                    pg_stat_activity
                WHERE
                    pg_stat_activity.datname = 'pt_test'
                    AND pid <> pg_backend_pid();
            `, (err) => {
                q.error(err, 'connections closed');
                q.end();
            });
        });

        t.test('Drop Database', (q) => {
            pool.query(`
                DROP DATABASE IF EXISTS pt_test;
            `, (err) => {
                q.error(err, 'database dropped');
                q.end();
            });
        });

        t.test('Create Database', (q) => {
            pool.query(`
                CREATE DATABASE pt_test;
            `, (err) => {
                q.error(err, 'database created');
                q.end();
            });
        });

        t.test('Close Pool', (q) => {
            pool.end();

            pg_init();

            q.end();
        });
    });
}

/**
 * Get a standard postgres test pool
 * @returns Object Postgres pool
 */
function get() {
    return new pg.Pool({
        max: 10,
        user: 'postgres',
        database: 'pt_test',
        idleTimeoutMillis: 30000
    });
}

module.exports = {
    init: init,
    get: get
};

'use strict';

const worker = require('../index').consensus;

const test = require('tape');
const path = require('path');
const fs = require('fs');

const db = require('./lib/db');
db.init(test);

test('consensus - full agreement', (t) => {
    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/error-sources');
        fs.unlinkSync('/tmp/error-test-set');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    const results = worker({
        sources: [
            path.resolve(__dirname, './fixtures/dc-consensus-source-1-close.geojson'),
            path.resolve(__dirname, './fixtures/dc-consensus-source-2-close.geojson'),
            path.resolve(__dirname, './fixtures/dc-consensus-source-3-close.geojson')
        ],
        'query_points': path.resolve(__dirname, './fixtures/dc-consensus-test-set.geojson'),
        'error_sources': '/tmp/error-sources',
        'error_query_points': '/tmp/error-test-set',
        context: {
            country: 'us',
            region: 'dc',
            languages: ['en']
        },
        db: 'pt_test'
    });

    t.deepEqual(results, {
        results: {
            'source-1': { agreement_count: 1, hit_count: 1 },
            'source-2': { agreement_count: 1, hit_count: 1 },
            'source-3': { agreement_count: 1, hit_count: 1 }
        },
        threshold: 25,
        sample_count: 1
    });

    t.doesNotThrow(() => {
        fs.accessSync('/tmp/error-sources');
        fs.accessSync('/tmp/error-test-set');
    });

    fs.unlinkSync('/tmp/error-sources');
    fs.unlinkSync('/tmp/error-test-set');
    t.end();
});

test('consensus - partial agreement', (t) => {
    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/error-sources');
        fs.unlinkSync('/tmp/error-test-set');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    const results = worker({
        sources: [
            path.resolve(__dirname, './fixtures/dc-consensus-source-1-close.geojson'),
            path.resolve(__dirname, './fixtures/dc-consensus-source-2-close.geojson'),
            path.resolve(__dirname, './fixtures/dc-consensus-source-4-far.geojson')
        ],
        'query_points': path.resolve(__dirname, './fixtures/dc-consensus-test-set.geojson'),
        'error_sources': '/tmp/error-sources',
        'error_query_points': '/tmp/error-test-set',
        context: {
            country: 'us',
            region: 'dc',
            languages: ['en']
        },
        db: 'pt_test'
    });

    t.deepEqual(results, {
        results: {
            'source-1': { agreement_count: 1, hit_count: 1 },
            'source-2': { agreement_count: 1, hit_count: 1 },
            'source-4': { agreement_count: 0, hit_count: 1 }
        },
        threshold: 25,
        sample_count: 1
    });

    t.doesNotThrow(() => {
        fs.accessSync('/tmp/error-sources');
        fs.accessSync('/tmp/error-test-set');
    });

    fs.unlinkSync('/tmp/error-sources');
    fs.unlinkSync('/tmp/error-test-set');
    t.end();
});

test('consensus - no agreement', (t) => {
    // Ensure files don't exist before test
    try {
        fs.unlinkSync('/tmp/error-sources');
        fs.unlinkSync('/tmp/error-test-set');
    } catch (err) {
        console.error('ok - cleaned tmp files');
    }

    const results = worker({
        sources: [
            path.resolve(__dirname, './fixtures/dc-consensus-source-1-close.geojson'),
            path.resolve(__dirname, './fixtures/dc-consensus-source-4-far.geojson'),
            path.resolve(__dirname, './fixtures/dc-consensus-source-5-far.geojson')
        ],
        'query_points': path.resolve(__dirname, './fixtures/dc-consensus-test-set.geojson'),
        'error_sources': '/tmp/error-sources',
        'error_query_points': '/tmp/error-test-set',
        context: {
            country: 'us',
            region: 'dc',
            languages: ['en']
        },
        db: 'pt_test'
    });

    t.deepEqual(results, {
        results: {
            'source-1': { agreement_count: 0, hit_count: 1 },
            'source-4': { agreement_count: 0, hit_count: 1 },
            'source-5': { agreement_count: 0, hit_count: 1 }
        },
        threshold: 25,
        sample_count: 1
    });

    t.doesNotThrow(() => {
        fs.accessSync('/tmp/error-sources');
        fs.accessSync('/tmp/error-test-set');
    });

    fs.unlinkSync('/tmp/error-sources');
    fs.unlinkSync('/tmp/error-test-set');
    t.end();
});

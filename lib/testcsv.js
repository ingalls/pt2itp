#!/usr/bin/en

module.exports = testCsv;
const fs = require('fs');
const geocode = require('./geocode');
const path = require('path');

function testCsv(argv, cb) {
    if (Array.isArray(argv)) {
    	
        argv = require('minimist')(argv, {
            string: ['index'],
            boolean: [
                'test-ephermal'
            ],
            alias: {
                index: 'i'
            }
        });

        let opts = {};
        if (argv.proximity)
            opts.proximity = argv.proximity.split(',').map(parseFloat);

        let c = geocode(argv);
        console.log(
            c.geocode(argv.query, opts, (err, res) => {
               if (err) {
               console.error(err);
               process.exit(1);
               }
            console.log(res);
            })
        );

        if (!argv.index) {
            console.error('--index=<index>  argument required');
            process.exit(1);
        }
        if (argv.name) {
            argv.name = argv.name.toLowerCase();
            if (['index'].indexOf(argv.name) === -1) {
            	console.error('     index: index');
                process.exit(1);
            }
        }
    }
}
#!/usr/bin/en

module.exports = testCsv;
const fs = require('fs');

/*
function testCsv(argv, err) {
    if (err) {
        console.error("error");
        }
	console.log("Hello World")
};
*/

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
    }
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

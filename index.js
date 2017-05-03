#!/usr/bin/env node

const help = require('./lib/help');
const test = require('./lib/test');
const map = require('./lib/map');
const stat = require('./lib/stat');
const debug = require('./lib/debug');
const convert = require('./lib/convert');
const settings = require('./package.json');

let argv = require('minimist')(process.argv, {
    boolean: ['help', 'version'],
    alias: {
        'version': 'v',
        'help': '?'
    }
});

if (argv.help) {
    help(argv);
    process.exit(0);
} else if (argv.version) {
    console.log(settings.name + '@' + settings.version);
    process.exit(0);
}

switch (argv._[2]) {
    case ('help'):
        help(argv);
        break;
    case ('debug'):
        debug(process.argv, (err) => {
            if (err) {
                console.error(err.stack);
                process.exit(1);
            }
        });
        break;
    case ('map'):
        map(process.argv, (err) => {
            if (err) {
                console.error(err.stack);
                process.exit(1);
            }
            console.log('ok - processing complete');
            process.exit(0);
        });
        break;
    case ('stat'):
        stat(process.argv, (err) => {
            if (err) {
                console.error(err.stack);
                process.exit(1);
            }
            process.exit(0);
        });
        break;
    case ('test'):
        test(process.argv, (err) => {
            if (err) {
                console.error(err.toString());
                process.exit(1);
            }
        });
        break;
    case ('convert'):
        convert(process.argv, (err) => {
            if (err) {
                console.error(err.toString());
                process.exit(1);
            }
        });
        break;
    default:
        help(argv);
        break;

}

#!/usr/bin/env node

const help = require('./lib/help');
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
        require('./lib/debug')(process.argv, (err) => {
            if (err) {
                console.error(err.stack);
                process.exit(1);
            }
        });
        break;
    case ('map'):
        require('./lib/map')(process.argv, (err) => {
            if (err) {
                console.error(err);
                console.error(err.stack);
                process.exit(1);
            }
            console.log('ok - processing complete');
            process.exit(0);
        });
        break;
    case ('stat'):
        require('./lib/stat')(process.argv, (err) => {
            if (err) {
                console.error(err.stack);
                process.exit(1);
            }
            process.exit(0);
        });
        break;
    case ('test'):
        require('./lib/test')(process.argv, (err) => {
            if (err) {
                console.error(err.toString());
                process.exit(1);
            }
        });
        break;
    case ('strip'):
        require('./lib/strip')(process.argv, (err) => {
            if (err) {
                console.error(err.toString());
                process.exit(1);
            }
        });
        break;
    case ('convert'):
        require('./lib/convert')(process.argv, (err) => {
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

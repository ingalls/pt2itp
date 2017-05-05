module.exports = function(argv) {
    switch (argv._[2]) {
        case ('test'):
            console.log('usage: index.js test [--config <CONFIG.json> ] [--index <INDEX.zstd> ] [--addresses=<FILE.geojson>] [--query]');
            console.log('');
            console.log('[options]:');
            console.log('   --config                      Path to Carmen Config JSON');
            console.log('   --index                       Path to carmen compatible index');
            console.log('   --addresses=<FILE.geojson>    [optional] geojson of raw addresses (can be obtained with --raw option');
            console.log('   --query="100 Example Rd"      [optional] Used instead of --addresses to query a single address');
            break;
        case ('debug'):
            console.log('usage: index.js debug [--itp <ITP GeoJSON>] [--db <DATABASE>] [--skip-import]');
            console.log('');
            console.log('[options]:');
            console.log('   --itp <ITP GeoJSON>             Generated ITP data [optional if --skip-import is used]');
            console.log('   --db  <DATABASE>                Database to use as a backend');
            console.log('   --skip-import                   [optional] Assume database already has proper data/tables');
        case ('stat'):
            console.log('usage: index.js stat <ITP GeoJSON>');
            console.log('');
            console.log('[options]:');
            console.log('   <ITP GeoJSON>                Generated ITP data');
        case ('map'):
            console.log('usage: index.js map [--in-network=<FILE.geojson>] [--in-address=<FILE.geojson>] [--output=<FILE.geojson>]');
            console.log('                    [--skip-import] [--debug] [--error|-e <FILE>]');
            console.log('');
            console.log('[options]:');
            console.log('   --in-network=<FILE.geojson>     geojson of street network [optional if --skip-import is used]');
            console.log('   --in-address=<FILE.geojson>     geojson of address points [optional if --skip-import is used]');
            console.log('   --db="<DATABASE>"               Name of database to connect to w/ user postgres');
            console.log('   --output=<FILE.geojson>         output generated ITP lines');
            console.log('   --map-network=<MAP.js>          [optional] Transformative input mapping for street network');
            console.log('   --map-address=<MAP.js>          [optional] Transformative input mapping for addresses');
            console.log('   --tokens=<Code,Code,...>        [optional] Abbreviation tokens to match');
            console.log('   --country=<ISO3166-1 Alpha2>    [optional] Optionally populate carmen:geocoder_stack');
            console.log('   --skip-import                   [optional] Assume database already has proper data/tables');
            console.log('   --debug                         [optional] Gives much richer info for `debug` mode module');
            console.log('   --error|-e <FILE>               [optional] Output invalid features to a given file');
            break;
        case ('convert'):
            console.log('usage: index.js convert [--input=<FILE.geojson>] [--output=<FILE.geojson>]');
            console.log('');
            console.log('[options]:');
            console.log('   --output=<FILE.geojson>         Single GeoJSON FeatureCollection');
            console.log('   --input=<FILE.geojson>          Line delimited GeoJSON FeatureCollections');
            console.log('');
            break;
        default:
            console.log('usage: index.js <command> [--version] [--help]');
            console.log('');
            console.log('<command>:');
            console.log('    help                      Displays this message');
            console.log('    convert  [--help]         Convert default line delimited geojson to featurecollection');
            console.log('    map      [--help]         Create interpolation from tiles');
            console.log('    test     [--help]         Use raw addresses to query generated ITP output to check for completeness');
            console.log('    stat     [--help]         Print address stats about a given itp.geojson file');
            console.log('    debug    [--help]         Start web server for visually debugging pt 2 network matches');
            console.log('');
            console.log('[options]:');
            console.log('    --version, -v           Displays version information');
            console.log('    --help                  Prints this help message');
            console.log('');
            break;
    }
}

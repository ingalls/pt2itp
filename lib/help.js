module.exports = function(argv) {
    switch (argv._[2]) {
        case ('testcsv'):
            console.log('');
            console.log('Take Carmen Indexes and test them against a given CSV file');
            console.log('  Note that the carmen indexes will only have address data, not place,postcode,etc so ensure the test');
            console.log('  fixtures do not contain this data');
            console.log('');
            console.log('usage: index.js testcsv [--config <CONFIG.json> ] [--index <INDEX.zstd> ] [--output|-o <OUTFILE>]');
            console.log('                     [--input|-i <FILE.csv>]');
            console.log('');
            console.log('[options]:');
            console.log('   --config                      Path to Carmen Config JSON');
            console.log('   --index                       Path to carmen compatible index');
            console.log('   --output|-o <OUTFILE>         File to write test output to');
            console.log('   --input|-i <FILE.csv>         Input CSV of test data in the format lon,lat,address');
            break;
        case ('test'):
            console.log('');
            console.log('Take Carmen Indexes and test them for completeness against the original input address data');
            console.log('  This test is even more useful when you build the indexes after stripping the points away to');
            console.log('  check for complteness of the ITP lines only. See strip mode');
            console.log('');
            console.log('usage: index.js test [--config <CONFIG.json> ] [--index <INDEX.zstd> ] [--output|-o <OUTFILE>]');
            console.log('                     [--database|--db <DATABASE>]');
            console.log('');
            console.log('[options]:');
            console.log('   --config                      Path to Carmen Config JSON');
            console.log('   --index                       Path to carmen compatible index');
            console.log('   --database|--db <DATABASE>    Orignal database used to gen the index - used for addresses to test');
            console.log('   --output|-o <OUTFILE>         File to write problematic addresses to');
            console.log('   --test-ephemeral              By default ephermal addresses are not tested, this enabled testing them');
            break;
        case ('debug'):
            console.log('');
            console.log('Start up an interactive web server to visualize how matches were made between network/addresses');
            console.log('');
            console.log('usage: index.js debug [--itp <ITP GeoJSON>] [--db <DATABASE>] [--skip-import]');
            console.log('');
            console.log('[options]:');
            console.log('   --itp <ITP GeoJSON>             Generated ITP data [optional if --skip-import is used]');
            console.log('   --db  <DATABASE>                Database to use as a backend');
            console.log('   --skip-import                   [optional] Assume database already has proper data/tables');
        case ('stat'):
            console.log('');
            console.log('Generate stats about addresses in the computed ITP file');
            console.log('');
            console
            console.log('');
            console.log('[options]:');
            console.log('   <ITP GeoJSON>                Generated ITP data');
        case ('map'):
            console.log('');
            console.log('Given a road network and a set of address points as line delimited geojson; output an interpolation network');
            console.log('');
            console.log('usage: index.js map [--in-network=<FILE.geojson>] [--in-address=<FILE.geojson>] [--output=<FILE.geojson>]');
            console.log('                    [--skip-import] [--debug] [--error-network <FILE>] [--error-address <FILE>]');
            console.log('                    [--post <cardinality>,...');
            console.log('');
            console.log('[options]:');
            console.log('   --in-network=<FILE.geojson>     geojson of street network [optional if --skip-import is used]');
            console.log('   --in-address=<FILE.geojson>     geojson of address points [optional if --skip-import is used]');
            console.log('   --db="<DATABASE>"               Name of database to connect to w/ user postgres');
            console.log('   --output=<FILE.geojson>         output generated ITP lines');
            console.log('   --map-network=<MAP.js>          [optional] Transformative input mapping for street network');
            console.log('   --map-address=<MAP.js>          [optional] Transformative input mapping for addresses');
            console.log('   --post <cardinality>,...        [optional] Optional PostProcessing Steps');
            console.log('          cardinality                  Add cardinal prefix/postfix as synonyms');
            console.log('                                         ie: Main St S => Main St S,S Main St');
            console.log('   --tokens=<Code,Code,...>        [optional] Abbreviation tokens to match');
            console.log('   --country=<ISO3166-1 Alpha2>    [optional] Optionally populate carmen:geocoder_stack');
            console.log('   --skip-import                   [optional] Assume database already has proper data/tables');
            console.log('   --debug                         [optional] Gives much richer info for `debug` mode module');
            console.log('   --error-network <FILE>          [optional] Output invalid features to a given file');
            console.log('   --error-map <FILE>              [optional] Output invalid features to a given file');
            break;
        case ('strip'):
            console.log('');
            console.log('Strip out Address Points from map mode (ITP) output');
            console.log('  This is useful for test mode or also if you just want the Interpolated lines and not points');
            console.log('');
            console.log('usage: index.js strip [--input=<FILE.geojson>] [--output=<FILE.geojson>]');
            console.log('');
            console.log('[options]:');
        case ('convert'):
            console.log('usage: index.js convert [--input=<FILE.geojson>] [--output=<FILE.geojson>]');
            console.log('');
            console.log('[options]:');
            console.log('   --output=<FILE.geojson>         Single GeoJSON FeatureCollection');
            console.log('   --input=<FILE.geojson>          Line delimited GeoJSON FeatureCollections');
            console.log('');
            break;
        case ('analyze'):
            console.log('\n Analyses text in the address_cluster and network_cluster tables \n');
            console.log(' --cc --type\n');
            console.log('[options]:');
            console.log(' --cc=Country code of the country whose text in the address and network geojsons you wish to analyse');
            console.log(' --type=address/network?');
            console.log('');
            break;
        default:
            console.log('usage: index.js <command> [--version] [--help]');
            console.log('');
            console.log('<command>:');
            console.log('    help                      Displays this message');
            console.log('    convert  [--help]         Convert default line delimited geojson to featurecollection');
            console.log('    strip    [--help]         Remove PTs from map output - leaving only ITP network segments');
            console.log('    map      [--help]         Create interpolation from tiles');
            console.log('    test     [--help]         Use raw addresses to query generated ITP output to check for completeness');
            console.log('    stat     [--help]         Print address stats about a given itp.geojson file');
            console.log('    analyze  [--help]         Analyze text in address_cluster and network_cluster tables');
            console.log('    debug    [--help]         Start web server for visually debugging pt 2 network matches');
            console.log('');
            console.log('[options]:');
            console.log('    --version, -v           Displays version information');
            console.log('    --help                  Prints this help message');
            console.log('');
            break;
    }
}

const turf = require('@turf/turf');
const iso = require('./iso.json');
const alt_lang = require('./cc_alternate_languages.json');
const _ = require('lodash');

/**
 * Exposes a map function to convert/filter osm or minjur geometries to pt2itp formatted ones
 *
 * @param {Object} feat     GeoJSON feature to convert/filter
 * @return {Object|false}   Converted GeoJSON feature or false if it cannot be converted.
 */
function map(feat, context) {
    //Skip points & Polygons
    if (feat.geometry.type !== 'LineString' && feat.geometry.type !== 'MultiLineString') return false;

    //Skip non-highways
    if (!feat.properties || !feat.properties.highway) return false;

    let accepted = [
        'motorway',
        'trunk',
        'primary',
        'secondary',
        'tertiary',
        'residential',
        'unclassified',
        'living_street',
        'pedestrian',
        'service',
        'track',
        'road',
        'construction',
        'proposed',
        'footway'
    ];

    //Eliminate all highway types not on accepted list
    if (accepted.indexOf(feat.properties.highway) === -1) return false;

    //Contains Objects in the format: { name: String, priority: Int }
    let names = [];

    //Generate all possible name fields for all langs
    let targetKeys = ['name', 'loc_name', 'alt_name', 'ref'];
    targetKeys = targetKeys.concat(Object.keys(feat.properties).filter((k) => { return /(name_\d+)/.test(k); }));

    if (context.country in alt_lang && alt_lang[context.country].length) {
        let alternateLanguages = alt_lang[context.country];
        targetKeys = targetKeys.concat(alternateLanguages.map((x) => { return `name:${x}`; }));
    }

    //Extract the actual names from the list of target keys
    for (let key of targetKeys) {
        if (!feat.properties[key]) continue;

        names = names.concat(feat.properties[key].split(';').filter((n) => {
            return !!n.trim().length
        }).map((n) => {
            return {
                name: n,
                priority: 0
            }
        }));
    }

    let highway = false;

    //Add any country/region specific function calls here
    let additional = [];
    for (let i = 0; i < names.length; i++) {
        //United States Specific Name Formatting
        if (context.country === 'us') {
            names[i].name = replace_octo(names[i].name);

            let us_hwys = alts_us_route(names[i].name);
            additional = additional.concat(us_hwys);
            if (us_hwys.length) highway = true;

            if (context.region) {
                let state_hwys = alts_state_hwy(context.region, names[i].name);
                additional = additional.concat(state_hwys);
                if (state_hwys.length) highway = true;
            }
        }

        if (['au', 'ca', 'gb', 'nz', 'us'].indexOf(context.country) !== -1 && !highway) {
            //Match 5 Avenue - no suffix
            let numericNameMatch = /^(\d+)(\s+\w.*)$/.exec(names[i].name);

            if (numericNameMatch) {
                let num = parseInt(numericNameMatch[1]);
                let rest = numericNameMatch[2];
                let suffix = false;
                if (((num % 100) >= 10) && ((num % 100) <=20)) {
                    suffix = 'th';
                } else if ((num % 10) === 1) {
                    suffix = 'st';
                } else if ((num % 10) === 2) {
                    suffix = 'nd';
                } else if ((num % 10) === 3) {
                    suffix = 'rd';
                } else {
                    suffix = 'th';
                }

                if (suffix) {
                    additional.push({
                        name: num.toString() + suffix + rest,
                        priority: -1
                    });
                }
            }
        }
    }

    names = names.concat(additional);

    if (['track', 'service', 'construction', 'proposed', 'footway'].indexOf(feat.properties.highway) !== -1 && (names.length === 0))
        return false; // these classes of roads should only be allowed if they are already named

    if (turf.lineDistance(feat.geometry) < 0.001)
        return false;

    if (names.length === 0) {
        names.push({
            name: '',
            priority: 0
        });
    } else { //Dedupe names array
        _.uniqBy(names, n => n.name.toLowerCase());
    }

    let outNames = [];
    for (let name of names) {
        outNames.push({
            type: 'Feature',
            properties: {
                id: feat.properties['@id'],
                street: {
                    display: name.name,
                    priority: name.priority
                }
            },
            geometry: feat.geometry
        });
    }

    return outNames;
}

/**
 * Replace names like "US 81 => US Route 81"
 * @param {string} name to edit
 * @return {Array} of name alts
 */
function alts_us_route(name) {
    if (!name) return;

    let names = [];

    let highway = false; //If truthy should be a string of the format 'US 81'
    if (name.match(/^(U\.?S\.?|United States)(\s|-)(Rte |Route |Hwy |Highway )?[0-9]+$/i)) {
        highway = `US ${name.match(/[0-9]+/)[0]}`;
    }

    if (highway) {
        let num = name.match(/[0-9]+/)[0];

        //US 81
        names.push({
            name: highway,
            priority: -1
        });

        //US Route 81 (Display Form)
        names.push({
            name: `US Route ${num}`,
            priority: 1
        });

        //US Route 81 (Display Form)
        names.push({
            name: `US Highway ${num}`,
            priority: -1
        });

        //United States Route 81
        names.push({
            name: `United States Route ${num}`,
            priority: -1
        });

        //United States Route 81
        names.push({
            name: `United States Highway ${num}`,
            priority: -1
        });
    }

    return names;


}

/**
 * Replace names like "NC 1 => North Carolina Highway 1"
 * Replace names like "State Highway 1 => NC 1, North Carolina Highway 1
 * @param {string} region Region of the US, usually a state
 * @param {string} name Name to edit
 * @return {Array} of name alts
 */
function alts_state_hwy(region, name) {
    if (!name) return;

    let names = [];

    region = region.toUpperCase();

    //The Goal is to get all input highways to <STATE> #### and then format the matrix
    let highway = false;
    if (name.match(/^state (highway|hwy) /i)) {
        //State Highway 123
        highway = name.replace(/^state (highway|hwy) /i, `${region} `);
    } else if (name.match(/^(Highway|hwy) [0-9]+$/i) || name.match(/^[0-9]+ (highway|hwy)$/i)) {
        //Highway 123
        //123 Highway
        highway = `${region} ${name.match(/[0-9]+/i)[0]}`;
    } else if (name.match(new RegExp(`^${iso.US.divisions[`US-${region}`]} (highway|hwy) [0-9]+$`, 'i')) || name.match(new RegExp(`^${region} (highway|hwy) [0-9]+$`, 'i'))) {
        //North Carolina Highway 123
        //NC Highway 123
        highway = `${region} ${name.match(/[0-9]+/i)[0]}`;
    } else if (name.match(new RegExp(`^${region} [0-9]+$`, 'i'))) {
        //NC 123
        highway = name;
    } else if (name.match(new RegExp(`^${region} [0-9]+ (highway|hwy)$`, 'i'))) {
        //NC 123 Highway
        highway = `${region} ${name.match(/[0-9]+/i)[0]}`;
    }

    //Now that we have mapped highway combinations above into a uniform `NC 123` form
    //Expand to all possible combinations
    if (highway) {
        //NC 123
        names.push({
            name: highway,
            priority: -1
        });

        //NC 123 Highway
        names.push({
            name: `${highway} Highway`,
            priority: -1
        });

        //North Carolina Highway 123 (Display Form)
        names.push({
            name: highway.replace(new RegExp(`^${region} `, 'i'), `${iso.US.divisions[`US-${region}`]} Highway `),
            priority: 1
        });

        //Highway 123
        names.push({
            name: highway.replace(new RegExp(`^${region} `, 'i'), `Highway `),
            priority: -1
        });

        //State Highway 123
        names.push({
            name: highway.replace(new RegExp(`^${region} `, 'i'), `State Highway `),
            priority: -1
        });
    }

    return names;
}

/**
 * Removes the octothorpe from names like "HWY #35", to get "HWY 35"
 * @param {string} name Name to edit
 */
function replace_octo(name) {
    if (!name) return;

    let octothorpePattern = new RegExp('^(HWY |HIGHWAY |RTE |ROUTE |US )(#)(\\d+)$', 'i');

    let match = name.match(octothorpePattern);
    if (match) {
        let formattedName = `${match[1]}${match[3]}`;
        name = formattedName;
    }

    return name;
}

module.exports.map = map;

if (require.main === module) {
    const readline = require('readline');

    let rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on('line', (pt) => {
        if (!pt) return;

        let feat = null;
        try {
            feat = JSON.parse(pt);
        } catch (err) {
            return;
        }
        if (!feat) return;
        let m = map(feat, process.argv);
        if (!m) return;
        for (let n of m) {
            rl.output.write(JSON.stringify(n) + '\n');
        }
    });
}


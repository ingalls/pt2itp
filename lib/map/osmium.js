const turf = require('@turf/turf');
const iso = require('./iso.json');
const text = require('../util/text');
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

    //Contains Objects in the format: { display: String, priority: Int }
    let names = [];

    if (feat.properties.name) {
        let main_name = feat.properties.name.split(';').map((name, i) => {
            if (i === 0) {
                names.push({
                    display: name,
                    priority: 0
                });
            } else if (name.trim().length > 1) {
                    names.push({
                        display: name,
                        priority: -1
                    });
                }
        });
    }

    let targetKeys = [ 'loc_name', 'alt_name', 'ref'];
    targetKeys = targetKeys.concat(Object.keys(feat.properties).filter((k) => { return /(name_\d+)/.test(k); }));

    //Extract the actual names from the list of target keys
    for (let key of targetKeys) {
        if (!feat.properties[key]) continue;

        names = names.concat(feat.properties[key].split(';').filter((n) => {
            return !!n.trim().length
        }).map((n) => {
            return {
                display: n,
                priority: -1
            }
        }));
    }

    let highway = false;

    //Add any country/region specific function calls here
    let additional = [];
    for (let i = 0; i < names.length; i++) {
        if (context.country === 'ca') {
            names[i].display = replace_octo(names[i].display);

            if (context.region) {
                let ca_hwys = alts_ca_hwy(context.region, names[i].display);
                if (ca_hwys.length) highway = true;

                additional = additional.concat(ca_hwys);
            }
        }

        if (['us', 'ca', 'gb', 'de', 'ch', 'at'].indexOf(context.country) !== -1) {
            //Remove Drive through names like "Burger King Drive Through"
            if (names[i].display.match(/drive.?(in|through|thru)$/i)) return false;

        }


        //United States Specific Name Formatting
        if (context.country === 'us') {
            // Name Synonyms
            names[i].display = replace_octo(names[i].display);

            let us_hwys = alts_us_route(names[i].display, i === 0 ? true : false);
            additional = additional.concat(us_hwys);
            if (us_hwys.length) highway = true;

            let us_crs = alts_county_road(names[i].display, i === 0 ? true : false);
            additional = additional.concat(us_crs);
            if (us_crs.length) highway = true;

            if (context.region) {
                let state_hwys = alts_state_hwy(context.region, names[i].display, i === 0 ? true : false);
                additional = additional.concat(state_hwys);
                if (state_hwys.length) highway = true;
            }
        }

        if (['au', 'ca', 'gb', 'nz', 'us'].indexOf(context.country) !== -1 && !highway) {
            let syn = false;

            syn = text.number_suffix(names[i].display);
            if (syn) {
                additional.push({
                    display: syn,
                    priority: -1
                });
            }
            syn = false;

            syn = text.written_numeric(names[i].display);
            if (syn) {
                additional.push({
                    display: syn,
                    priority: -1
                });
            }
            syn = false;
        }
    }

    names = names.concat(additional);

    if (['track', 'service', 'construction', 'proposed', 'footway'].indexOf(feat.properties.highway) !== -1 && (names.length === 0))
        return false; // these classes of roads should only be allowed if they are already named

    if (turf.lineDistance(feat.geometry) < 0.001)
        return false;

    if (names.length === 0) {
        names.push({
            display: '',
            priority: 0
        });
    } else { //Dedupe names array
        _.uniqBy(names, n => n.display.toLowerCase());
    }

    if (names.length > 1) {
        names = names.sort((a, b) => {
            return b.priority - a.priority;
        });

        if (names[0].priority === names[1].priority) {
            names[0].priority++;
        }
    }

    return {
        type: 'Feature',
        properties: {
            id: feat.properties['@id'],
            street: names
        },
        geometry: feat.geometry
    };
}

/**
 * Adds Synonyms to names like "Highway 123 => NS-123, Nova Scotia Highway 123
 * @param {string} region Region of the US, usually a state
 * @param {string} name Name to edit
 * @return {Array} of name alts
 */
function alts_ca_hwy(region, name) {
    if (!name) return [];

    let names = [];

    region = region.toUpperCase();

    let highway = false;
    if (name.match(/^[0-9]+[a-z]?$/) && name !== '1') { //Trans Canada shouldn't be provincial highway
        //101
        highway = `${region} ${name}`;
    } else if (name.match(new RegExp(`^${region}-[0-9]+[a-z]?$`, 'i'))) {
        //NB-101
        highway = name.replace(/-/, ' ');
    } else if (name.match(/(Highway|hwy|route|rte) [0-9]+[a-z]?$/i) || name.match(/King\'?s Highway [0-9]+[a-z]?/i)) {
        //Kings's Highway 123 (Ontario)
        //Highway 123
        //Route 123a
        highway = `${region} ${name.match(/[0-9]+[a-z]?/i)}`;
    } else if (name.match(/(Alberta|British Columbia| Saskatchewan|Manitoba|Yukon|New Brunswick|Newfoundland and Labrador|Newfoundland|Labrador|Price Edward Island|PEI|Quebec|Northwest Territories|Nunavut|Nova Scotia) (Highway|hwy|Route|rtw) [0-9]+[a-z]?/i)) {
        //Alberta Highway ##    British Columbia Highway ##     Saskatchewan Highway ##     Manitoba Highway ##     Yukon Highway ###
        //New Brunswick Route ##    Newfoundland and Labrador Route ##      Prince Edward Island Route ##       Quebec Route ##
        highway = `${region} ${name.match(/[0-9]+[a-z]?/i)}`;
    }

    //Now that we have mapped highway combinations above into a uniform `NS 123` form
    //Expand to all possible combinations
    if (highway) {
        //Highway 123
        names.push({
            display: highway.replace(new RegExp(`^${region} `, 'i'), `Highway `),
            priority: -1
        });

        //Route 123
        names.push({
            display: highway.replace(new RegExp(`^${region} `, 'i'), `Route `),
            priority: -1
        });

        //NB 123
        names.push({
            display: highway,
            priority: -2
        });

        let type = 'Highway';
        if (['NB', 'NL', 'PE', 'QC'].indexOf(region) > -1) type = 'Route';
        //New Brunswick Route 123 (Display Form)
        names.push({
            display: highway.replace(new RegExp(`^${region} `, 'i'), `${iso.CA.divisions[`CA-${region}`]} ${type} `),
            priority: -2
        });
    }

    return names;
}

/**
 * Replace names like "CR 123" => "County Road 123"
 */
function alts_county_road(name, replace_primary) {
    if (!name) return [];

    let names = [];

    let highway = name.match(/^(CR |County Road )([0-9]+)$/i);
    if (!highway) return [];
    highway = highway[2];

    //County Road 81
    names.push({
        display: `County Road ${highway}`,
        priority: replace_primary ? 1 : -1
    });

    //CR 81
    names.push({
        display: `CR ${highway}`,
        priority: -1
    });

    return names;
}

/**
 * Replace names like "US 81" => "US Route 81"
 * @param {string} name to edit
 * @param {boolean} replace_primary if true the main name priority can be > 0
 * @return {Array} of name alts
 */
function alts_us_route(name, replace_primary) {
    if (!name) return [];

    let names = [];

    let highway = false; //If truthy should be a string of the format 'US 81'
    if (name.match(/^(U\.?S\.?|United States)(\s|-)(Rte |Route |Hwy |Highway )?[0-9]+$/i)) {
        highway = `US ${name.match(/[0-9]+/)[0]}`;
    }

    if (highway) {
        let num = name.match(/[0-9]+/)[0];

        //US 81
        names.push({
            display: highway,
            priority: -1
        });

        //US Route 81 (Display Form)
        names.push({
            display: `US Route ${num}`,
            priority: replace_primary ? 1 : -1
        });

        //US Route 81 (Display Form)
        names.push({
            display: `US Highway ${num}`,
            priority: -1
        });

        //United States Route 81
        names.push({
            display: `United States Route ${num}`,
            priority: -1
        });

        //United States Route 81
        names.push({
            display: `United States Highway ${num}`,
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
 * @param {boolean} replace_primary if true the main name priority can be > 0
 * @return {Array} of name alts
 */
function alts_state_hwy(region, name, replace_primary) {
    if (!name) return [];

    let names = [];

    region = region.toUpperCase();

    //The Goal is to get all input highways to <STATE> #### and then format the matrix
    let highway = false;
    if (name.match(/^state (highway|hwy|route|rte) /i)) {
        //State Highway 123
        //State Route 123
        highway = name.replace(/^state (highway|hwy|route|rte) /i, `${region} `);
    } else if (name.match(/^(Highway|hwy) [0-9]+$/i) || name.match(/^[0-9]+ (highway|hwy)$/i)) {
        //Highway 123
        //123 Highway
        highway = `${region} ${name.match(/[0-9]+/i)[0]}`;
    } else if (name.match(new RegExp(`^${iso.US.divisions[`US-${region}`]} (highway|hwy) [0-9]+$`, 'i')) || name.match(new RegExp(`^${region} (highway|hwy) [0-9]+$`, 'i'))) {
        //North Carolina Highway 123
        //NC Highway 123
        highway = `${region} ${name.match(/[0-9]+/i)[0]}`;
    } else if (name.match(/^SR[- ][0-9]+$/)) {
        //SR 123
        //SR-123
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
        //NC 123 Highway
        names.push({
            display: `${highway} Highway`,
            priority: -2
        });

        //Highway 123
        names.push({
            display: highway.replace(new RegExp(`^${region} `, 'i'), `Highway `),
            priority: -2
        });

        //NC 123
        names.push({
            display: highway,
            priority: -1
        });

        //SR 123
        names.push({
            display: highway.replace(new RegExp(`^${region} `, 'i'), `SR `),
            priority: -1
        });

        //North Carolina Highway 123 (Display Form)
        names.push({
            display: highway.replace(new RegExp(`^${region} `, 'i'), `${iso.US.divisions[`US-${region}`]} Highway `),
            priority: replace_primary ? 1 : -1
        });

        //State Highway 123
        names.push({
            display: highway.replace(new RegExp(`^${region} `, 'i'), `State Highway `),
            priority: -1
        });

        //State Highway 123
        names.push({
            display: highway.replace(new RegExp(`^${region} `, 'i'), `State Route `),
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

module.exports = interpolize;
module.exports.lsb = LSB;
module.exports.segment = segment;

const tilebelt = require('@mapbox/tilebelt');
const cover = require('@mapbox/tile-cover');
const turf = require('@turf/turf');
const _ = require('lodash');

const explode = require('./explode');
const det2D = require('./misc').det2D;
const sign = require('./misc').sign

function interpolize(street, address, argv = {}) {
    const dist = []
    let streetDist = turf.lineDistance(street, 'kilometers');

    //Generate coorelation between every address and its position on the line
    for (let address_it = 0; address_it < address.geometry.coordinates.length; address_it++) {
        let linePt = turf.pointOnLine(street, turf.point(address.geometry.coordinates[address_it])); //Closest pt on line to addr

        let res = {
            'distOnLine': turf.lineDistance(turf.lineSlice(turf.point(street.geometry.coordinates[0]), linePt, street), 'kilometers'),
            'distFromOrigin': turf.distance(turf.point(street.geometry.coordinates[0]), turf.point(address.geometry.coordinates[address_it]), 'kilometers'),
            'distFromEnd':  turf.distance(turf.point(street.geometry.coordinates[street.geometry.coordinates.length -1]), turf.point(address.geometry.coordinates[address_it]), 'kilometers'),
            'geometry': turf.point(address.geometry.coordinates[address_it]),
            'number': address.properties.numbers[address_it],
            'side': null
        };

        let seg = segment(street, res.distOnLine, 'kilometers');
        res.side = sign(det2D(seg[0], seg[1], address.geometry.coordinates[address_it]));

        dist.push(res);
    }

    const leftSide = LSB(street.geometry.coordinates[0], street.geometry.coordinates[1])

    const distStart = _.cloneDeep(dist.sort((a, b) => {
        if (a.distOnLine !== 0 && b.distOnLine !== 0) { //Handle cases where both addresses are to the direct left/right of the line
            let distA = a.distOnLine + a.distFromOrigin;
            let distB = b.distOnLine + a.distFromOrigin;
            if (distA < distB) return -1;
            if (distA > distB) return 1;
            return 0;
        } else if (a.distOnLine === 0 && b.distOnLine !== 0) { //a is off the beginning of the line, b is l/r of the line
            return -1;
        } else if (b.distOnLine === 0 && a.distOnLine !== 0) { //b is off the beginning of the line, a is l/r of the line
            return 1;
        } else { //both a/b are off the end of the line
            return b.distFromOrigin - a.distFromOrigin;
        }
    }));

    const distEnd = _.cloneDeep(dist.sort((a, b) => {
        if ((streetDist - a.distOnLine) !== 0 && (streetDist - b.distOnLine) !== 0) { //Handle cases where both addresses are to the direct left/right of the line
            let distA = (streetDist - a.distOnLine) + a.distFromEnd;
            let distB = (streetDist - b.distOnLine) + a.distFromEnd;
            if (distA < distB) return -1;
            if (distA > distB) return 1;
            return 0;
        } else if ((streetDist - a.distOnLine) === 0 && (streetDist - b.distOnLine) !== 0) { //a is off the beginning of the line, b is l/r of the line
            return -1;
        } else if ((streetDist - b.distOnLine) === 0 && (streetDist - a.distOnLine) !== 0) { //b is off the beginning of the line, a is l/r of the line
            return 1;
        } else { //both a/b are off the end of the line
            return b.distFromEnd - a.distFromEnd;
        }
    }));

    const result = {
        parityl: null,
        lstart: null,
        lend: null,
        parityr: null,
        rstart: null,
        rend: null
    };

    //Calculate number of odd/even on each side
    const parity = {
        totall: 0,
        lo: 0,
        le: 0,
        totalr: 0,
        ro: 0,
        re: 0
    }

    dist.forEach((d) => {
        //Don't count addr off the end of the line in parity as if the road bends (past the line geom)
        //the l/r calc could be incorrect
        if (d.distFromOrigin !== 0 && (streetDist - d.distFromEnd) !== 0) {
            if (d.side === leftSide && d.number % 2 === 0) parity.le++;
            if (d.side === leftSide && d.number % 2 === 1) parity.lo++;
            if (d.side !== leftSide && d.number % 2 === 0) parity.re++;
            if (d.side !== leftSide && d.number % 2 === 1) parity.ro++;
        }
    });

    parity.totall = parity.lo + parity.le;
    parity.totalr = parity.ro + parity.re;

    //Calculate Start L/R Address
    for (let dist_it = 0; dist_it < distStart.length; dist_it++) {
        if (distStart[dist_it].distOnLine !== 0 && !result.lstart && distStart[dist_it].side === leftSide) {
           result.lstart = distStart[dist_it];
        } else if (distStart[dist_it].distOnLine !== 0 && !result.rstart && distStart[dist_it].side !== leftSide) {
            result.rstart = distStart[dist_it];
        } else {
            if (!result.lstart) {
                if (parity.lo > parity.le && distStart[dist_it].number % 2 == 1) {
                    result.lstart = distStart[dist_it];
                } else if (parity.le > parity.lo && distStart[dist_it].number % 2 == 0) {
                    result.lstart = distStart[dist_it];
                }
            }
            if (!result.rstart) {
                if (parity.ro > parity.re && distStart[dist_it].number % 2 == 1) {
                    result.rstart = distStart[dist_it];
                } else if (parity.re > parity.ro && distStart[dist_it].number % 2 == 0) {
                    result.rstart = distStart[dist_it];
                }
            }
        }
    }

    //Calculate End L/R Address
    for (let dist_it = 0; dist_it < distEnd.length; dist_it++) {
        if (distEnd[dist_it].distOnLine - streetDist !== 0 && !result.lend && distEnd[dist_it].side === leftSide) {
            result.lend = distEnd[dist_it];
        } else if (distEnd[dist_it].distOnLine - streetDist !== 0 && !result.rend && distEnd[dist_it].side !== leftSide) {
            result.rend = distEnd[dist_it];
        } else {
            if (!result.lend) {
                if (parity.lo > parity.le && distEnd[dist_it].number % 2 == 1) {
                    result.lend = distEnd[dist_it];
                } else if (parity.le > parity.lo && distEnd[dist_it].number % 2 == 0) {
                    result.lend = distEnd[dist_it];
                }
            }
            if (!result.rend) {
                if (parity.ro > parity.re && distEnd[dist_it].number % 2 == 1) {
                    result.rend = distEnd[dist_it];
                } else if (parity.re > parity.ro && distEnd[dist_it].number % 2 == 0) {
                    result.rend = distEnd[dist_it];
                }
            }
        }
    }

    let lparity, rparity;

    if (!result.rstart && result.rend) result.rstart = result.rend;
    if (!result.rend && result.rstart) result.rend = result.rstart;
    if (!result.lstart && result.lend) result.lstart = result.lend;
    if (!result.lend && result.lstart) result.lend = result.lstart;

    //Assign debug properties
    if (result.rstart) {
        result.rstart.geometry.properties.start = true;
        result.rstart.geometry.properties.right = true;
    }
    if (result.lstart) {
        result.lstart.geometry.properties.start = true;
        result.lstart.geometry.properties.left = true;
    }
    if (result.rend) {
        result.rend.geometry.properties.end = true;
        result.rend.geometry.properties.right = true;
    }
    if (result.lend) {
        result.lend.geometry.properties.end = true;
        result.lend.geometry.properties.left = true;
    }

    //Sometimes the calculated start/end point isn't the same as the calculated parity
    //In these cases +1 the number to match parity
    if (result.rstart && result.rend) {
        if (parity.ro / parity.totalr > 0.70) rparity = 'O';
        if (parity.re / parity.totalr > 0.70) rparity = 'E';

        //At lease some parity is needed to make this work
        if (!rparity) {
            if (result.rstart.number % 2 === 0 && result.rend.number % 2 === 0) {
                rparity = 'E';
            } else if (result.rstart.number % 2 === 1 && result.rend.number % 2 === 1) {
                rparity = 'O';
            } else { //This is completely arbitrary - in the US odd are usually left/even right
                rparity = 'E';
            }
        }

        if (rparity === 'E') {
            if (result.rstart.number % 2 !== 0) {
                result.rstart.number++;
            }
            if (result.rend.number % 2 !== 0) {
                result.rend.number++;
            }
        } else {
            if (result.rstart.number % 2 !== 1) result.rstart.number++;
            if (result.rend.number % 2 !== 1) result.rend.number++;
        }
    }

    //Sometimes the calculated start/end point isn't the same as the calculated parity
    //In these cases +1 the number to match parity
    if (result.lstart && result.lend) {
        if (parity.lo / parity.totall > 0.70) lparity = 'O';
        if (parity.le / parity.totall > 0.70) lparity = 'E';

        if (!lparity) {
            if (result.lstart && result.lend && result.lstart.number % 2 === 0 && result.lend.number % 2 === 0) {
                lparity = 'E';
            } else if (result.rstart && result.rend && result.rstart.number % 2 === 1 && result.rend.number % 2 === 1) {
                lparity = 'O';
            } else {
                lparity = 'O';
            }
        }

        if (lparity === 'E') {
            if (result.lstart && result.lstart.number % 2 !== 0) result.lstart.number++;
            if (result.lend && result.lend.number % 2 !== 0) result.lend.number++;
        } else {
            if (result.lstart && result.lstart.number % 2 !== 1) result.lstart.number++;
            if (result.lend && result.lend.number % 2 !== 1) result.lend.number++;
        }
    }

    let tiles = [];
    tiles = cover.tiles(street.geometry, {min_zoom: 14, max_zoom: 14});

    let centre = turf.pointOnSurface(street.geometry);

    //Total hack - MultiLineStrings shouldn't exist here - or at the very least should be labelled as such
    if (!centre && street.geometry.coordinates.length === 2) {
        street.geometry.type = 'MultiLineString';
        tiles = cover.tiles(street.geometry, {min_zoom: 14, max_zoom: 14});
        centre = turf.pointOnSurface(street.geometry);
    }

    if (!centre || !verifyCenter(centre.geometry.coordinates, tiles)) {
        tmptiles = cover.tiles(street.geometry, {min_zoom: 14, max_zoom: 14}); //14 is the max resolution for carmen
        let bbox = tilebelt.tileToBBOX(tmptiles[0]);
        centre = [ (bbox[2] + bbox[0]) / 2, (bbox[3] + bbox[1]) / 2 ];
    } else {
        centre = centre.geometry.coordinates;
    }

    let text = street.properties['carmen:text'] ? street.properties['carmen:text']: street.properties.street;
    text = text.replace(/,/g, ' ');
    if (street.properties.alternates && street.properties.alternates.length > 0) {
        text = text + ',' + street.properties.alternates.join(',');
    }

    street.properties = {
        'carmen:text': text,
        'carmen:parityl': lparity,
        'carmen:lfromhn': result.lstart ? result.lstart.number : null,
        'carmen:ltohn':   result.lend ? result.lend.number : null,
        'carmen:parityr': rparity,
        'carmen:rfromhn': result.rstart ? result.rstart.number : null,
        'carmen:rtohn':   result.rend ? result.rend.number : null,
        'carmen:center': centre,
        'carmen:rangetype': 'tiger'
    }

    if (argv.debug) {
        let debug = {
            type: 'FeatureCollection',
            features: []
        };
       
        ['lstart', 'lend', 'rstart', 'rend'].forEach((prop) => {
            if (result[prop]) debug.features.push(result[prop].geometry);
        });

        if (debug.features.length) street.debug = debug;
    }

    return street;
}

//Left Side binary - Returns 1 or 0 for which is the left side
function LSB(start, end) {
    return sign(det2D(
        start,
        end,
        turf.destination(
            turf.center(turf.lineString([start, end])),
            0.01,
            turf.bearing(turf.point(start), turf.point(end)) - 90,
            'miles').geometry.coordinates
        ));
}


//Given a line and a point, find the start/end coords for the given segment
function segment(line, dist, units) {
    let coords = line.geometry.coordinates;

    let travelled = 0;
    for (let i = 0; i < coords.length; i++) {
        if (dist >= travelled && i === coords.length - 1) {
            break;
        } else if (travelled >= dist) {
            if (i === 0) return [coords[0], coords[1]];
            else return [coords[i-1], coords[i]];
        } else {
            travelled += turf.distance(turf.point(coords[i]), turf.point(coords[i+1]), units);
        }
    }
    //Last segment
    return [coords[coords.length - 2], coords[coords.length - 1]];
};

function verifyCenter(center, tiles) {
    let found = false;
    let i = 0;
    while (!found && i < tiles.length) {
        let bbox = tilebelt.tileToBBOX(tiles[i]);
        if (center[0] >= bbox[0] && center[0] <= bbox[2] && center[1] >= bbox[1] && center[1] <= bbox[3]) {
            found = true;
        }
        i++;
    }
    return found;
}

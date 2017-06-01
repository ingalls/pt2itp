module.exports = split;

const interpolize = require('./interpolize');
const explode = require('./explode');
const diacritics = require('diacritics').remove;

const turf = require('@turf/turf');

function split(argv, id, pool, output, feat, cb) {
    pool.query(`
        SELECT
            network_cluster.text                AS ntext,
            network_cluster._text               AS n_text,
            address_cluster._text               AS a_text,
            ST_AsGeoJSON(network_cluster.geom)  AS network,
            ST_AsGeoJSON(address_cluster.geom)  AS address
        FROM
            network_cluster,
            address_cluster
        WHERE
            network_cluster.id = ${id} AND
            network_cluster.address = address_cluster.id
    `, (err, res) => {
        if (err) return cb(err);

        res = res.rows[0];

        res.number = [];

        res.address = JSON.parse(res.address);
        res.address.coordinates.map((coord) => {
            res.number.push(feat.unitDecode(coord).pop());
            return coord;
        });

        let network = JSON.parse(res.network);

        let text = res.a_text;
        if (diacritics(text) !== diacritics(res.n_text)) text = text + ',' + res.n_text;

        let featPair = {
            text: res.ntext,
            _text: text,
            number: res.number,
            network: network,
            address: res.address
        }

        featPair.network = explode({
            type: 'FeatureCollection',
            features: [ turf.feature(featPair.network) ]
        });

        let cluster = [];
        let addressCluster = [];

        for (let pt_it = 0; pt_it < featPair.address.coordinates.length; pt_it++) {
            let pt = turf.point(featPair.address.coordinates[pt_it]);

            let currentMatch = {
                dist: Infinity,
                ln: false
            };

            for (let ln_it = 0; ln_it < featPair.network.features.length; ln_it++) {
                let ln = featPair.network.features[ln_it].geometry;

                let dist = turf.distance(turf.pointOnLine(ln, pt), pt);

                if (dist < currentMatch.dist) {
                    currentMatch = { dist: dist, ln: ln_it, num: featPair.number[pt_it] };
                }
            }

            if (!cluster[currentMatch.ln]) cluster[currentMatch.ln] = [];
            if (!addressCluster[currentMatch.ln]) addressCluster[currentMatch.ln] = [];
            cluster[currentMatch.ln].push(pt.geometry.coordinates);
            addressCluster[currentMatch.ln].push(featPair.number[pt_it]);
        }

        let itpResults = [];

        for (let pt_it = 0; pt_it < cluster.length; pt_it++) {
            //If Network Doesn't have corresponding Address Cluster
            if (!cluster[pt_it]) {
                itpResults.push(feat.create({
                    text: featPair._text,
                    network: featPair.network.features[pt_it]
                }));
                continue;
            }

            let address = turf.multiPoint(cluster[pt_it], {
                numbers: addressCluster[pt_it],
                text: featPair.text,
                'carmen:text': featPair._text
            });

            let street = turf.feature(featPair.network.features[pt_it].geometry, {
                text: featPair.text,
                'carmen:text': featPair._text
            });

            result = interpolize(street, address, { debug: argv.debug });

            itpResults.push({
                id: parseInt(new Date() / 1 + '' + Math.floor(Math.random() * 100)),
                type: 'Feature',
                debug: result.debug,
                properties: {
                    'carmen:text': featPair._text,
                    'carmen:addressnumber': [ null, address.properties.numbers ],
                    'carmen:parityl': [ result.properties['carmen:parityl'], null ],
                    'carmen:lfromhn': [ result.properties['carmen:lfromhn'], null ],
                    'carmen:ltohn':   [ result.properties['carmen:ltohn'], null ],
                    'carmen:parityr': [ result.properties['carmen:parityr'], null ],
                    'carmen:rfromhn': [ result.properties['carmen:rfromhn'], null ],
                    'carmen:rtohn':   [ result.properties['carmen:rtohn'], null ],
                    'carmen:center': turf.pointOnSurface(featPair.network.features[pt_it].geometry).geometry.coordinates,
                    'carmen:rangetype': 'tiger',
                    'carmen:geocoder_stack': argv.country ? argv.country : false
                },
                geometry: {
                    type: 'GeometryCollection',
                    geometries: [
                        featPair.network.features[pt_it].geometry,
                        { type: 'MultiPoint', coordinates: address.geometry.coordinates }
                    ]
                }
            });
        }

        //Iterate through each result and check for duplicate address pts
        for (let itp_it = 0; itp_it < itpResults.length; itp_it++) {
            let itp = itpResults[itp_it];
            if (!itp) continue;

            itp.geometry.geometries[0] = {
                type: 'MultiLineString',
                coordinates: [ itp.geometry.geometries[0].coordinates ]
            };

            itp.debug = [ itp.debug ];

            ['carmen:parityl', 'carmen:lfromhn', 'carmen:ltohn', 'carmen:parityr', 'carmen:rfromhn', 'carmen:rtohn'].forEach((prop) => {
                itp.properties[prop][0] = [ itp.properties[prop][0] ];
            });

            for (let compare_it = 0; compare_it < itpResults.length; compare_it++) {
                let comp = itpResults[compare_it];
                if (!comp || itp_it == compare_it) continue;

                //No addressnumber so add to collection
                if (!comp.geometry.geometries[1] || !itp.geometry.geometries[1]) {
                    mergeFeat();
                    continue;
                }

                //Iterate through each AddressNumber and ensure there aren't dups
                let dup = false;
                for (addr of comp.properties['carmen:addressnumber']) {
                    if (itp.properties['carmen:addressnumber'][1].indexOf(addr) !== -1) {
                        dup = true;
                        break;
                    }
                }

                if (!dup) {
                    mergeFeat();
                    continue;
                }


                function mergeFeat() {
                    itp.geometry.geometries[0].coordinates.push(comp.geometry.geometries[0].coordinates);
                    ['carmen:parityl', 'carmen:lfromhn', 'carmen:ltohn', 'carmen:parityr', 'carmen:rfromhn', 'carmen:rtohn'].forEach((prop) => {
                        itp.properties[prop][0].push(comp.properties[prop][0]);
                    });

                    itp.debug.push(comp.debug);

                    if (comp.geometry.geometries[1]) {
                        if (!itp.geometry.geometries[1]) {
                            itp.geometry.geometries[1] = {
                                type: 'MultiPoint',
                                coordinates: []
                            }
                            
                            itp.properties['carmen:addressnumber'][1] = [];
                        }

                        itp.properties['carmen:addressnumber'][1] = itp.properties['carmen:addressnumber'][1].concat(comp.properties['carmen:addressnumber'][1]);

                        itp.geometry.geometries[1].coordinates = itp.geometry.geometries[1].coordinates.concat(comp.geometry.geometries[1].coordinates);
                    }
                    itpResults[compare_it] = false;
                }
            }
        }

        for (potential of itpResults) {
            if (!potential) continue;

            if (!argv.debug) delete potential.debug;
            output.write(JSON.stringify(potential) + '\n');
        }

        return cb();
    });
}

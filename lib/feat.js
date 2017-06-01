const turf = require('@turf/turf');

class Feat {
    constructor(opts = {}) {
        this.units = opts.units ? opts.units : {};
        this.country = opts.country;
    }

    create(data) {
        if (!data.text) throw new Error('Every feature must have text property');
        if (!data.addr && !data.network) throw new Error('Every feature must have addr or network or both');

        let feat = {
            id: parseInt(new Date() / 1 + '' + Math.floor(Math.random() * 100)),
            type: 'Feature',
            properties: {
                'carmen:text': data._text,
                'carmen:center': null,
                'carmen:rangetype': 'tiger',
                'carmen:addressnumber': [],
                'carmen:parityl': [],
                'carmen:lfromhn': [],
                'carmen:ltohn':   [],
                'carmen:parityr': [],
                'carmen:rfromhn': [],
                'carmen:rtohn':   [],
                'carmen:geocoder_stack': this.country
            },
            geometry: {
                type: 'GeometryCollection',
                geometries: []
            }
        };

        //Debug mode assumes network always comes first in GeomCollection
        if (data.network) {
            feat.properties['carmen:center'] = turf.pointOnSurface(data.network).geometry.coordinates;
            feat.properties['carmen:rangetype'] = 'tiger';

            ['parityl', 'lfromhn', 'ltohn', 'parityr', 'rfromhn', 'rtohn'].forEach((prop) => {
                feat.properties[`carmen:${prop}`].push(data.network[`carmen:${prop}`]);
            });

            feat.geometry.geometries.push(data.network.geometry);
        }

        if (data.addr) {
            if (!feat.properties['carmen:center']) turf.pointOnSurface(data.network).geometry.coordinates;

            ['parityl', 'lfromhn', 'ltohn', 'parityr', 'rfromhn', 'rtohn'].forEach((prop) => {
                feat.properties[`carmen:${prop}`].push(null)
            });

            let num_it = feat.geometry.geometries.push({
                type: 'MultiPoint',
                coordinates: []
            }) - 1;

            if (!data.numbers) {
                feat.properties['carmen:addressnumber'].push([]);

                //coord is [ X, Y, ADDR ]
                for (let coord of data.addr.coordinates) {
                    if (coord.length === 3) feat.properties['carmen:addressnumber'][num_it].push(unitDecode(coord).pop());
                    feat.geometry.geometries[num_it].coordinates.push(coord);
                }
            } else {
                feat.properties['carmen:addressnumber'].push(data.numbers);
                feat.geometry.geometries[num_it].coordiantes = data.addr.coordinates;
            }
        }

        return feat;
    }

    unitDecode(coord) {
        if (coord[2] && coord[2] % 1 != 0) {
            let unit = parseInt(String(coord[2]).split('.')[1]);
            let num = String(coord[2]).split('.')[0];
            coord[2] = `${num}${this.units[unit]}`;
        }
        return coord;
    }
}

module.exports = Feat;

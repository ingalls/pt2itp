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
                'carmen:text': null,
                'carmen:center': null,
                'carmen:addressnumber': [],
                'carmen:geocoder_stack': this.country
            },
            geometry: {
                type: 'GeometryCollection',
                geometries: []
            }
        };


        //Debug mode assumes network always comes first in GeomCollection
        if (data.network) {

        }

        if (data.addr) {
            let num_it = feat.geometry.geometries.push({
                type: 'MultiPoint'
                coordinates: []
            }) - 1;

            feat.properties['carmen:addressnumber'].push([]);

            //coord is [ X, Y, ADDR ]
            for (let coord of data.addr.coordinates) {
                if (coord[2] % 1 != 0) {
                    let unit = parseInt(String(coord[2]).split('.')[1]);
                    let num = String(coord[2]).split('.')[0];
                    coord[2] = `${num}${argv.unitMap[unit]}`;
                }

                feat.properties['carmen:addressnumber'][num_it].push(coord.pop());
                feat.geometry.geometries[num_it].coordinates.push(coord);
            }
        }

        return feat;
    }
}

module.exports = Feat;

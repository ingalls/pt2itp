/**
 * Add cardinality Permutations to a given output
 *
 * W Main St => W Main St,Main St W,Main St
 *
 * @param {Object} feat     GeoJSON feature to convert/filter
 * @return {Object}         Output GeoJSON feature to write to output
 */
function post(feat) {
    if (!feat || !feat.properties || !feat.properties['carmen:text']) return feat;

    let texts = feat.properties['carmen:text'].split(',');

    if (texts.length >= 10) return feat;

    let postRegex = /\s(south|s|north|n|east|e|west|w|southeast|se|southwest|sw|northeast|ne|northwest|nw)$/i;
    let preRegex = /^(south|s|north|n|east|e|west|w|southeast|se|southwest|sw|northeast|ne|northwest|nw)\s/i;

    for (let t of texts) {
        if (t.match(postRegex) && t.match(preRegex)) {
            // S Main NW

            continue;
        } else if (t.match(postRegex)) {
            //Main W => W Main,Main

            let cardinal = t.match(postRegex);
            let name = t.replace(postRegex, '');
            let syn = `${cardinal[0]} ${name}`.trim();

            if (texts.indexOf(syn) === -1) texts.push(syn);
            if (texts.indexOf(name) === -1) texts.push(name);
        } else if (t.match(preRegex)) {
            //W Main => Main W,Main

            let cardinal = t.match(preRegex);
            let name = t.replace(preRegex, '');
            let syn = `${name} ${cardinal[0]}`.trim();

            if (texts.indexOf(syn) === -1) texts.push(syn);
            if (texts.indexOf(name) === -1) texts.push(name);
        }
    }

    if (texts.length > 10) texts = texts.splice(0, 10);
    feat.properties['carmen:text'] = texts.join(',');

    return feat;
}

module.exports.post = post;

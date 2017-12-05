const dist = require('fast-levenshtein').get;
const diacritics = require('diacritics').remove

/**
 * Generates a map of street => address based on text values - geometric proximity must be determined by parent
 * @param {Object} addr Object containing information about the address
 * @param {Array} nets Array of street features to compare against address
 * @return {false|Array} Return false if no match could be found or array of potential matches
 */
function linker(addr, nets, returnAll) {
    let maxScore = false;
    returnAll = !!returnAll;

    //Ensure exact matches are always returned before potential short-circuits
    eqNets = nets.filter((n) => { return n.text === addr.text; });
    if (eqNets.length) return eqNets;

    //Handle Numered Streets (ie: 11th should never match 12th)
    addr.isNumbered = isNumbered(addr.text);

    for (let net_it = 0; net_it < nets.length; net_it++) {
        let net = nets[net_it];

        // don't bother considering if the tokenless forms don't share a starting letter
        // this might require adjustment for countries with addresses that have leading tokens which aren't properly stripped
        // from the token list
        if (net.text_tokenless && addr.text_tokenless && (net.text_tokenless[0] !== addr.text_tokenless[0])) continue;

        let netNumber = isNumbered(net.text);
        //Dont bother considering if both addr and network are a numbered street that don't match (1st != 11th)
        if (addr.isNumbered && addr.isNumbered !== netNumber) continue;

        // use a weighted average w/ the tokenless dist score if possible
        let levScore;

        if (addr.text_tokenless && net.text_tokenless) {
            levScore = (0.25 * dist(addr.text, net.text)) + (0.75 * dist(addr.text_tokenless, net.text_tokenless));
        } else {
            // text_tokenless is unavailable for one or more of the features, but text is nonempty (it is not an unnamed road).
            // this can be due to an edge case like 'Avenue Street' in which all words are tokens.
            // in this case, short-circuit if one string is fully contained within another.
            if (net._text && addr._text) {
                let shorter, longer;
                if (addr._text.length > net._text.length) {
                    longer = diacritics(addr._text).toLowerCase();
                    shorter = diacritics(net._text).toLowerCase();
                } else {
                    shorter = diacritics(addr._text).toLowerCase();
                    longer = diacritics(net._text).toLowerCase();
                }

                if (longer.indexOf(shorter) !== -1) {
                    return nets.filter((n) => { return n._text === net._text; });
                }
            }

            if (!addr.text || !addr.text.length || !net.text || !net.text.length) continue;

            levScore = dist(addr.text, net.text);
        }

        //Calculate % Match
        let score = 100 - (((2 * levScore) / (net.text.length + addr.text.length)) * 100);

        nets[net_it].score = score;

        if (!maxScore || (score > maxScore)) maxScore = score;
    }

    // score must be > 70% for us to return any matches
    let qualifyingNets = returnAll ? nets.slice(0) : nets.filter((n) => { return n.score === maxScore; });

    if ((qualifyingNets.length > 0) && (maxScore > 70)) {
        return qualifyingNets;
    } else {
        return false;
    }
}

/**
 * Is the street a numered type street ie: 1st 2nd 3rd etc
 * @param {string} text Text to test against
 * @return {boolean|string}
 */
function isNumbered(text) {
    let toks = text.split(' ');

    let tests = [
        /^(([0-9]+)?1st)$/,
        /^(([0-9]+)?2nd)$/,
        /^(([0-9]+)?3rd)$/,
        /^([0-9]+th)$/,
    ]

    for (let tok of toks) {
        for (let t of tests) {
            let m = tok.match(t);
            if (m) return m[0]
        }
    }

    return false;
}

module.exports = linker;
module.exports.isNumbered = isNumbered;

const dist = require('fast-levenshtein').get;

/**
 * Generates a map of street => address
 */
module.exports = (street, addresses) => {
    let current;

    for (let addr_it = 0; addr_it < addresses.length; addr_it++) {
        let address = addresses[addr_it];

        //Short Circuit if the text is exactly the same
        if (address.text === street.text) return address;

        let levScore = dist(street.text, address.text);

        //Calculate % Match
        let score = 100 - (((2 * levScore) / (address.text.length + street.text.length)) * 100)

        if (!current || current.score < score) {
            current = {
                score: score,
                address: address
            }
        }
    }

    //There is a potential address match and it has a lev. distance of over 40% the same
    if (current && current.address && current.score > 40)  return current.address;
    return false;
}

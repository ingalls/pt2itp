var linematch = require('linematch');

module.exports = main;

//Detects Dual Carriageways and collapses them down to a single line
function main(streets) {
    if (streets.type !== 'Feature' || !streets.geometry || streets.geometry.type !== 'MultiLineString') {
        throw new Error('Must be Feature & MultiLineString');
    }
    return streets;
}

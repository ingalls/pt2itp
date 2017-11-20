/**
 * Test if a string if fully uppercase
 * @param {string} x test input
 * @return {boolean}
 */
function isUpperCase(x) {
    return x.toUpperCase() === x;
}

/**
 * Number of times a string switches from lower to upper or upper to lower
 * @param {string} x String to test
 * @return {numeric}
 */
function numCaseChanges(x) {
    return x
        .split('')
        .filter((y) => { return /\w/.test(y); })
        .reduce((prev, cur, i, arr) => {
            if (i === 0) return 0;
            if (isUpperCase(cur) !== isUpperCase(arr[i-1]))
                return prev + 1;
            else
                return prev;
        }, 0);
}

module.exports.numCaseChanges = numCaseChanges;
module.exports.isUpperCase = isUpperCase;

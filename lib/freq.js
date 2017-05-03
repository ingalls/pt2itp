const _ = require('lodash');

/**
 * Generate frequency analysis given names of all streets from the address/network datasets
 *
 * @param {Array} feats         An array of street names ie: ['main st'], ['fake rd']
 * @return {Object}             An object containing frequency analysis/min/max values of each dataset
 */
module.exports = function(feats) {
    let nameFreq = {
        '_min': 1,
        '_max': 1
    };

    for (let feat_it = 0; feat_it < feats.length; feat_it++) {
        feats[feat_it] = feats[feat_it].split(' ');

        for (let token_it = 0; token_it < feats[feat_it].length; token_it++) {
            let token = feats[feat_it][token_it];
            if (nameFreq[token]) {
                nameFreq[token]++;
                if (nameFreq[token] > nameFreq._max) {
                    nameFreq._max++;
                }
            } else {
                nameFreq[token] = 1;
            }
        }
    }

    //Maps each token count to ( ${Max Tokens} / ${Token Count} )
    let freq_keys = _.difference(Object.keys(nameFreq), ['_min', '_max']);
    for (let freq_it = 0; freq_it < freq_keys.length; freq_it++) {
        nameFreq[freq_keys[freq_it]] = nameFreq._max / nameFreq[freq_keys[freq_it]];
    }

    return nameFreq;
}

module.exports = main;

const _ = require('lodash');

/**
 * tokenize - Acceps a query string and returns a tokenized array
 *
 * @param  {string} query  A string to tokenize
 * @param  {Object} replacer Replacement tokens
 * @return {Array}         A tokenized array
 */
function main(query, replacer) {
    if (!replacer) replacer = {};

    let normalized = query
        .toLowerCase()
        .replace(/[\^]+/g, '')
        // collapse apostraphes, periods
        .replace(/['\.]/g, '')
        // all other ascii and unicode punctuation except '-' per
        // http://stackoverflow.com/questions/4328500 split terms
        .replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#\$%&\(\)\*\+,\.\/:;<=>\?@\[\]\^_`\{\|\}~]/gi, ' ')
        .split(/[\s+]+/gi);

    let pretokens = [];

    for (let i=0;i<normalized.length;i++) {
        if (/(\d+)-(\d+)[a-z]?/.test(normalized[i])) {
            pretokens.push(normalized[i]);
        } else {
            let splitPhrase = normalized[i].split('-');
            pretokens = pretokens.concat(splitPhrase);
        }
    }

    let tokens = [];

    for (let i = 0; i < pretokens.length; i++) {
        if (pretokens[i].length) {
            tokens.push(pretokens[i]);
        }
    }

    for (let i = 0; i < tokens.length; i++) {
        if (replacer[tokens[i]]) {
            tokens[i] = replacer[tokens[i]];
        }
    }

    return tokens;
}

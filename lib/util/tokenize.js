const tokens = require('@mapbox/geocoder-abbreviations')
const diacritics = require('diacritics').remove;

module.exports = {};
module.exports.main = main;
module.exports.createGlobalReplacer = createGlobalReplacer;
module.exports.createReplacer = createReplacer;
module.exports.getTokens = getTokens;
module.exports.replaceToken = replaceToken;

const _ = require('lodash');

/**
 * main - Acceps a query string and returns a tokenized array
 *
 * @param  {string} query       A string to tokenize
 * @param  {Object} replacer    Replacement tokens
 * @param  {boolean} complex    Generate tokens & tokenless strings
 * @return {Array}              A tokenized array
 */
function main(query, replacer, complex) {
    if (!replacer) replacer = {};

    if (typeof replacer !== 'object') throw new Error('Replacer must be a hashmap');

    complex = !!complex;

    let normalized = diacritics(query)
        .toLowerCase()
        .replace(/[\^]+/g, '')
        // collapse apostraphes, periods
        .replace(/[\u2018\u2019\u02BC\u02BB\uFF07'\.]/g, '')
        // all other ascii and unicode punctuation except '-' per
        // http://stackoverflow.com/questions/4328500 split terms
        .replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#\$%&\(\)\*\+,\.\/:;<=>\?@\[\]\^_`\{\|\}~]/gi, ' ')
        .split(/[\s+]+/gi);

    let pretokens = [];

    for (let i = 0; i < normalized.length; i++) {
        if (/(\d+)-(\d+)[a-z]?/.test(normalized[i])) {
            pretokens.push(normalized[i]);
        } else {
            let splitPhrase = normalized[i].split('-');
            pretokens = pretokens.concat(splitPhrase);
        }
    }

    let tokens = pretokens.filter(token => {
        if (token.length) return token;
    });

    let tokenless = [];

    for (let i = 0; i < tokens.length; i++) {
        //Handle Simple Token Replace street/st
        if (replacer[tokens[i]]) {
            tokens[i] = replacer[tokens[i]];
        } else {
            //Iterate And Test Complex
            for (let key of Object.keys(replacer)) {
                let reg_token;
                try {
                    reg_token = RegExp('^'+key+'$');
                } catch (err) {
                    //There are several regex patterns that use the alternate regex engine in carmen
                    //Goal is to eventually unify this API with carmen to support all tokens carmen does
                }
                if (tokens[i].match(reg_token)) {
                    tokens[i] = tokens[i].replace(reg_token, replacer[key]);
                }
            }

            tokenless.push(tokens[i]);
        }
    }

    if (complex) {
        return {
            tokens: tokens,
            tokenless: tokenless
        };
    } else {
        return tokens;
    }
}

/**
 * replaceToken - Accepts a query string and returns a tokenized text
 *
 * @param  {Array} tokens   An Array of tokens to attempt to apply to query
 * @param  {string} query   A string to tokenize
 * @return {string}         A tokenized String
 */
function replaceToken(tokens, query) {
    let abbr = query;
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].named)
            abbr = XRegExp.replace(abbr, tokens[i].from, tokens[i].to);
        else
            abbr = abbr.replace(tokens[i].from, tokens[i].to);
    }
    return abbr;
}

/**
 * createGlobalReplacer - Accepts regexs and returns an array of RegExp objects
 *
 * @param  {Object} tokens
 * @return {Array}  An array of RegExp Objects
 */
function createGlobalReplacer(tokens) {
    const replacers = [];
    for (let token in tokens) {
        let from = token;
        let to = tokens[token];
        let entry = {
            named: false,
            from: new RegExp(from, 'gi'),
            to: to
        };
        replacers.push(entry);
    }
    return replacers;
}

/**
 * Accept Array of arrays of equivalent tokens and output replacement arrays
 * @param {Array} languages
 * @return {Object}
 */
function getTokens(languages) {
    let parsed = [];
    for (token of languages) {
        parsed = parsed.concat(tokens(token, true)); // pull singletons in, too -- ie tokens that are common but have no abbreviation
    }

    return parsed;
}

/**
 * Accept Array of arrays of equivalent tokens and output Regex Replacer object
 * @param {Array} languages
 * @return {Object}
 */
function createReplacer(languages) {
    let parsed = getTokens(languages);

    let parsedTokens = {};
    for (let parse of parsed) {
        parse = parse.sort((a, b) => {
            return a.length > b.length
        }).filter((p) => {
            if (typeof p === 'string') return true;
        });

        if (parse.length === 1) continue;

        // we intentionally mark the smallest token as a replacement for itself
        // this seems silly but it lets us exclude it from text_tokenless in cases where it's pre-abbreviated
        for (let parsedFrom of parse) {
            parsedTokens[diacritics(parsedFrom.toLowerCase())] = diacritics(parse[0].toLowerCase());
        }
    }

    return parsedTokens;
}

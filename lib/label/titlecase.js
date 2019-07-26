'use strict';

const _ = require('lodash');

module.exports = () => {
    return (texts) => {
        texts = texts.map((text) => {
            text.internal_tokenized_string = text.tokenized.map((x) => x.token).join(' ');
            if (text.priority === 0 || !text.priority) {
                // Assign the highest freq value to all names with identical internal_tokenized_string values
                // @TODO don't do this in a nested loop, can you avoid all together if you sort differently?
                for (const tmatch of texts) {
                    const tmatch_tokenized = tmatch.tokenized.map((x) => x.token).join(' ');
                    if (text.internal_tokenized_string === tmatch_tokenized && text.freq < tmatch.freq) {
                        text.freq = tmatch.freq;
                    }
                }
            }

            return text;
        });

        texts = _.uniqBy(texts, (name) => {
            // Remove duplicate display fields
            // @TODO do this in native/types/name.rs, this misses a lot of
            // duplicates because display names haven't yet been normalized
            return name.display;
        }).map((name) => {
            // Add character length for next deduping operation
            name.display_length = name.display.length;
            return name;
        });

        texts = _.orderBy(texts, ['priority', 'internal_tokenized_string', 'display_length'], ['desc', 'asc', 'desc']);
        // This misses duplicate internal_tokenized_string values if their
        // untitlecased display names are not identical and they have different
        // priority values
        texts = _.sortedUniqBy(texts, 'internal_tokenized_string');
        texts = _.orderBy(texts, ['priority', 'freq', 'display_length'], ['desc', 'desc', 'desc']);
        return texts.map((name) => {
            delete name.internal_tokenized_string;
            return name;
        });
        // .reduce((acc, name) => {
        //     if (!acc) return name.display;
        //     return `${acc},${name.display}`;
        // }, '');
    };
};

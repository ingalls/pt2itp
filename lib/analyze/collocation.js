'use strict';

const ngrams = require('talisman/tokenizers/ngrams');

const SMALL = 1e-20;

/**
 * FrequencyDistribution
 */
class FrequencyDistribution {

    /**
     * constructor
     *
     * @param {(Array|Map)} initial_data - used to populate frequencies on initialization
     */
    constructor(initial_data) {
        this.frequencies = new Map();
        if (initial_data) {
            this.update(initial_data);
        }
        this._N = null;
    }

    /**
     * Utility function for reliably making string hashes of non-string keys.
     * Necessary because this.frequencies is a Map, and requires strict
     * equality for matches. The easiest way to do this is to use strings for
     * keys. Currently only hashes arrays.
     *
     * @param {(string|number|Object|Array)} k - intuitive key. objects will be stringified using JSON.stringify
     * @returns {string} hash of the intuitive key, suitable for querying this.frequencies (which is a Map)
     */
    makeKey(k) {
        let key = k;
        if (Array.isArray(k)) {
            key = k.join('|');
        }

        if (typeof(key) == 'string') {
            return key;
        } else {
            return JSON.stringify(key);
        }
    }

    /**
     * Inverse of {@link FrequencyDistribution#makeKey}. Converts Map-suitable
     * string hashes to back to intuitive keys.
     *
     * @param {string} key - hash of the intuitive key, suitable for querying this.frequencies (which is a Map)
     * @returns {(string|number|Object|Array<string>)} intuitive key
     */
    unmakeKey(key) {
        try {
            // stringified objects, numbers should parse fine
            return JSON.parse(key);
        } catch (e) {
            if (e instanceof SyntaxError) {
                // if key didn't parse, it probably came in as a string
                if (key.indexOf('|') >= 0) {
                    // if it has a pipe, assume it should be an array
                    return key.split('|');
                } else {
                    // otherwise just return
                    return key;
                }
            } else {
                throw e;
            }
        }
    }

    /**
     * Interface to this.frequencies.entries which unhashes Map keys
     * using {@link FrequencyDistribution#unmakeKey}
     *
     * @returns {Array<Array>} an array of [key, value] pairs
     */
    *entries() {
        for (const [key, frequency] of this.frequencies.entries()) {
            yield([this.unmakeKey(key), frequency]);
        }
    }

    /**
     * Interface to this.frequencies.keys which unhashes Map keys
     * using {@link FrequencyDistribution#unmakeKey}
     *
     * @returns {Array<string>} array of keys
     */
    *keys() {
        for (const [key] of this.frequencies.entries()) {
            yield this.unmakeKey(key);
        }
    }

    /**
     * Utility to aggregate an array of samples into a Map of sample counts.
     * Converts samples to Map-friendly keys with {@link FrequencyDistribution#makeKey}
     *
     * @param {Array<string>|Array<Array<string>>} sample_array - An array of samples to be counted
     * @returns {Map<string, number>} aggregated counts of samples
     */
    arrayToCounts(sample_array) {
        const counts = new Map();
        for (let i = 0; i < sample_array.length; i++) {
            const sample = sample_array[i];
            if (!counts.has(this.makeKey(sample))) {
                counts.set(this.makeKey(sample), 0);
            }
            const current_count = counts.get(this.makeKey(sample));
            counts.set(this.makeKey(sample), current_count + 1);
        }
        return counts;
    }

    /**
     * Interface to this.frequencies.has which hashes intuitive keys
     * to Map-friendly strings using {@link FrequencyDistribution#makeKey}
     *
     * @param {string|Array<string>} k - Intuitive key
     * @returns {boolean} true iff the frequency distribution contains this key
     */
    has(k) {
        return this.frequencies.has(this.makeKey(k));
    }

    /**
     * Interface to this.frequencies.get which hashes intuitive keys to strings
     * using {@link FrequencyDistribution#makeKey}. Should not be used directly.
     * Use {@link FrequencyDistribution#absoluteFrequency} instead.
     *
     * @param {string|Array<string>} k - Intuitive key
     * @returns {number} the absolute frequency for this key
     */
    get(k) {
        return this.frequencies.get(this.makeKey(k));
    }

    /**
     * Interface to this.frequencies.set which hashes intuitive keys to
     * Map-friendly strings using {@link FrequencyDistribution#makeKey}. Should
     * not be used directly. Use {@link FrequencyDistribution#update} instead.
     *
     * @param {(string|Array<string>)} k - Intuitive key
     * @param {number} value Frequency of k
     */
    set(k, value) {
        return this.frequencies.set(this.makeKey(k), value);
    }

    /**
     * Increment the frequency of a key by some value. Should not be used
     * directly. Use {@link FrequencyDistribution#update} instead.
     *
     * @param {(string|Array<string>)} k Intuitive key
     * @param {number} value Amount to increment frequency by
     */
    increment(k, value) {
        if (!this.has(k)) {
            this.set(k, 0);
        }
        const newCount = this.get(k) + value;
        this.set(k, newCount);
    }

    /**
     * Update the frequency distribution using either an array of samples or a
     * frequency Map. This should be used instead of using this.set or
     * this.increment directly. It also sets this._N to null, meaning this.N
     * will need to be recomputed when this.N is next called.
     *
     * @param {(Array<string>|Array<Array<string>>|Map<string|number>)} data - An array of samples or a map from sample keys to frequencies.
     */
    update(data) {
        this._N = null;

        let counts;

        if (Array.isArray(data)) {
            counts = this.arrayToCounts(data);
        }
        else {
            counts = data;
        }

        for (const [k, value] of counts.entries()) {
            this.increment(k, value);
        }
    }

    /**
     * Gives the absolute frequency of an (intuitive) key. If the key is not
     * in this.frequencies, returns 0
     *
     * @param {(string|Array<string>)} k - An intuitive key
     * @returns {number} The absolute frequency of k, or 0 if k is not in the distribution.
     */
    absoluteFrequency(k) {
        if (!this.has(k)) {
            return 0;
        }
        else {
            return this.get(k);
        }
    }

    /**
     * Gives the relative frequency of an (intuitive) key. Relative frequency
     * of k is calculated as:
     *
     *      frequency_of_k / sum(all_frequencies)
     *
     * If the key is not in this.frequencies, returns 0.
     *
     * @param {(string|Array<string>)} k - An intuitive key
     * @returns {number} The absolute frequency of k, or 0 if k is not in the distribution.
     */
    relativeFrequency(k) {
        return this.absoluteFrequency(k) / this.n();
    }

    /**
     * Gives N, which is the sum of all frequencies in the distribution. The
     * property this._N is used to cache this number so that the sum need not
     * be computed each time. Whenever update is called, this._N is set to null
     * (and the sum must be recomputed)
     *
     * @returns {number} the sum of all frequency counts in the distribution
     */
    n() {
        if (!this._N) {
            let accumulator = 0;
            for (const value of this.frequencies.values()) {
                accumulator += value;
            }
            this._N = accumulator;
        }
        return this._N;
    }

    /**
     * Gives the bin count (sometimes called B) of the distribution. The bin
     * count is just the number of things that were counted, and corresponds to
     * the number of keys in this.frequencies. Can also be thought of as the
     * count of unique samples recorded.
     *
     * @returns {number} the number of bins in the distribution
     */
    binCount() {
        return this.frequencies.size;
    }

}

/**
 * Base class for collocation tables. Not to be used directly. Use one of the
 * extensions below.
 *
 * @see BiGramCollocationTable
 * @see TriGramCollocationTable
 */
class NGramCollocationTable {

    /**
     * constructor
     *
     */
    constructor() {
        this.unigram_fd = new FrequencyDistribution();
        this.order = 1;
    }

    /**
     * Update collocation tables using an array of words. The array is broken
     * into n-grams and the counts of those n-grams are added to each frequency
     * distribution.
     *
     * @param {Array<string>} words - An array of words.
     */
    update(words) {
        this.unigram_fd.update(ngrams(1, words));
    }

    /**
     * Merge another NGramCollocationTable into this one. Both must have the same value for `order`.
     *
     * @param {NGramCollocationTable} collocationTable - another NGramCollocation table of the same order as this
     */
    merge(collocationTable) {
        const orderCompatible = (this.order === collocationTable.order);
        if (!orderCompatible) {
            throw 'NGramCollocation tables may only merge with others of the same order';
        }
        this.unigram_fd.update(collocationTable.unigram_fd.frequencies);
    }

    /**
     * Gives the {@link http://www.statisticshowto.com/expected-frequency/|Expected Frequency}
     * values for a contingency table. Necessary for some associativity metrics.
     *
     * @param {Array<number>} contingency - An array whose values correspond to the values of a {@link http://www.statisticshowto.com/what-is-a-contingency-table/|Contingency Table}, read from left-to-right, top-to-bottom.
     * @returns {Array<number>} The expected frequencies associated with the contingency table.
     */
    getExpectedFrequencies(contingency) {
        /* left-shift 1 (binary 0001) by the integers 0 to this.order. For
         * example, in a trigram case (order 3):
         *
         *     int   left-shifted
         *       0           0001
         *       1           0010
         *       2           0100
         */
        const bits = [];
        for (let x = 0; x < this.order; x++) {
            bits.push(1 << x);
        }

        /* The contingency variable is an array that goes from top-left to
         * bottom-right of a contingency square (or cube). For bigrams (w1,w2),
         * it is a two-by-two table:
         *
         *      w1               ~w1
         *      ---------------  ----------------
         *  w2 | contingency[0] | contingency[1] |
         *      ---------------  ----------------
         * ~w2 | contingency[2] | contingency[3] |
         *      ---------------  ----------------
         *                                        TOTAL = n_all
         *
         * We want the expected frequency of each cell in that table, so we
         * need to make 4 calculations. Informally, when you want the expected
         * frequency of cell (x,y), you do:
         *
         *   expected[0] = (sum(row_x) * sum(column_y)) / (n_all)
         *
         * This is easy enough for a 2x2 square, but higher-order contingencies
         * get complicated and unintuitive pretty quickly. Trigram contingency
         * tables, for instance, are really 3x3x3 cubes, which I am not even
         * going to try to do in ASCII art.
         *
         * There's a (very unintuitive) way of doing this so that it
         * generalizes to bigger contingencies. It involves bitmasking, which
         * takes advantage of bitwise AND (& in javascript). When you AND two
         * equal-length binary representations, you get a 1 in the places where
         * both have a 1, and a zero everywhere else. For example, if you
         * calculate 5 & 3, you get 1.
         *
         *       decimal   bit
         *       -------   ------
         *       5         0101
         *       3         0011
         *  AND  ----------------
         *       1         0001
         *
         * Bitmasking helps us iterate over the contingency, summing and
         * multiplying using the appropriate cells for each expected frequency.
         * (FYI: See how bits is calculated above).
         *
         *   expected = []
         *   For each i in 0 ... length(contingency):
         *     For each j in 0 ... length(bits):
         *       For each k in (Math.pow(2, order):
         *         if (i & bit) == (k & bit):
         *            select k
         *     Sum selected cells
         *   Multiply all sums, then divide by Math.pow(n_all, order-1)
         *   Result is added to expected[i]
         *
         * For example, the first iteration (i=0) for a * bigram, where
         * bits=[1,2] and k ranges over [0,1,2,3].
         *
         *   i=0    bits[0]=1      k       i&bits[j]      k&bits[j]    select k?
         *   ---    ---------      ---     ---------      ---------    ------
         *   0000   0001           0000    0000           0000         yes
         *   0000   0001           0001    0000           0001         no
         *   0000   0001           0010    0000           0000         yes
         *   0000   0001           0011    0001           0000         no
         *
         * So the first sum is (contingency[0] + contingency[2]). Next bit:
         *
         *   i=0    bits[1]=2      k       i&bits[j]      k&bits[j]    select k?
         *   ---    ---------      ---     ---------      ---------    ------
         *   0000   0010           0000    0000           0000         yes
         *   0000   0010           0001    0000           0000         yes
         *   0000   0010           0010    0000           0010         no
         *   0000   0010           0011    0000           0010         no
         *
         * So the second sum is (contingency[0] + contingency[1]).
         *
         * Then these two sums are reduced by multiplication and divided by the
         * sum of all cells raised to the power (this.order - 1).  That is the
         * expected frequency for cell 0.
         *
         *  expected[0] = ((cont[0] + cont[2]) * (cont[0] * cont[1])) / Math.pow(n_all, (2 - 1))
         *
         * Repeat those same steps for the other 4 cells of the contingency table.
         *
         *  expected[1] = ((cont[1] + cont[3]) * (cont[0] + cont[1])) / Math.pow(n_all, (2 - 1))
         *  expected[2] = ((cont[0] + cont[2]) * (cont[2] + cont[3])) / Math.pow(n_all, (2 - 1))
         *  expected[3] = ((cont[1] + cont[3]) * (cont[2] + cont[3])) / Math.pow(n_all, (2 - 1))
         *
         */

        const n_all = contingency.reduce((a,b) => { return a + b; }, 0);
        const expectedFrequencies = [];
        let productOfSums;

        for (let i = 0; i < contingency.length; i++) {
            const sums = [];
            for (let j = 0; j < bits.length; j++) {
                const bit = bits[j];
                const selected_cells = [];
                for (let k = 0; k < Math.pow(2, this.order); k++) {
                    if ((k & bit) === (i & bit)) {
                        selected_cells.push(contingency[k]);
                    }
                }
                const sum = selected_cells.reduce((a,b) => {
                    return a + b;
                }, 0);
                sums.push(sum);
            }
            productOfSums = sums.reduce((a, b) => {
                return a * b;
            }, 1);

            const denom = Math.pow(n_all, (this.order - 1));
            const expectedFrequency = productOfSums / denom;
            expectedFrequencies.push(expectedFrequency);
        }

        return expectedFrequencies;
    }

    /**
     * Return the score of a single ngram, given by a specified metric.
     *
     * @param {string} metric_name - the name of an associativity metric.
     * @param {Array<string>} ngram - An array representing an ngram.
     * @returns {number} the score as predicted by the function this[score_name]
     */
    score_ngram(metric_name, ngram) {
        return this[metric_name](ngram);
    }

    /**
     * Scores ngrams using likelihood ratios as in Manning and Schutze's
     * "Foundations of Statistical Natural Language Processing" (sec 5.3.4).
     * This explanation uses bigrams because it's easier to understand, but the
     * metric generalizes to any order.
     *
     * Theoretically, it uses two probabilities:
     *
     *     P(w2|w1): the probability that word 2 will follow word 1
     *     P(w2|¬w1): the probability that word 2 will follow any other word (not word 1)
     *
     * And it compares two hypotheses:
     *
     *     H1: P(w2|w1) == P(w2|¬w1)
     *     H2: P(w2|w1) != P(w2|¬w1)
     *
     * Then, assuming a binomial distribution, it finds the likelihood of each
     * hypothesis. The log of the ratio between these likelihoods is the score
     *
     *     likelihoodRatio = log(likelihood(H1) / likelihood(H2))
     *
     * Practically, this function goes cell by cell in the contingency table,
     * finding the likelihood of its value given the value of the corresponding
     * cell in the expectedFrequencies table. It then sums these likelihoods
     * and multiplies them by the order of the collocation table itself.
     *
     * @param {Array<string>} ngram - An array representing a single ngram
     * @returns {number} The likelihood ratio for a single ngram
     */
    likelihoodRatio(ngram) {
        const contingency = this.getContingency(ngram);
        const expectedFrequencies = this.getExpectedFrequencies(contingency);

        const likelihoods = [];
        for (let i = 0; i < contingency.length; i++) {
            const observed = contingency[i];
            const expected = expectedFrequencies[i];
            const likelihood = observed * Math.log((observed / (expected + SMALL)) + SMALL);
            likelihoods.push(likelihood);
        }
        const sumLikelihoods = likelihoods.reduce((a,b) => {
            return a + b;
        }, 0);
        return this.order * sumLikelihoods;
    }

}

/**
 * Collocation table for bigram (2-word) samples.
 *
 * @extends {NGramCollocationTable}
 */
class BiGramCollocationTable extends NGramCollocationTable {

    /**
     * constructor
     *
     */
    constructor() {
        super();
        this.bigram_fd = new FrequencyDistribution();
        this.order = 2;
    }

    /**
     * Update collocation tables using an array of words. The array is broken
     * into 1-grams, and the counts are added to the unigram frequency
     * distribution. Then the array is broken into 2-grams and the counts of
     * those are added to the bigram frequency distribution.
     *
     * @param {Array<string>} words - An array of words.
     */
    update(words) {
        super.update(words);
        this.bigram_fd.update(ngrams(2, words));
    }

    /**
     * Merge another BiGramCollocationTable into this one.
     *
     * @param {BiGramCollocationTable} collocationTable - another BiGramCollocation table.
     */
    merge(collocationTable) {
        super.merge(collocationTable);
        this.bigram_fd.update(collocationTable.bigram_fd.frequencies);
    }

    /**
     * Build a 2x2 contingency table for a given bigram. There are some
     * strange-looking variables here, but they follow a pattern.  The first
     * part, "n_" means "frequency of". The second part is made up of two
     * characters, visually depicting the positions in the bigram.
     *
     *   i: "word at this position"
     *   x: "anything at this position"
     *   o: "not(word) at this position"
     *
     * For example, n_ix means "frequency of word in first position followed by
     * anything" (which is the same as the frequency of that word overall.
     * Compare that with n_io: "frequency of word in first position followed by
     * any word other than the word in second position". Concretely, for "big
     * kahuna":
     *
     *     n_ii:  frequency of ["big", "kahuna"]
     *     n_ix:  frequency of ["big", *],  or frequency of "big"
     *     n_io:  frequency of ["big", not("kahuna")]
     *
     * The table produced can be shown visually as:
     *
     *        w1     ¬w1
     *        ------ ------
     *    w2 | n_ii | n_oi |
     *        ------ ------
     *   ¬w2 | n_io | n_oo |
     *        ------ ------
     *
     * It is returned as a single flat array, going from top-left to bottom-right:
     *
     *        w1              ¬w1
     *        ---------------- ----------------
     *    w2 | contingency[0] | contingency[1] |
     *        ---------------- ----------------
     *   ¬w2 | contingency[2] | contingency[3] |
     *        ---------------- ----------------
     *
     * @param {Array<string>} ngram - A length-2 array of words.
     * @returns {Array<number>} A length-4 array of contingency counts
     */
    getContingency(ngram) {
        // Get the total of all unigram freqencies.
        const n_all = this.unigram_fd.n();

        // Step 1: Get component frequencies
        const n_ii = this.bigram_fd.absoluteFrequency(ngram); // freq of (w1, w2)
        const n_ix = this.unigram_fd.absoluteFrequency(ngram[0]); // freq of w1
        const n_xi = this.unigram_fd.absoluteFrequency(ngram[1]); // freq of w2

        // Step 2: derive contingencies
        const n_io = n_ix - n_ii; // freq of (w1, ¬w2)
        const n_oi = n_xi - n_ii; // freq of (¬w1, w2)
        const n_oo = n_all - n_ii - n_oi - n_io; // freq of (¬w1, ¬w2)

        // Step 3: build contingency table
        const contingency = [n_ii, n_oi, n_io, n_oo];
        return contingency;
    }

    /**
     * Returns an array of scored ngrams according to a specified metric. The
     * objects in the array look like:
     *
     *   {
     *     w1: string
     *     w2: string
     *     frequency: number
     *     <metric_name>: number
     *   }
     *
     * @param {string} metric_name - The name of the metric to be used
     * @returns {Array<Object>} An array of objects representing frequencies and scores
     **/
    *score_ngrams(metric_name) {
        for (const [bigram, frequency] of this.bigram_fd.entries()) {
            const score = {};
            score.w1 = bigram[0];
            score.w2 = bigram[1];
            score.frequency = frequency;
            score[metric_name] = this.score_ngram(metric_name, bigram);
            yield score;
        }
    }

}

/**
 * Collocation table for trigram (3-word) samples.
 *
 * @extends {BiGramCollocationTable}
 */
class TriGramCollocationTable extends BiGramCollocationTable {

    /**
     * constructor
     *
     */
    constructor() {
        super();
        this.trigram_fd = new FrequencyDistribution();
        this.wildcard_fd = new FrequencyDistribution();
        this.order = 3;
    }

    /**
     * Update collocation tables using an array of words. The array is broken
     * into 1-grams, and the counts are added to the unigram frequency
     * distribution. Then the array is broken into 2-grams and the counts of
     * those are added to the bigram frequency distribution. Then the array is
     * broken into 3-grams and the counts of those are added to the trigram
     * frequency distribution.
     *
     * In addition, each trigram's first and third members are added to the
     * wildcard frequency distribution, which represents counts of (w1, *, w3).
     *
     * @param {Array<string>} words - An array of words.
     */
    update(words) {
        super.update(words);
        const trigrams = ngrams(3,words);
        this.trigram_fd.update(trigrams);

        const wildcards = [];

        for (let i = 0; i < trigrams.length; i++) {
            wildcards.push([trigrams[i][0], trigrams[i][2]]);
        }
        this.wildcard_fd.update(wildcards);
    }

    /**
     * Merge another TriGramCollocationTable into this one.
     *
     * @param {TriGramCollocationTable} collocationTable - another trigram collocation table
     */
    merge(collocationTable) {
        super.merge(collocationTable);
        this.trigram_fd.update(collocationTable.trigram_fd.frequencies);
        this.wildcard_fd.update(collocationTable.wildcard_fd.frequencies);
    }

    /**
     * Build a 2x2x2 contingency "cube" for a given trigram. This is analogous
     * to the {@link BiGramCollocationTable#getContingency} method, but for 3
     * variables. More detail about the intuitions can be found there.
     *
     * The cube is more difficult to visualize but can be thought of as two
     * tables:
     *
     *    | w3                     |  ¬w3
     *    | --------------------   |  --------------------
     *    |      w1      ¬w1       |       w1      ¬w1
     *    |      ------- -------   |       ------- -------
     *    |  w2 | n_iii | n_oii |  |   w2 | n_iio | n_oio |
     *    |      ------- -------   |       ------- -------
     *    | ¬w2 | n_ioi | n_ooi |  |  ¬w2 | n_ioo | n_ooo |
     *    |      ------- -------   |       ------- -------
     *
     * It is returned as a single flat array, going from left-top-left to
     * right-bottom-right:
     *
     *    | w3                          | ¬w3
     *    | -------------------------   | --------------------------
     *    |      w1      ¬w1            |       w1        ¬w1
     *    |      --------- ---------    |       --------- ---------
     *    |  w2 | cont[0] | cont[1] |   |   w2 | cont[4] | cont[5] |
     *    |      --------- ---------    |       --------- ---------
     *    | ¬w2 | cont[2] | cont[3] |   |  ¬w2 | cont[6] | cont[7] |
     *    |      --------- ---------    |       --------- ---------
     *
     * @param {Array<string>} ngram - array of length 3 that represents a trigram
     * @returns {Array<number>} A length-8 array of contingency counts
     */
    getContingency(ngram) {
        const n_xxx = this.unigram_fd.n();

        // Step 1: Get component frequencies
        const n_iii = this.trigram_fd.absoluteFrequency(ngram); // freq of (w1, w2, w3)

        const n_iix = this.bigram_fd.absoluteFrequency([ngram[0], ngram[1]]); // freq of (w1, w2,  *)
        const n_ixi = this.wildcard_fd.absoluteFrequency([ngram[0], ngram[2]]); // freq of (w1,  *, w3)
        const n_xii = this.bigram_fd.absoluteFrequency([ngram[1], ngram[2]]); // freq of (*,  w2, w3)

        const n_ixx = this.unigram_fd.absoluteFrequency(ngram[0]); // freq of w1
        const n_xix = this.unigram_fd.absoluteFrequency(ngram[1]); // freq of w2
        const n_xxi = this.unigram_fd.absoluteFrequency(ngram[2]); // freq of w3

        // Step 2: derive contingencies
        const n_oii = n_xii - n_iii; // freq of (¬w1,  w2,  w3)
        const n_ioi = n_ixi - n_iii; // freq of ( w1, ¬w2,  w3)
        const n_iio = n_iix - n_iii; // freq of ( w1,  w2, ¬w3)
        const n_ooi = n_xxi - n_iii - n_oii - n_ioi; // freq of (¬w1, ¬w2,  w3)
        const n_oio = n_xix - n_iii - n_oii - n_iio; // freq of (¬w1,  w2, ¬w3)
        const n_ioo = n_ixx - n_iii - n_ioi - n_iio; // freq of ( w1, ¬w2, ¬w3)
        const n_ooo = n_xxx - n_iii - n_oii - n_ioi - n_iio - n_ooi - n_oio - n_ioo; // freq of (¬w1, ¬w2, ¬w3)

        const contingency = [n_iii, n_oii, n_ioi, n_ooi,
            n_iio, n_oio, n_ioo, n_ooo];
        return contingency;
    }

    /**
     * Returns an array of scored ngrams according to a specified metric. The
     * objects in the array look like:
     *
     *   {
     *     w1: string
     *     w2: string
     *     w3: string
     *     frequency: number
     *     <metric_name>: number
     *   }
     *
     * @param {string} metric_name - The name of the metric to be used
     * @returns {Array<Object>} An array of objects representing frequencies and scores
     **/
    *score_ngrams(metric_name) {
        for (const [trigram, frequency] of this.trigram_fd.entries()) {
            const score = {};
            score.w1 = trigram[0];
            score.w2 = trigram[1];
            score.w3 = trigram[2];
            score.frequency = frequency;
            score[metric_name] = this.score_ngram(metric_name, trigram);
            yield score;
        }
    }

}

module.exports = {
    FrequencyDistribution: FrequencyDistribution,
    BiGramCollocationTable: BiGramCollocationTable,
    TriGramCollocationTable: TriGramCollocationTable
};

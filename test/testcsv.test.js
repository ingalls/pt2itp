const tape = require('tape');
const spawn = require('tape-spawn');
const csv = require('fast-csv');

let index = `${__dirname}/fixtures/index-ri-single/us_ri-address-both-0d603c2a171017011038-0d603c2a39.mbtiles`;
let input = `${__dirname}/fixtures/index-ri-single/index-ri-testing.csv`;
let output = `${__dirname}/fixtures/index-ri-single/index-ri-errors.csv`;
let config = `${__dirname}/fixtures/index-ri-single/index-ri-carmen-config.json`;

tape.test('testcsv', (t) => {
    t.test('Return correct std.err message', (t) => {

        let st = spawn(t, `${__dirname}/../index.js testcsv --index ${index} --input ${input} --output ${output} --config ${config}`);
        st.stderr.match(`
            ERROR TYPE                   COUNT
            -----------------------------------------------------------------------------------
            DIST                             2 ( 50.0% of errors | 18.2% of total addresses)
            NO RESULTS                       2 ( 50.0% of errors | 18.2% of total addresses)

            ok - 4/11 (36.4%) failed to geocode
            ok - 0/0 (NaN%) ITP results failed to geocode

            DIST statistical breakdown
            -----------------------------------------------------------------------------------
            DIST - mean: 7355.03 / median: 7355.03 / skew: null / standard dev: 6882.01
        `.replace(/^ +/mg, ''));

        st.end();
    });

    t.test('Return correct error messages in csv', (t) => {

        let csvErr = [];
        let st = spawn(t, `${__dirname}/../index.js testcsv --index ${index} --input ${input} --output ${output} --config ${config}`);

        csv.fromPath(output, {headers: true})
        .on("data", (data) => {
            csvErr.push(data);
        })
        .on("end", function() {
            t.equals(csvErr[0].error, 'DIST');
            t.equals(csvErr[1].error, 'DIST');
            t.equals(csvErr[2].error, 'NO RESULTS');
            t.equals(csvErr[3].error, 'NO RESULTS');
        });

        st.end();
    });
});
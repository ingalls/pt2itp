'use strict';

const test = require('tape');
const { Split } = require('../lib/map/split');

const ignored = (res) => res.reduce((p, c, i) => {
    if (c.ignore) p.push(i);
    return p;
}, []);


//             o
//
//                  *
//
//         *
//     *
// *
test('handle standard outliers', (t) => {
    const addressLocations = [
        { location: 0, number: 1 },
        { location: 0.1, number: 3 },
        { location: 0.2, number: 5 },
        { location: 0.3, number: 7 },
        { location: 0.4, number: 90 },
        { location: 0.5, number: 11 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [4]);
    t.end();
});

//             *
//    3x*
// *
test('clustered duplicates should not affect outlier detection', (t) => {
    const addressLocations = [
        { location: 0, number: 100 },
        { location: 0.1, number: 105 },
        { location: 0.1, number: 105 },
        { location: 0.1 , number: 105 },
        { location: 0.5, number: 125 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), []);
    t.end();
});


//             *
//    3x*
// *
test('clustered points should not affect outlier detection', (t) => {
    const addressLocations = [
        { location: 0, number: 100 },
        { location: 0.1, number: 105 },
        { location: 0.101, number: 106 },
        { location: 0.102, number: 107 },
        { location: 0.5, number: 125 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), []);
    t.end();
});

//                      *
//
//
//         *
//     *
// *
test('distant addresses that line up should not be marked as outliers', (t) => {
    const addressLocations = [
        { location: 0, number: 2 },
        { location: 0.1, number: 4 },
        { location: 0.2, number: 6 },
        { location: 0.3, number: 8 },
        { location: 0.4, number: 10 },
        { location: 3.0, number: 30 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), []);
    t.end();
});

//                        o
//             *              *
//         *
//     *              *
// *             *
test.skip('handle cliffs with outliers', (t) => {
    const addressLocations = [
        { location: 0, number: 2 },
        { location: 0.1, number: 4 },
        { location: 0.2, number: 6 },
        { location: 0.3, number: 8 },
        { location: 0.4, number: 2 },
        { location: 0.5, number: 4 },
        { location: 0.6, number: 22 },
        { location: 0.7, number: 8 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [6]);
    t.end();
});

//                  *
//         *
// *
//
//
//     o        o
test('handle multiple clear outliers like stray zeroes', (t) => {
    const addressLocations = [
        { location: 0, number: 500 },
        { location: 0.1, number: 0 },
        { location: 0.2, number: 505 },
        { location: 0.3, number: 0 },
        { location: 0.4, number: 510 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [1, 3]);
    t.end();
});

//             *   *
//         *           *
//     *                   *
// *             o            *
test('handle outliers within peaks', (t) => {
    const addressLocations = [
        { location: 0, number: 2 },
        { location: 0.1, number: 4 },
        { location: 0.2, number: 6 },
        { location: 0.3, number: 8 },
        { location: 0.4, number: 10 },
        { location: 0.5, number: 0 },
        { location: 0.6, number: 10 },
        { location: 0.7, number: 8 },
        { location: 0.8, number: 6 },
        { location: 0.9, number: 4 },
        { location: 1, number: 2 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [5]);
    t.end();
});

//                  o
//          *
//       *
//    *         *
// *                    *
test('handle peak with outlier that could be extension of the first segment', (t) => {
    const addressLocations = [
        { location: 0, number: 2 },
        { location: 0.1, number: 4 },
        { location: 0.2, number: 6 },
        { location: 0.3, number: 8 },
        { location: 0.4, number: 4 },
        { location: 0.5, number: 16 },
        { location: 0.6, number: 2 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [5]);
    t.end();
});


//                    7xO
//
//                             *
//               *
//       *
// *
test('handle several copies of the same outlier', (t) => {
    const addressLocations = [
        { location: 0, number: 1 },
        { location: 0.1, number: 3 },
        { location: 0.2, number: 5 },
        { location: 0.3, number: 15 },
        { location: 0.3, number: 15 },
        { location: 0.3, number: 15 },
        { location: 0.3, number: 15 },
        { location: 0.3, number: 15 },
        { location: 0.3, number: 15 },
        { location: 0.3, number: 15 },
        { location: 0.4, number: 9 }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [3, 4, 5, 6, 7, 8, 9]);
    t.end();
});

test('', (t) => {
    const addressLocations = [
        { location: 0.18666982218172914, number: '293' },
        { location: 0.13669973273738356, number: '322' },
        { location: 0.027773776286727454, number: '24' },
        { location: 0.09144491041193775, number: '56' },
        { location: 0.10597802297428979, number: '70' },
        { location: 0.046889153071788814, number: '15' },
        { location: 0.1432649429922489, number: '87' },
        { location: 0.09323134261959556, number: '33' },
        { location: 0.13258224625976378, number: '90' },
        { location: 0.3239674004938539, number: '56' },
        { location: 0.029673294290593576, number: '3' },
        { location: 0.20006222648127825, number: '122' },
        { location: 0.3239674004938539, number: '58' }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), []);
    t.end();
});

test('minimal points, no outliers', (t) => {
    const addressLocations = [
        { location: 0.3024558606397754, number: '121' },
        { location: 0.3055388963775714, number: '153' },
        { location: 0.11080453918818053, number: '176' },
        { location: 0, number: '336' }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), []); // no outliers
    t.end();
});

/*
{"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"type":"MultiPoint","coordinates":[[-72.5140019,43.8333461,99571],[-72.5136155247484,43.8330044032302,113783],[-72.5136661,43.8330971,99553],[-72.5138938,43.8329765,99568],[-72.5146649,43.833463,91944],[-72.5149715,43.8332285,99589],[-72.5152414,43.8333202,99550]]}},
{"type":"Feature","properties":{},"geometry":{"type":"LineString","coordinates":[[-72.5139258,43.8337375],[-72.5138471,43.833327],[-72.5138424,43.8332806],[-72.5138424,43.8332461],[-72.5138529,43.8332006],[-72.5138716,43.8331711],[-72.5138938,43.8331492],[-72.5139335,43.8331349],[-72.5139767,43.8331298],[-72.5140188,43.8331307],[-72.5140585,43.8331391],[-72.5141122,43.8331534],[-72.5147593,43.8334154],[-72.5153222,43.8335645]]}}]}
*/
test('', (t) => {
    const addressLocations = [
        { location: 0.042275359694893995, number: '22' },
        { location: 0.06666356656995437, number: '39' },
        { location: 0.06382538376151721, number: '43' },
        { location: 0.07040148840842819, number: '55' },
        { location: 0.1407105061781741, number: '74' },
        { location: 0.15353706952434398, number: '77' },
        { location: 0.17737403527721493, number: '89' }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), []); // no outliers
    t.end();
});

test('', (t) => {
    const addressLocations = [
        { location: 0.47820341988646786, number: '8' },
        { location: 0.05601153743250195, number: '21' },
        { location: 0.04695673860581387, number: '21' },
        { location: 0.4920307467870483, number: '29' },
        { location: 0.018115121233818872, number: '66' },
        { location: 0.008739703577051353, number: '66' },
        { location: 0.389657616335459, number: '67' },
        { location: 0.12652417848367095, number: '77' },
        { location: 0.12459482286643497, number: '77' },
        { location: 0.019596571706719648, number: '106' },
        { location: 0.16298537632545096, number: '111' },
        { location: 0.027093930909527095, number: '111' },
        { location: 0.31672059169075084, number: '112' },
        { location: 0.2875498568182624, number: '125' },
        { location: 0.16375742978959892, number: '186' },
        { location: 0.08847398937636741, number: '254' }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), []);
    t.end();
});

/*
{"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"type":"MultiPoint","coordinates":[[-73.2075438,42.9824573,14437],[-73.2074281090354,42.9824234442623,4287],[-73.2087245054792,42.9822527643928,17844],[-73.2084958,42.9823644,14203],[-73.2211961521745,42.9890916867536,17767],[-73.208444,42.9828159,13789],[-73.2162522,42.9825827,13107],[-73.2156633397884,42.9820296239402,17758],[-73.2163791,42.9823077,15002],[-73.2173722205452,42.9817955048384,18207],[-73.2173552,42.9832698,14746],[-73.2173839828905,42.9844970326408,17715],[-73.2173246,42.9846774,2361],[-73.2182927602178,42.9818124964571,4358],[-73.217935,42.9831363,5230],[-73.2187156508071,42.984862206192,17805],[-73.218469,42.984048,10900],[-73.2194324417878,42.982210974216,4302],[-73.2193846,42.9823619,13816],[-73.2198195,42.9840709,14011],[-73.2197982647195,42.9841843456618,17720],[-73.2209535257149,42.9837752336617,15792],[-73.2207655,42.9837657,5861],[-73.222444,42.9835369,5224],[-73.2218806536466,42.9834517392852,11413],[-73.2227216310625,42.9832049490692,18216],[-73.222093,42.982896,10944],[-73.2228865,42.9814311,4863],[-73.2225602473013,42.9817617788403,11424],[-73.2237219,42.9817435,6227],[-73.2233338568547,42.9820144907087,17772],[-73.2254182234416,42.9809632942786,17853],[-73.2251448,42.980878,10776],[-73.2254118424091,42.980080791839,17868],[-73.2253584,42.9803935,10446],[-73.2245192,42.979932,4980],[-73.2201422361275,42.9800343610414,4254],[-73.2260955633104,42.9800443650225,4244],[-73.225839,42.9798786,12556],[-73.2265257,42.9792949,10901],[-73.2263576773802,42.9792184907461,17773],[-73.2261366,42.978448,5405],[-73.2248506019509,42.9772615452072,4357],[-73.2260069,42.9784099,5675],[-73.2279524,42.9767963,15517],[-73.2247610453393,42.9740489513913,17872],[-73.2281279,42.9786044,5218],[-73.2278784805286,42.9796314511743,17780],[-73.229463,42.9792301,5860],[-73.2292750447291,42.9784084627623,17864],[-73.2310417605194,42.979207942913,4279],[-73.2303821,42.9773975,10412],[-73.2310107,42.9762991,4976],[-73.2309596823991,42.9751215096958,4356],[-73.2319502,42.9764949,14832],[-73.2317353267451,42.9751378817714,17842],[-73.2328657,42.9788028,15589],[-73.232688362582,42.9796599294421,4361],[-73.2350554,42.9787494,2339],[-73.2348678979271,42.9780912827279,17847],[-73.2346796216463,42.9769793832348,17870],[-73.2337812,42.9763614,6225],[-73.2360599903391,42.9751642929732,4280],[-73.235835,42.9753908,5891],[-73.2353421,42.9749093,5419],[-73.2350423538111,42.9742557976349,4339],[-73.2390913,42.975999,15577],[-73.2389067037692,42.9751976957144,4306]]}},
{"type":"Feature","properties":{},"geometry":{"type":"LineString","coordinates":[[-73.237048,42.974144],[-73.236755,42.974351],[-73.236522,42.974509],[-73.236036,42.974797],[-73.235716,42.974964],[-73.23519,42.975205],[-73.23467,42.975462],[-73.234579,42.975513],[-73.234164,42.975743],[-73.233353,42.976219],[-73.23311,42.976376],[-73.233041,42.976417],[-73.232986,42.97645],[-73.232788,42.976533],[-73.232719,42.976551],[-73.232577,42.976573],[-73.232362,42.976581],[-73.232113,42.976574],[-73.231783,42.976565],[-73.23106,42.976558],[-73.230697,42.976559],[-73.230407,42.976566],[-73.230263,42.976581],[-73.230049,42.976623],[-73.229839,42.976684],[-73.229566,42.976781],[-73.22882,42.977062],[-73.228551,42.97717],[-73.228087,42.977373],[-73.227755,42.977518],[-73.227261,42.977818],[-73.227023,42.977984],[-73.226793,42.978162],[-73.226438,42.978522],[-73.225608,42.979329],[-73.22475,42.980105],[-73.224327,42.980499],[-73.223898,42.98089],[-73.223513,42.981264],[-73.223294,42.981514],[-73.22304,42.981772],[-73.22288,42.981918],[-73.222425,42.982275],[-73.221959,42.98262],[-73.221612,42.982868],[-73.221253,42.983125],[-73.220535,42.983612],[-73.220291,42.983765],[-73.22009,42.983873],[-73.220004,42.983905],[-73.219918,42.983911],[-73.219797,42.983914],[-73.219638,42.983901],[-73.218641,42.983717],[-73.218439,42.98368],[-73.217296,42.983482],[-73.216723,42.983392],[-73.216146,42.983313],[-73.21557,42.983246],[-73.21488,42.983182],[-73.214414,42.983139],[-73.212601,42.983013],[-73.212167,42.982972],[-73.211875,42.98295],[-73.210213,42.982802],[-73.209853,42.982765],[-73.209636,42.982747],[-73.209276,42.982727],[-73.208773,42.982673],[-73.208126,42.98261],[-73.207764,42.98259],[-73.207091,42.982572],[-73.206863,42.982444]]}}]}
*/
test('', (t) => {
    const addressLocations = [
        { location: 2.854202635033599, number: '33' },
        { location: 2.8637448722534415, number: '33' },
        { location: 2.763212554678719, number: '77' },
        { location: 2.780016397401974, number: '77' },
        { location: 1.8275928168546611, number: '80' }, // outlier
        { location: 2.7775695380058423, number: '80' },
        { location: 2.15325475188953, number: '453' },
        { location: 2.2059580244506356, number: '453' },
        { location: 2.1490348412483975, number: '455' },
        { location: 2.0869150014498246, number: '535' },
        { location: 2.053855903335789, number: '535' },
        { location: 2.020640277263354, number: '546' },
        { location: 2.0207195341627675, number: '546' },
        { location: 2.0174866313594055, number: '591' },
        { location: 2.011887786841007, number: '591' },
        { location: 1.9040873428395384, number: '598' },
        { location: 1.9457567927367987, number: '598' },
        { location: 1.73316332680418, number: '619' }, //
        { location: 1.9193317802878185, number: '619' },
        { location: 1.8432302367585882, number: '664' },
        { location: 1.8444684648551266, number: '664' },
        { location: 1.7606912643163033, number: '708' },
        { location: 1.7711862034720067, number: '708' },
        { location: 1.6564582053364703, number: '760' },
        { location: 1.6825881501801228, number: '760' },
        { location: 1.614426286061163, number: '808' },
        { location: 1.6269976924022482, number: '808' },
        { location: 1.4608723694640449, number: '867' },
        { location: 1.510174210384683, number: '867' },
        { location: 1.4493435889269357, number: '914' },
        { location: 1.490418828588358, number: '914' },
        { location: 1.2939185604405006, number: '986' },
        { location: 1.300198945092673, number: '986' },
        { location: 1.2164870150553082, number: '1014' },
        { location: 1.246255144527458, number: '1014' },
        { location: 1.249291532154006, number: '1055' },
        { location: 1.4653089508233752, number: '1055' }, //
        { location: 1.1783576446307054, number: '1076' },
        { location: 1.1771530527043483, number: '1076' },
        { location: 1.0935405680417214, number: '1130' },
        { location: 1.0949698952778237, number: '1130' },
        { location: 1.0373235135221288, number: '1143' },
        { location: 0.9910475111964785, number: '1143' },
        { location: 1.040282244578667, number: '1145' },
        { location: 0.8186111802831915, number: '1279' },
        { location: 0.8735800485902535, number: '1279' },
        { location: 0.9351020085313363, number: '1286' }, //
        { location: 1.0572746222721845, number: '1286' }, //
        { location: 0.8518531314232168, number: '1304' },
        { location: 0.8182651042914367, number: '1304' },
        { location: 0.5814458877425709, number: '1392' }, //
        { location: 0.6684400394800264, number: '1392' },
        { location: 0.5827541914994251, number: '1425' },
        { location: 0.5864113287602472, number: '1425' },
        { location: 0.5067252807231142, number: '1469' },
        { location: 0.5260050465882107, number: '1469' },
        { location: 0.4553766508870014, number: '1514' },
        { location: 0.46376351556246814, number: '1514' },
        { location: 0.419043918661426, number: '1516' },
        { location: 0.41638835806004715, number: '1516' },
        { location: 0.34837349091771824, number: '1584' },
        { location: 0.3623867192204464, number: '1584' },
        { location: 0.1319908707120731, number: '1702' },
        { location: 0.15882434566214187, number: '1702' },
        { location: 0.16439432295876796, number: '1721' },
        { location: 0.14649489406335672, number: '1721' },
        { location: 0.023689772770576083, number: '1814' },
        { location: 0, number: '1814' }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [4]);
    t.end();
});

test('', (t) => {
    const addressLocations = [
        { location: 0.013014794072470678, number: '15' },
        { location: 0.05587614550130269, number: '40' },
        { location: 0.18765755271116985, number:'60' },
        { location: 0.20191632119517983, number: '60' },
        { location: 0.13969184667872733, number: '60' },
        { location: 0.10351539781140555, number: '60' },
        { location: 0.2599570455673792, number: '111' },
        { location: 0.25375010829823513, number: '111' },
        { location: 0.1996592757008111, number: '111' },
        { location: 0.1699281870976198, number: '111' },
        { location: 0.25375010829823513, number: '111' },
        { location: 0.17186372837432107, number: '111' },
        { location: 0.25375010829823513, number: '365' },
        { location: 0.25375010829823513, number: '367' }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [12, 13]);
    t.end();
});

test('evenodd', (t) => {
    const addressLocations = [
        { location: 0.026619776797833228, number: '3' },
        { location: 0.05645133703021328, number: '5' },
        { location: 0.07968366815223235, number: '7' },
        { location: 0.10293744726144194, number: '8' },
        { location: 0.11226117859779977, number: '9' },
        { location: 0.13236963794718054, number: '10' },
        { location: 0.1394675007195128, number: '11' },
        { location: 0.1733852926032369, number: '12' },
        { location: 0.1702531032468398, number: '13' },
        { location: 0.2251232406273126, number: '14' },
        { location: 0.2152967102721695, number: '15' },
        { location: 0.39575457414190907, number: '16' },
        { location: 0.24626523667959666, number: '17' },
        { location: 0.42513509093257024, number: '18' },
        { location: 0.2663522539404404, number: '19' },
        { location: 0.467807364200788, number: '20' },
        { location: 0.2781208699096889, number: '21' },
        { location: 0.29436563836604396, number: '23' },
        { location: 0.3118043290618646, number: '25' },
        { location: 0.34155629560401335, number: '27' },
        { location: 0.3691434176496209, number: '29' },
        { location: 0.4165216951397523, number: '31' },
        { location: 0.44997803967381317, number: '33' },
        { location: 0.4864773980680333, number: '35' }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [11, 13, 15]);
    t.end();
});

test('outlier2', (t) => {
    const addressLocations = [
        { location: 0.20827621261441853, number: '6' },
        { location: 0.20827621261441853, number: '6' },
        { location: 0.18003714713562896, number: '9' },
        { location: 0.17840542484203797, number: '9' },
        { location: 0.14741316012491226, number: '15' },
        { location: 0.1402793826076209, number: '15' },
        { location: 0.09465898879533878, number: '16' }, //
        { location: 0.1121956402153018, number: '16' },
        { location: 0.010230666323889461, number: '21' }, //
        { location: 0.07463149860300924, number: '24' },
        { location: 0.08103717611401606, number: '24' },
        { location: 0.0931292440395935, number: '25' },
        { location: 0.09086421971711717, number: '25' },
        { location: 0.05559651095975835, number: '29' },
        { location: 0.04544085578858492, number: '29' },
        { location: 0.04176167852794213, number: '30' },
        { location: 0.047672778951868916, number: '30' },
        { location: 0.034275959753819696, number: '32' },
        { location: 0.023700093993372216, number: '34' },
        { location: 0.016429642338136794, number: '34' },
        { location: 0.017919232264831074, number: '35' },
        { location: 0.015760812596498107, number: '35' }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [6, 8]);
    t.end();
});

test('outlier1', (t) => {
    const addressLocations = [
        { location: 0.005430443074926123, number: '5544' },
        { location: 0.010658910558378277, number: '5545' },
        { location: 0.02457170906514842, number: '5550' },
        { location: 0.03663884829439811, number: '5555' },
        { location: 0.057663587015265735, number: '5562' },
        { location: 0.03260842350710518, number: '5570' } // outlier
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [5]);
    t.end();
});

test('handle number variabily between street sides', (t) => {
    const addressLocations = [
        { location: 0.046982343061604086, number: '49' },
        { location: 0.0720359045385121, number: '51' },
        { location: 0.10011262795555968, number: '53' },
        { location: 0.12096217458052277, number: '55' },
        { location: 0.14839318629206885, number: '57' },
        { location: 0.16403085808010343, number: '59' },
        { location: 0.17788893191440833, number: '61' },
        { location: 0.19038164992617754, number: '63' },
        { location: 0.21503965777747577, number: '65' },
        { location: 0.024091052342478155, number: '70' },
        { location: 0.05080886980387892, number: '72' },
        { location: 0.07432060851672279, number: '74' },
        { location: 0.09917351309135028, number: '76' },
        { location: 0.12820026062088208, number: '78' },
        { location: 0.1681166669298657, number: '80' }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), []);
    t.end();
});

test('standard outlier', (t) => {
    const addressLocations = [
        { location: 0.09354475973334028, number: '0' }, //
        { location: 0.010333619581031826, number: '19' },
        { location: 0.006849378030106402, number: '20' },
        { location: 0.024768055805599272, number: '21' },
        { location: 0.02132440758078112, number: '22' },
        { location: 0.024951840172195667, number: '23' },
        { location: 0.03418280688869387, number: '24' },
        { location: 0.03495625143414758, number: '25' },
        { location: 0.047269104638038115, number: '26' },
        { location: 0.04684219054338793, number: '27' },
        { location: 0.06131010885676974, number: '28' },
        { location: 0.05597797994543892, number: '29' },
        { location: 0.07290279351497, number: '30' },
        { location: 0.06785598492794506, number: '31' },
        { location: 0.08142480959167546, number: '33' },
        { location: 0.08618079399003395, number: '34' },
        { location: 0.09209003801283681, number: '35' },
        { location: 0.10000499029719702, number: '36' }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [0]);
    t.end();
});

test.skip('multiple cliffs', (t) => {
    const addressLocations = [
        { location: 0.22106693775503267, number: '13' },
        { location: 0.21577396485284156, number: '14' },
        { location: 0.2111902553832963, number: '15' },
        { location: 0.20535397304438702, number: '16' },
        { location: 0.20140092040272992, number: '17' },
        { location: 0.19653514798087343, number: '18' },
        { location: 0.18949727636222788, number: '19' },
        { location: 0.18381520055112224, number: '20' },
        { location: 0.18023469695418773, number: '21' },
        { location: 0.1706611193160421, number: '22' },
        { location: 0.16665343244276126, number: '23' },
        { location: 0.15421663643771588, number: '24' },
        { location: 0.14149029955677023, number: '25' },
        { location: 0.018951814573157193, number: '26' },
        { location: 0.02212282621638896, number: '27' },
        { location: 0.023021517901666698, number: '28' },
        { location: 0.02770659900943017, number: '29' },
        { location: 0.029333742251787635, number: '30' },
        { location: 0.03159420408476801, number: '31' },
        { location: 0.03346833265035837, number: '32' },
        { location: 0.03844353003713687, number: '33' },
        { location: 0.04030220429239518, number: '34' },
        { location: 0.043158108410343385, number: '35' },
        { location: 0.04473991478151326, number: '36' },
        { location: 0, number: '37' },
        { location: 0, number: '38' },
        { location: 0.0049638670038710175, number: '39' },
        { location: 0.008997225300832405, number: '40' },
        { location: 0.016182646467158664, number: '41' },
        { location: 0.021022279926153607, number: '42' },
        { location: 0.026723211727095082, number: '43' },
        { location: 0.031310314524523306, number: '44' },
        { location: 0.03788379458103334, number: '45' },
        { location: 0.04256474944871931, number: '46' },
        { location: 0.049529296956733714, number: '47' },
        { location: 0.055960425903508935, number: '48' },
        { location: 0.08389250226475663, number: '49' },
        { location: 0.08600214676983353, number: '50' },
        { location: 0.08600214676983353, number: '51' },
        { location: 0.08715023096911635, number: '52' },
        { location: 0.09341153527762479, number: '53' },
        { location: 0.0973982619183992, number: '54' },
        { location: 0.10196991287205874, number: '55' },
        { location: 0.10721632707253637, number: '56' },
        { location: 0.11332645776847286, number: '57' },
        { location: 0.1173853270373999, number: '58' },
        { location: 0.12335526094956903, number: '59' },
        { location: 0.12852883344393878, number: '60' },
        { location: 0.1337838873714499, number: '61' },
        { location: 0.12818270694915543, number: '62' },
        { location: 0.12247309198862158, number: '63' },
        { location: 0.11765737863650251, number: '64' },
        { location: 0.11129763214619162, number: '65' },
        { location: 0.10672684950351524, number: '66' },
        { location: 0.10099558778055284, number: '67' },
        { location: 0.09949845027598352, number: '68' },
        { location: 0.09377447953847375, number: '69' },
        { location: 0.08925177341867278, number: '70' },
        { location: 0.08600214676983353, number: '71' },
        { location: 0.08600214676983353, number: '72' },
        { location: 0.19511184867541115, number: '73' },
        { location: 0.19160994613115143, number: '74' },
        { location: 0.18402644699061046, number: '75' },
        { location: 0.18091298442088516, number: '76' },
        { location: 0.17664650195576898, number: '77' },
        { location: 0.17273116795941193, number: '78' },
        { location: 0.16614280338419854, number: '79' },
        { location: 0.16311328986583812, number: '80' },
        { location: 0.16130240412633115, number: '81' },
        { location: 0.1571336059906931, number: '82' },
        { location: 0.15102389844351105, number: '83' },
        { location: 0.14884136570113096, number: '84' },
        { location: 0.36846501965636125, number: '85' },
        { location: 0.36874395255516856, number: '86' },
        { location: 0.3689626494397329, number: '87' },
        { location: 0.36846501965636125, number: '88' },
        { location: 0.3704657160233362, number: '89' },
        { location: 0.37144010574510217, number: '90' },
        { location: 0.37158409495266664, number: '91' },
        { location: 0.3729054529735841, number: '92' },
        { location: 0.3741034525790438, number: '93' },
        { location: 0.3744410188823591, number: '94' },
        { location: 0.3749968204907346, number: '95' },
        { location: 0.37532899824277716, number: '96' }
    ];

    const res = Split.detectOutliers(addressLocations);
    t.deepEqual(ignored(res), [0]);
    t.end();
});
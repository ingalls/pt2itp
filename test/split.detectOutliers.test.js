'use strict';

const test = require('tape');
const { Split } = require('../lib/map/split');

const ignored = (res) => res.addressPoints.reduce((p, c, i) => {
    if (c.ignore) p.push(i);
    return p;
}, []);


// conservative cases

// *
//               *
//                *
//   *
test('dont flag outliers when there are less than five points', (t) => {
    const cluster = {
        addressPoints: [
            { location: 0.3024558606397754, props: { number: '121' } },
            { location: 0.3055388963775714, props: { number: '153' } },
            { location: 0.11080453918818053, props: { number: '176' } },
            { location: 0, props: { number: '336' } }
        ]
    };

    const res = Split.detectOutliers(cluster);
    t.deepEqual(ignored(res), []); // no outliers
    t.end();
});


//                   *
//                               *
//                     *
//          *
// *
test('dont flag outliers when there arent many evens or odds', (t) => {
    const cluster = {
        addressPoints: [
            { location: 0.005430443074926123, props: { number: '5544' } },
            { location: 0.010658910558378277, props: { number: '5545' } },
            { location: 0.02457170906514842, props: { number: '5550' } },
            { location: 0.03663884829439811, props: { number: '5555' } },
            { location: 0.057663587015265735, props: { number: '5562' } },
            { location: 0.03260842350710518, props: { number: '5570' } }
        ]
    };

    const res = Split.detectOutliers(cluster);
    t.deepEqual(ignored(res), []);
    t.end();
});

//             *
//
//       *              *
//  *        *
//     *            *
//  *      *
test('scattered data, no line of best fit', (t) => {
    const cluster = {
        addressPoints: [
            { location: 0.47820341988646786, props: { number: '8' } },
            { location: 0.05601153743250195, props: { number: '21' } },
            { location: 0.04695673860581387, props: { number: '21' } },
            { location: 0.4920307467870483, props: { number: '29' } },
            { location: 0.018115121233818872, props: { number: '66' } },
            { location: 0.008739703577051353, props: { number: '66' } },
            { location: 0.389657616335459, props: { number: '67' } },
            { location: 0.12652417848367095, props: { number: '77' } },
            { location: 0.12459482286643497, props: { number: '77' } },
            { location: 0.019596571706719648, props: { number: '106' } },
            { location: 0.16298537632545096, props: { number: '111' } },
            { location: 0.027093930909527095, props: { number: '111' } },
            { location: 0.31672059169075084, props: { number: '112' } },
            { location: 0.2875498568182624, props: { number: '125' } },
            { location: 0.16375742978959892, props: { number: '186' } },
            { location: 0.08847398937636741, props: { number: '254' } }
        ]
    };

    const res = Split.detectOutliers(cluster);
    t.deepEqual(ignored(res), []); // no outliers
    t.end();
});

// standard outlier detection cases

//             *
//    3x*
// *
// TODO: add more points, this is being skipped
test('clustered duplicates should not affect outlier detection', (t) => {
    const cluster = {
        addressPoints: [
            { location: 0, props: { number: 100 } },
            { location: 0.1, props: { number: 105 } },
            { location: 0.1, props: { number: 105 } },
            { location: 0.1 , props: { number: 105 } },
            { location: 0.5, props: { number: 125 } }
        ]
    };

    const res = Split.detectOutliers(cluster);
    t.deepEqual(ignored(res), []);
    t.end();
});

//             *
//    3x*
// *
// TODO: add more points, this is being skipped
test('clustered points should not affect outlier detection', (t) => {
    const cluster = {
        addressPoints: [
            { location: 0, props: { number: 100 } },
            { location: 0.1, props: { number: 105 } },
            { location: 0.101, props: { number: 106 } },
            { location: 0.102, props: { number: 107 } },
            { location: 0.5, props: { number: 125 } }
        ]
    };

    const res = Split.detectOutliers(cluster);
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
    const cluster = {
        addressPoints: [
            { location: 0, props: { number: 2 } },
            { location: 0.1, props: { number: 4 } },
            { location: 0.2, props: { number: 6 } },
            { location: 0.3, props: { number: 8 } },
            { location: 0.4, props: { number: 10 } },
            { location: 2.0, props: { number: 42 } }
        ]
    };

    const res = Split.detectOutliers(cluster);
    t.deepEqual(ignored(res), []);
    t.end();
});

// *
//     *
//         *
//            *
//    o          *
//            o     *
//                      *
test('points far from the best fit line should be flagged', (t) => {
    const cluster = {
        addressPoints: [
            { location: 0.20827621261441853, props: { number: '6' } },
            { location: 0.20827621261441853, props: { number: '6' } },
            { location: 0.18003714713562896, props: { number: '9' } },
            { location: 0.17840542484203797, props: { number: '9' } },
            { location: 0.14741316012491226, props: { number: '15' } },
            { location: 0.1402793826076209, props: { number: '15' } },
            { location: 0.09465898879533878, props: { number: '16' } }, // outlier
            { location: 0.1121956402153018, props: { number: '16' } },
            { location: 0.010230666323889461, props: { number: '21' } }, // outlier
            { location: 0.07463149860300924, props: { number: '24' } },
            { location: 0.08103717611401606, props: { number: '24' } },
            { location: 0.0931292440395935, props: { number: '25' } },
            { location: 0.09086421971711717, props: { number: '25' } },
            { location: 0.05559651095975835, props: { number: '29' } },
            { location: 0.04544085578858492, props: { number: '29' } },
            { location: 0.04176167852794213, props: { number: '30' } },
            { location: 0.047672778951868916, props: { number: '30' } },
            { location: 0.034275959753819696, props: { number: '32' } },
            { location: 0.023700093993372216, props: { number: '34' } },
            { location: 0.016429642338136794, props: { number: '34' } },
            { location: 0.017919232264831074, props: { number: '35' } },
            { location: 0.015760812596498107, props: { number: '35' } }
        ]
    };

    const res = Split.detectOutliers(cluster);
    t.deepEqual(ignored(res), [6, 8]);
    t.end();
});

//                       2xO
//
//                    *      *
//              *
//       *
// *
test('points far from the best fit line should be flagged', (t) => {
    const cluster = {
        addressPoints: [
            { location: 0.013014794072470678, props: { number: '15' } },
            { location: 0.05587614550130269, props: { number: '40' } },
            { location: 0.18765755271116985, props: { number: '60' } },
            { location: 0.20191632119517983, props: { number: '60' } },
            { location: 0.13969184667872733, props: { number: '60' } },
            { location: 0.10351539781140555, props: { number: '60' } },
            { location: 0.2599570455673792, props: { number: '111' } },
            { location: 0.25375010829823513, props: { number: '111' } },
            { location: 0.1996592757008111, props: { number: '111' } },
            { location: 0.1699281870976198, props: { number: '111' } },
            { location: 0.25375010829823513, props: { number: '111' } },
            { location: 0.17186372837432107, props: { number: '111' } },
            { location: 0.25375010829823513, props: { number: '365' } }, // outlier
            { location: 0.25375010829823513, props: { number: '367' } }  // outlier
        ]
    };

    const res = Split.detectOutliers(cluster);
    t.deepEqual(ignored(res), []);
    t.end();
});

//                  *
//       o      *
//          *
//     *
//     *
// *
test('outliers should be flagged for data with just enough even/odd points', (t) => {
    const cluster = {
        addressPoints: [
            { location: 0.042275359694893995, props: { number: '22' } },
            { location: 0.06666356656995437, props: { number: '39' } },
            { location: 0.06382538376151721, props: { number: '43' } },
            { location: 0.07040148840842819, props: { number: '55' } },
            { location: 0.1407105061781741, props: { number: '74' } },
            { location: 0.15353706952434398, props: { number: '77' } },
            { location: 0.17737403527721493, props: { number: '89' } }
        ]
    };

    const res = Split.detectOutliers(cluster);
    t.deepEqual(ignored(res), [3]);
    t.end();
});

// *
//      *
//           *
//                *     o
//                     *
//                         *
//                     o        *
test('points far from the best fit line should be flagged', (t) => {
    const cluster = {
        addressPoints: [
            { location: 2.854202635033599, props: { number: '33' } },
            { location: 2.8637448722534415, props: { number: '33' } },
            { location: 2.763212554678719, props: { number: '77' } },
            { location: 2.780016397401974, props: { number: '77' } },
            { location: 1.8275928168546611, props: { number: '80' } }, // outlier
            { location: 2.7775695380058423, props: { number: '80' } },
            { location: 2.15325475188953, props: { number: '453' } },
            { location: 2.2059580244506356, props: { number: '453' } },
            { location: 2.1490348412483975, props: { number: '455' } },
            { location: 2.0869150014498246, props: { number: '535' } },
            { location: 2.053855903335789, props: { number: '535' } },
            { location: 2.020640277263354, props: { number: '546' } },
            { location: 2.0207195341627675, props: { number: '546' } },
            { location: 2.0174866313594055, props: { number: '591' } },
            { location: 2.011887786841007, props: { number: '591' } },
            { location: 1.9040873428395384, props: { number: '598' } },
            { location: 1.9457567927367987, props: { number: '598' } },
            { location: 1.73316332680418, props: { number: '619' } }, // outlier
            { location: 1.9193317802878185, props: { number: '619' } },
            { location: 1.8432302367585882, props: { number: '664' } },
            { location: 1.8444684648551266, props: { number: '664' } },
            { location: 1.7606912643163033, props: { number: '708' } },
            { location: 1.7711862034720067, props: { number: '708' } },
            { location: 1.6564582053364703, props: { number: '760' } },
            { location: 1.6825881501801228, props: { number: '760' } },
            { location: 1.614426286061163, props: { number: '808' } },
            { location: 1.6269976924022482, props: { number: '808' } },
            { location: 1.4608723694640449, props: { number: '867' } },
            { location: 1.510174210384683, props: { number: '867' } },
            { location: 1.4493435889269357, props: { number: '914' } },
            { location: 1.490418828588358, props: { number: '914' } },
            { location: 1.2939185604405006, props: { number: '986' } },
            { location: 1.300198945092673, props: { number: '986' } },
            { location: 1.2164870150553082, props: { number: '1014' } },
            { location: 1.246255144527458, props: { number: '1014' } },
            { location: 1.249291532154006, props: { number: '1055' } },
            { location: 1.4653089508233752, props: { number: '1055' } }, // outlier
            { location: 1.1783576446307054, props: { number: '1076' } },
            { location: 1.1771530527043483, props: { number: '1076' } },
            { location: 1.0935405680417214, props: { number: '1130' } },
            { location: 1.0949698952778237, props: { number: '1130' } },
            { location: 1.0373235135221288, props: { number: '1143' } },
            { location: 0.9910475111964785, props: { number: '1143' } },
            { location: 1.040282244578667, props: { number: '1145' } },
            { location: 0.8186111802831915, props: { number: '1279' } },
            { location: 0.8735800485902535, props: { number: '1279' } },
            { location: 0.9351020085313363, props: { number: '1286' } }, // outlier
            { location: 1.0572746222721845, props: { number: '1286' } }, // outlier
            { location: 0.8518531314232168, props: { number: '1304' } },
            { location: 0.8182651042914367, props: { number: '1304' } },
            { location: 0.5814458877425709, props: { number: '1392' } }, // outlier
            { location: 0.6684400394800264, props: { number: '1392' } },
            { location: 0.5827541914994251, props: { number: '1425' } },
            { location: 0.5864113287602472, props: { number: '1425' } },
            { location: 0.5067252807231142, props: { number: '1469' } },
            { location: 0.5260050465882107, props: { number: '1469' } },
            { location: 0.4553766508870014, props: { number: '1514' } },
            { location: 0.46376351556246814, props: { number: '1514' } },
            { location: 0.419043918661426, props: { number: '1516' } },
            { location: 0.41638835806004715, props: { number: '1516' } },
            { location: 0.34837349091771824, props: { number: '1584' } },
            { location: 0.3623867192204464, props: { number: '1584' } },
            { location: 0.1319908707120731, props: { number: '1702' } },
            { location: 0.15882434566214187, props: { number: '1702' } },
            { location: 0.16439432295876796, props: { number: '1721' } },
            { location: 0.14649489406335672, props: { number: '1721' } },
            { location: 0.023689772770576083, props: { number: '1814' } },
            { location: 0, props: { number: '1814' } }
        ]
    };

    const res = Split.detectOutliers(cluster);
    t.deepEqual(ignored(res), [4, 17, 36, 46, 47, 50]);
    t.end();
});

// line of best fit edge cases

//          *       *
//
//
//                     *
//              *               *
//        *                     *
// *
// TODO: some outliers can throw off best fit line when there aren't many points
test.skip('points far from the best fit line should be flagged', (t) => {
    const cluster = {
        addressPoints: [
            { location: 0.18666982218172914, props: { number: '293' } }, // outlier
            { location: 0.13669973273738356, props: { number: '322' } }, // outlier
            { location: 0.027773776286727454, props: { number: '24' } },
            { location: 0.09144491041193775, props: { number: '56' } },
            { location: 0.10597802297428979, props: { number: '70' } },
            { location: 0.046889153071788814, props: { number: '15' } },
            { location: 0.1432649429922489, props: { number: '87' } },
            { location: 0.09323134261959556, props: { number: '33' } },
            { location: 0.13258224625976378, props: { number: '90' } },
            { location: 0.3239674004938539, props: { number: '56' } },
            { location: 0.029673294290593576, props: { number: '3' } },
            { location: 0.20006222648127825, props: { number: '122' } },
            { location: 0.3239674004938539, props: { number: '58' } }
        ]
    };

    const res = Split.detectOutliers(cluster);
    t.deepEqual(ignored(res), [0, 1]);
    t.end();
});

//                                *
//                       *
//               *
//     *
//
//                          o
// TODO: some outliers can throw off best fit line when there aren't many points
test.skip('stray zeroes should be flagged', (t) => {
    const cluster = {
        addressPoints: [
            { location: 0.09354475973334028, props: { number: '0' } }, // outlier
            { location: 0.010333619581031826, props: { number: '19' } },
            { location: 0.006849378030106402, props: { number: '20' } },
            { location: 0.024768055805599272, props: { number: '21' } },
            { location: 0.02132440758078112, props: { number: '22' } },
            { location: 0.024951840172195667, props: { number: '23' } },
            { location: 0.03418280688869387, props: { number: '24' } },
            { location: 0.03495625143414758, props: { number: '25' } },
            { location: 0.047269104638038115, props: { number: '26' } },
            { location: 0.04684219054338793, props: { number: '27' } },
            { location: 0.06131010885676974, props: { number: '28' } },
            { location: 0.05597797994543892, props: { number: '29' } },
            { location: 0.07290279351497, props: { number: '30' } },
            { location: 0.06785598492794506, props: { number: '31' } },
            { location: 0.08142480959167546, props: { number: '33' } },
            { location: 0.08618079399003395, props: { number: '34' } },
            { location: 0.09209003801283681, props: { number: '35' } },
            { location: 0.10000499029719702, props: { number: '36' } }
        ]
    };

    const res = Split.detectOutliers(cluster);
    t.deepEqual(ignored(res), [0]);
    t.end();
});

//                    7xO
//
//                             *
//               *
//       *
// *
// TODO: some outliers can throw off best fit line when there aren't many points
test.skip('handle several copies of the same outlier', (t) => {
    const cluster = {
        addressPoints: [
            { location: 0, props: { number: 1 } },
            { location: 0.1, props: { number: 3 } },
            { location: 0.2, props: { number: 5 } },
            { location: 0.3, props: { number: 15 } },
            { location: 0.3, props: { number: 15 } },
            { location: 0.3, props: { number: 15 } },
            { location: 0.3, props: { number: 15 } },
            { location: 0.3, props: { number: 15 } },
            { location: 0.3, props: { number: 15 } },
            { location: 0.3, props: { number: 15 } },
            { location: 0.4, props: { number: 9 } }
        ]
    };

    const res = Split.detectOutliers(cluster);
    t.deepEqual(ignored(res), [3, 4, 5, 6, 7, 8, 9]);
    t.end();
});

//                        **
//
//
// *  *   *  *
//               *   *   *
// TODO: some outliers can throw off best fit line when there aren't many points
test.skip('points far from the best fit line should be flagged', (t) => {
    const cluster = {
        addressPoints: [
            { location: 0.19012525592073237, props: { number: '2a' } },
            { location: 0.18929580170249033, props: { number: '2' } },
            { location: 0.12945477479965736, props: { number: '3' } },
            { location: 0.18440497305884457, props: { number: '4a' } },
            { location: 0.18632155155796, props: { number: '4' } },
            { location: 0.10119769983315101, props: { number: '5' } },
            { location: 0.18015550672910965, props: { number: '6' } },
            { location: 0.18206888524759765, props: { number: '6a' } },
            { location: 0.1776483967498123, props: { number: '8a' } },
            { location: 0.17898189338857634, props: { number: '8' } },
            { location: 0.09412131156194395, props: { number: '9' } },
            { location: 0.1725862593193157, props: { number: '10' } },
            { location: 0.17535262052390316, props: { number: '10a' } },
            { location: 0.06353571558875562, props: { number: '11' } },
            { location: 0.16750425329261254, props: { number: '12a' } },
            { location: 0.16935543358861022, props: { number: '12' } },
            { location: 0.0820815365111388, props: { number: '13' } },
            { location: 0.16245926438433053, props: { number: '14' } },
            { location: 0.1649737805354896, props: { number: '14a' } },
            { location: 0.076381409770649, props: { number: '15' } },
            { location: 0.15618231551624356, props: { number: '16a' } },
            { location: 0.15847817275900514, props: { number: '16' } },
            { location: 0.15404010329049828, props: { number: '18a' } },
            { location: 0.15145820841110416, props: { number: '18' } },
            { location: 0.10751958666372176, props: { number: '19' } },
            { location: 0.140049210122322, props: { number: '19' } },
            { location: 0.14605940677098816, props: { number: '20a' } },
            { location: 0.14863619477849857, props: { number: '20' } },
            { location: 0.11420603727891653, props: { number: '21' } },
            { location: 0.15061327512189324, props: { number: '21' } },
            { location: 0.14271501786150206, props: { number: '22a' } },
            { location: 0.13866960731046132, props: { number: '22' } },
            { location: 0.20345260750541502, props: { number: '23' } },
            { location: 0.12724161377398543, props: { number: '24a' } },
            { location: 0.1320597298162582, props: { number: '24' } },
            { location: 0.2841268542095075, props: { number: '25' } },
            { location: 0.13510249300567545, props: { number: '26' } },
            { location: 0.283743212274982, props: { number: '27' } },
            { location: 0.12691656146605146, props: { number: '28' } },
            { location: 0.12611115625710684, props: { number: '28a' } },
            { location: 0.23209478429074187, props: { number: '29' } },
            { location: 0.12532443509275587, props: { number: '30' } },
            { location: 0.12487914804780073, props: { number: '30' } },
            { location: 0.12299773908684085, props: { number: '30a' } },
            { location: 0.12206232602557418, props: { number: '32' } },
            { location: 0.1210998467571074, props: { number: '34' } },
            { location: 0.11875082772180753, props: { number: '34a' } },
            { location: 0.11352163121192908, props: { number: '36' } },
            { location: 0.11065419313172976, props: { number: '38' } },
            { location: 0.10763336844865344, props: { number: '38a' } },
            { location: 0.10600507825305122, props: { number: '40' } },
            { location: 0.104364353504026, props: { number: '40a' } },
            { location: 0.32372845442149917, props: { number: '909' } }, // outlier
            { location: 0.3238195985724147, props: { number: '913' } } // outlier
        ]
    };

    const res = Split.detectOutliers(cluster);
    t.deepEqual(ignored(res), [52, 53]);
    t.end();
});

// even-odd edge cases

//               *    *
//             *   *
//           *  *
//          *
//       *
//    *
test('handle number variability betweeen evens and odd', (t) => {
    const cluster = {
        addressPoints: [
            { location: 0.026619776797833228, props: { number: '3' } },
            { location: 0.05645133703021328, props: { number: '5' } },
            { location: 0.07968366815223235, props: { number: '7' } },
            { location: 0.10293744726144194, props: { number: '8' } },
            { location: 0.11226117859779977, props: { number: '9' } },
            { location: 0.13236963794718054, props: { number: '10' } },
            { location: 0.1394675007195128, props: { number: '11' } },
            { location: 0.1733852926032369, props: { number: '12' } },
            { location: 0.1702531032468398, props: { number: '13' } },
            { location: 0.2251232406273126, props: { number: '14' } },
            { location: 0.2152967102721695, props: { number: '15' } },
            { location: 0.39575457414190907, props: { number: '16' } },
            { location: 0.24626523667959666, props: { number: '17' } },
            { location: 0.42513509093257024, props: { number: '18' } },
            { location: 0.2663522539404404, props: { number: '19' } },
            { location: 0.467807364200788, props: { number: '20' } },
            { location: 0.2781208699096889, props: { number: '21' } },
            { location: 0.29436563836604396, props: { number: '23' } },
            { location: 0.3118043290618646, props: { number: '25' } },
            { location: 0.34155629560401335, props: { number: '27' } },
            { location: 0.3691434176496209, props: { number: '29' } },
            { location: 0.4165216951397523, props: { number: '31' } },
            { location: 0.44997803967381317, props: { number: '33' } },
            { location: 0.4864773980680333, props: { number: '35' } }
        ]
    };

    const res = Split.detectOutliers(cluster);
    t.deepEqual(ignored(res), [11, 13]);
    t.end();
});

//                  *
//
//             *       *
//         *
//     *
// *
test('dont flag the last even and odd values even though they are far from the fit line.', (t) => {
    const cluster = {
        addressPoints: [
            { location: 0.015590717348232133, props: { number: '2' } },
            { location: 0.031149779702031564, props: { number: '4' } },
            { location: 0.03943497037096948, props: { number: '9' } },
            { location: 0.044876885689574535, props: { number: '12' } },
            { location: 0.055424910684773905, props: { number: '15' } },
            { location: 0.056732510689794236, props: { number: '16' } },
            { location: 0.06677632920623744, props: { number: '18' } },
            { location: 0.07001622465861924, props: { number: '21' } },
            { location: 0.07929558080356876, props: { number: '23' } },
            { location: 0.08199246203728905, props: { number: '24' } },
            { location: 0.10037421590667892, props: { number: '27' } },
            { location: 0.14937412125835903, props: { number: '28' } }, // outlier
            { location: 0.09719958864789276, props: { number: '30' } },
            { location: 0.11700084661465661, props: { number: '35' } },
            { location: 0.11665992916372941, props: { number: '37' } },
            { location: 0.12204668969147639, props: { number: '38' } },
            { location: 0.12898462887766826, props: { number: '39' } },
            { location: 0.12610414311154594, props: { number: '40' } },
            { location: 0.12915905920759013, props: { number: '41' } },
            { location: 0.13145373546426387, props: { number: '42' } },
            { location: 0.14553712286453813, props: { number: '45' } },
            { location: 0.17085032503562292, props: { number: '47' } },
            { location: 0.17096684093291328, props: { number: '60' } }
        ]
    };

    const res = Split.detectOutliers(cluster);
    t.deepEqual(ignored(res), [11]);
    t.end();
});

//                       *
//               *
//        *
// *
//                       *
//               *
//        *
// *
test('handle number variability between street sides', (t) => {
    const cluster = {
        addressPoints: [
            { location: 0.046982343061604086, props: { number: '49' } },
            { location: 0.0720359045385121, props: { number: '51' } },
            { location: 0.10011262795555968, props: { number: '53' } },
            { location: 0.12096217458052277, props: { number: '55' } },
            { location: 0.14839318629206885, props: { number: '57' } },
            { location: 0.16403085808010343, props: { number: '59' } },
            { location: 0.17788893191440833, props: { number: '61' } },
            { location: 0.19038164992617754, props: { number: '63' } },
            { location: 0.21503965777747577, props: { number: '65' } },
            { location: 0.024091052342478155, props: { number: '70' } },
            { location: 0.05080886980387892, props: { number: '72' } },
            { location: 0.07432060851672279, props: { number: '74' } },
            { location: 0.09917351309135028, props: { number: '76' } },
            { location: 0.12820026062088208, props: { number: '78' } },
            { location: 0.1681166669298657, props: { number: '80' } }
        ]
    };

    const res = Split.detectOutliers(cluster);
    t.deepEqual(ignored(res), []); // no outliers
    t.end();
});

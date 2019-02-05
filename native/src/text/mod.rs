use std::collections::HashMap;
use regex::Regex;

///
/// Remove all diacritics from the given string
///
/// Ported from: https://github.com/andrewrk/node-diacritics
///
fn diacritics(text: &String) -> String {
    lazy_static! {
        static ref HAS_DIACRITICS: Regex = Regex::new(r"[^\u0000-\u007e]").unwrap();

        static ref DIACRITICS: HashMap<char, &'static str> = {
            let mut m = HashMap::new();
            m.insert('\u{00a0}', " ");
            m.insert('\u{07c0}', "0");
            m.insert('\u{24b6}', "A");
            m.insert('\u{ff21}', "A");
            m.insert('\u{00c0}', "A");
            m.insert('\u{00c1}', "A");
            m.insert('\u{00c2}', "A");
            m.insert('\u{1ea6}', "A");
            m.insert('\u{1ea4}', "A");
            m.insert('\u{1eaa}', "A");
            m.insert('\u{1ea8}', "A");
            m.insert('\u{00c3}', "A");
            m.insert('\u{0100}', "A");
            m.insert('\u{0102}', "A");
            m.insert('\u{1eb0}', "A");
            m.insert('\u{1eae}', "A");
            m.insert('\u{1eb4}', "A");
            m.insert('\u{1eb2}', "A");
            m.insert('\u{0226}', "A");
            m.insert('\u{01e0}', "A");
            m.insert('\u{00c4}', "A");
            m.insert('\u{01de}', "A");
            m.insert('\u{1ea2}', "A");
            m.insert('\u{00c5}', "A");
            m.insert('\u{01fa}', "A");
            m.insert('\u{01cd}', "A");
            m.insert('\u{0200}', "A");
            m.insert('\u{0202}', "A");
            m.insert('\u{1ea0}', "A");
            m.insert('\u{1eac}', "A");
            m.insert('\u{1eb6}', "A");
            m.insert('\u{1e00}', "A");
            m.insert('\u{0104}', "A");
            m.insert('\u{023a}', "A");
            m.insert('\u{2c6f}', "A");
            m.insert('\u{a732}', "AA");
            m.insert('\u{00c6}', "AE");
            m.insert('\u{01fc}', "AE");
            m.insert('\u{01e2}', "AE");
            m.insert('\u{a734}', "AO");
            m.insert('\u{a736}', "AU");
            m.insert('\u{a738}', "AV");
            m.insert('\u{a73a}', "AV");
            m.insert('\u{a73c}', "AY");
            m.insert('\u{24b7}', "B");
            m.insert('\u{ff22}', "B");
            m.insert('\u{1e02}', "B");
            m.insert('\u{1e04}', "B");
            m.insert('\u{1e06}', "B");
            m.insert('\u{0243}', "B");
            m.insert('\u{0181}', "B");
            m.insert('\u{24b8}', "C");
            m.insert('\u{ff23}', "C");
            m.insert('\u{a73e}', "C");
            m.insert('\u{1e08}', "C");
            m.insert('\u{0106}', "C");
            m.insert('\u{0043}', "C");
            m.insert('\u{0108}', "C");
            m.insert('\u{010a}', "C");
            m.insert('\u{010c}', "C");
            m.insert('\u{00c7}', "C");
            m.insert('\u{0187}', "C");
            m.insert('\u{023b}', "C");
            m.insert('\u{24b9}', "D");
            m.insert('\u{ff24}', "D");
            m.insert('\u{1e0a}', "D");
            m.insert('\u{010e}', "D");
            m.insert('\u{1e0c}', "D");
            m.insert('\u{1e10}', "D");
            m.insert('\u{1e12}', "D");
            m.insert('\u{1e0e}', "D");
            m.insert('\u{0110}', "D");
            m.insert('\u{018a}', "D");
            m.insert('\u{0189}', "D");
            m.insert('\u{1d05}', "D");
            m.insert('\u{a779}', "D");
            m.insert('\u{00d0}', "Dh");
            m.insert('\u{01f1}', "DZ");
            m.insert('\u{01c4}', "DZ");
            m.insert('\u{01f2}', "Dz");
            m.insert('\u{01c5}', "Dz");
            m.insert('\u{025b}', "E");
            m.insert('\u{24ba}', "E");
            m.insert('\u{ff25}', "E");
            m.insert('\u{00c8}', "E");
            m.insert('\u{00c9}', "E");
            m.insert('\u{00ca}', "E");
            m.insert('\u{1ec0}', "E");
            m.insert('\u{1ebe}', "E");
            m.insert('\u{1ec4}', "E");
            m.insert('\u{1ec2}', "E");
            m.insert('\u{1ebc}', "E");
            m.insert('\u{0112}', "E");
            m.insert('\u{1e14}', "E");
            m.insert('\u{1e16}', "E");
            m.insert('\u{0114}', "E");
            m.insert('\u{0116}', "E");
            m.insert('\u{00cb}', "E");
            m.insert('\u{1eba}', "E");
            m.insert('\u{011a}', "E");
            m.insert('\u{0204}', "E");
            m.insert('\u{0206}', "E");
            m.insert('\u{1eb8}', "E");
            m.insert('\u{1ec6}', "E");
            m.insert('\u{0228}', "E");
            m.insert('\u{1e1c}', "E");
            m.insert('\u{0118}', "E");
            m.insert('\u{1e18}', "E");
            m.insert('\u{1e1a}', "E");
            m.insert('\u{0190}', "E");
            m.insert('\u{018e}', "E");
            m.insert('\u{1d07}', "E");
            m.insert('\u{a77c}', "F");
            m.insert('\u{24bb}', "F");
            m.insert('\u{ff26}', "F");
            m.insert('\u{1e1e}', "F");
            m.insert('\u{0191}', "F");
            m.insert('\u{a77b}', "F");
            m.insert('\u{24bc}', "G");
            m.insert('\u{ff27}', "G");
            m.insert('\u{01f4}', "G");
            m.insert('\u{011c}', "G");
            m.insert('\u{1e20}', "G");
            m.insert('\u{011e}', "G");
            m.insert('\u{0120}', "G");
            m.insert('\u{01e6}', "G");
            m.insert('\u{0122}', "G");
            m.insert('\u{01e4}', "G");
            m.insert('\u{0193}', "G");
            m.insert('\u{a7a0}', "G");
            m.insert('\u{a77d}', "G");
            m.insert('\u{a77e}', "G");
            m.insert('\u{0262}', "G");
            m.insert('\u{24bd}', "H");
            m.insert('\u{ff28}', "H");
            m.insert('\u{0124}', "H");
            m.insert('\u{1e22}', "H");
            m.insert('\u{1e26}', "H");
            m.insert('\u{021e}', "H");
            m.insert('\u{1e24}', "H");
            m.insert('\u{1e28}', "H");
            m.insert('\u{1e2a}', "H");
            m.insert('\u{0126}', "H");
            m.insert('\u{2c67}', "H");
            m.insert('\u{2c75}', "H");
            m.insert('\u{a78d}', "H");
            m.insert('\u{24be}', "I");
            m.insert('\u{ff29}', "I");
            m.insert('\u{00cc}', "I");
            m.insert('\u{00cd}', "I");
            m.insert('\u{00ce}', "I");
            m.insert('\u{0128}', "I");
            m.insert('\u{012a}', "I");
            m.insert('\u{012c}', "I");
            m.insert('\u{0130}', "I");
            m.insert('\u{00cf}', "I");
            m.insert('\u{1e2e}', "I");
            m.insert('\u{1ec8}', "I");
            m.insert('\u{01cf}', "I");
            m.insert('\u{0208}', "I");
            m.insert('\u{020a}', "I");
            m.insert('\u{1eca}', "I");
            m.insert('\u{012e}', "I");
            m.insert('\u{1e2c}', "I");
            m.insert('\u{0197}', "I");
            m.insert('\u{24bf}', "J");
            m.insert('\u{ff2a}', "J");
            m.insert('\u{0134}', "J");
            m.insert('\u{0248}', "J");
            m.insert('\u{0237}', "J");
            m.insert('\u{24c0}', "K");
            m.insert('\u{ff2b}', "K");
            m.insert('\u{1e30}', "K");
            m.insert('\u{01e8}', "K");
            m.insert('\u{1e32}', "K");
            m.insert('\u{0136}', "K");
            m.insert('\u{1e34}', "K");
            m.insert('\u{0198}', "K");
            m.insert('\u{2c69}', "K");
            m.insert('\u{a740}', "K");
            m.insert('\u{a742}', "K");
            m.insert('\u{a744}', "K");
            m.insert('\u{a7a2}', "K");
            m.insert('\u{24c1}', "L");
            m.insert('\u{ff2c}', "L");
            m.insert('\u{013f}', "L");
            m.insert('\u{0139}', "L");
            m.insert('\u{013d}', "L");
            m.insert('\u{1e36}', "L");
            m.insert('\u{1e38}', "L");
            m.insert('\u{013b}', "L");
            m.insert('\u{1e3c}', "L");
            m.insert('\u{1e3a}', "L");
            m.insert('\u{0141}', "L");
            m.insert('\u{023d}', "L");
            m.insert('\u{2c62}', "L");
            m.insert('\u{2c60}', "L");
            m.insert('\u{a748}', "L");
            m.insert('\u{a746}', "L");
            m.insert('\u{a780}', "L");
            m.insert('\u{01c7}', "LJ");
            m.insert('\u{01c8}', "Lj");
            m.insert('\u{24c2}', "M");
            m.insert('\u{ff2d}', "M");
            m.insert('\u{1e3e}', "M");
            m.insert('\u{1e40}', "M");
            m.insert('\u{1e42}', "M");
            m.insert('\u{2c6e}', "M");
            m.insert('\u{019c}', "M");
            m.insert('\u{03fb}', "M");
            m.insert('\u{a7a4}', "N");
            m.insert('\u{0220}', "N");
            m.insert('\u{24c3}', "N");
            m.insert('\u{ff2e}', "N");
            m.insert('\u{01f8}', "N");
            m.insert('\u{0143}', "N");
            m.insert('\u{00d1}', "N");
            m.insert('\u{1e44}', "N");
            m.insert('\u{0147}', "N");
            m.insert('\u{1e46}', "N");
            m.insert('\u{0145}', "N");
            m.insert('\u{1e4a}', "N");
            m.insert('\u{1e48}', "N");
            m.insert('\u{019d}', "N");
            m.insert('\u{a790}', "N");
            m.insert('\u{1d0e}', "N");
            m.insert('\u{01ca}', "NJ");
            m.insert('\u{01cb}', "Nj");
            m.insert('\u{24c4}', "O");
            m.insert('\u{ff2f}', "O");
            m.insert('\u{00d2}', "O");
            m.insert('\u{00d3}', "O");
            m.insert('\u{00d4}', "O");
            m.insert('\u{1ed2}', "O");
            m.insert('\u{1ed0}', "O");
            m.insert('\u{1ed6}', "O");
            m.insert('\u{1ed4}', "O");
            m.insert('\u{00d5}', "O");
            m.insert('\u{1e4c}', "O");
            m.insert('\u{022c}', "O");
            m.insert('\u{1e4e}', "O");
            m.insert('\u{014c}', "O");
            m.insert('\u{1e50}', "O");
            m.insert('\u{1e52}', "O");
            m.insert('\u{014e}', "O");
            m.insert('\u{022e}', "O");
            m.insert('\u{0230}', "O");
            m.insert('\u{00d6}', "O");
            m.insert('\u{022a}', "O");
            m.insert('\u{1ece}', "O");
            m.insert('\u{0150}', "O");
            m.insert('\u{01d1}', "O");
            m.insert('\u{020c}', "O");
            m.insert('\u{020e}', "O");
            m.insert('\u{01a0}', "O");
            m.insert('\u{1edc}', "O");
            m.insert('\u{1eda}', "O");
            m.insert('\u{1ee0}', "O");
            m.insert('\u{1ede}', "O");
            m.insert('\u{1ee2}', "O");
            m.insert('\u{1ecc}', "O");
            m.insert('\u{1ed8}', "O");
            m.insert('\u{01ea}', "O");
            m.insert('\u{01ec}', "O");
            m.insert('\u{00d8}', "O");
            m.insert('\u{01fe}', "O");
            m.insert('\u{0186}', "O");
            m.insert('\u{019f}', "O");
            m.insert('\u{a74a}', "O");
            m.insert('\u{a74c}', "O");
            m.insert('\u{0152}', "OE");
            m.insert('\u{01a2}', "OI");
            m.insert('\u{a74e}', "OO");
            m.insert('\u{0222}', "OU");
            m.insert('\u{24c5}', "P");
            m.insert('\u{ff30}', "P");
            m.insert('\u{1e54}', "P");
            m.insert('\u{1e56}', "P");
            m.insert('\u{01a4}', "P");
            m.insert('\u{2c63}', "P");
            m.insert('\u{a750}', "P");
            m.insert('\u{a752}', "P");
            m.insert('\u{a754}', "P");
            m.insert('\u{24c6}', "Q");
            m.insert('\u{ff31}', "Q");
            m.insert('\u{a756}', "Q");
            m.insert('\u{a758}', "Q");
            m.insert('\u{024a}', "Q");
            m.insert('\u{24c7}', "R");
            m.insert('\u{ff32}', "R");
            m.insert('\u{0154}', "R");
            m.insert('\u{1e58}', "R");
            m.insert('\u{0158}', "R");
            m.insert('\u{0210}', "R");
            m.insert('\u{0212}', "R");
            m.insert('\u{1e5a}', "R");
            m.insert('\u{1e5c}', "R");
            m.insert('\u{0156}', "R");
            m.insert('\u{1e5e}', "R");
            m.insert('\u{024c}', "R");
            m.insert('\u{2c64}', "R");
            m.insert('\u{a75a}', "R");
            m.insert('\u{a7a6}', "R");
            m.insert('\u{a782}', "R");
            m.insert('\u{24c8}', "S");
            m.insert('\u{ff33}', "S");
            m.insert('\u{1e9e}', "S");
            m.insert('\u{015a}', "S");
            m.insert('\u{1e64}', "S");
            m.insert('\u{015c}', "S");
            m.insert('\u{1e60}', "S");
            m.insert('\u{0160}', "S");
            m.insert('\u{1e66}', "S");
            m.insert('\u{1e62}', "S");
            m.insert('\u{1e68}', "S");
            m.insert('\u{0218}', "S");
            m.insert('\u{015e}', "S");
            m.insert('\u{2c7e}', "S");
            m.insert('\u{a7a8}', "S");
            m.insert('\u{a784}', "S");
            m.insert('\u{24c9}', "T");
            m.insert('\u{ff34}', "T");
            m.insert('\u{1e6a}', "T");
            m.insert('\u{0164}', "T");
            m.insert('\u{1e6c}', "T");
            m.insert('\u{021a}', "T");
            m.insert('\u{0162}', "T");
            m.insert('\u{1e70}', "T");
            m.insert('\u{1e6e}', "T");
            m.insert('\u{0166}', "T");
            m.insert('\u{01ac}', "T");
            m.insert('\u{01ae}', "T");
            m.insert('\u{023e}', "T");
            m.insert('\u{a786}', "T");
            m.insert('\u{00de}', "Th");
            m.insert('\u{a728}', "TZ");
            m.insert('\u{24ca}', "U");
            m.insert('\u{ff35}', "U");
            m.insert('\u{00d9}', "U");
            m.insert('\u{00da}', "U");
            m.insert('\u{00db}', "U");
            m.insert('\u{0168}', "U");
            m.insert('\u{1e78}', "U");
            m.insert('\u{016a}', "U");
            m.insert('\u{1e7a}', "U");
            m.insert('\u{016c}', "U");
            m.insert('\u{00dc}', "U");
            m.insert('\u{01db}', "U");
            m.insert('\u{01d7}', "U");
            m.insert('\u{01d5}', "U");
            m.insert('\u{01d9}', "U");
            m.insert('\u{1ee6}', "U");
            m.insert('\u{016e}', "U");
            m.insert('\u{0170}', "U");
            m.insert('\u{01d3}', "U");
            m.insert('\u{0214}', "U");
            m.insert('\u{0216}', "U");
            m.insert('\u{01af}', "U");
            m.insert('\u{1eea}', "U");
            m.insert('\u{1ee8}', "U");
            m.insert('\u{1eee}', "U");
            m.insert('\u{1eec}', "U");
            m.insert('\u{1ef0}', "U");
            m.insert('\u{1ee4}', "U");
            m.insert('\u{1e72}', "U");
            m.insert('\u{0172}', "U");
            m.insert('\u{1e76}', "U");
            m.insert('\u{1e74}', "U");
            m.insert('\u{0244}', "U");
            m.insert('\u{24cb}', "V");
            m.insert('\u{ff36}', "V");
            m.insert('\u{1e7c}', "V");
            m.insert('\u{1e7e}', "V");
            m.insert('\u{01b2}', "V");
            m.insert('\u{a75e}', "V");
            m.insert('\u{0245}', "V");
            m.insert('\u{a760}', "VY");
            m.insert('\u{24cc}', "W");
            m.insert('\u{ff37}', "W");
            m.insert('\u{1e80}', "W");
            m.insert('\u{1e82}', "W");
            m.insert('\u{0174}', "W");
            m.insert('\u{1e86}', "W");
            m.insert('\u{1e84}', "W");
            m.insert('\u{1e88}', "W");
            m.insert('\u{2c72}', "W");
            m.insert('\u{24cd}', "X");
            m.insert('\u{ff38}', "X");
            m.insert('\u{1e8a}', "X");
            m.insert('\u{1e8c}', "X");
            m.insert('\u{24ce}', "Y");
            m.insert('\u{ff39}', "Y");
            m.insert('\u{1ef2}', "Y");
            m.insert('\u{00dd}', "Y");
            m.insert('\u{0176}', "Y");
            m.insert('\u{1ef8}', "Y");
            m.insert('\u{0232}', "Y");
            m.insert('\u{1e8e}', "Y");
            m.insert('\u{0178}', "Y");
            m.insert('\u{1ef6}', "Y");
            m.insert('\u{1ef4}', "Y");
            m.insert('\u{01b3}', "Y");
            m.insert('\u{024e}', "Y");
            m.insert('\u{1efe}', "Y");
            m.insert('\u{24cf}', "Z");
            m.insert('\u{ff3a}', "Z");
            m.insert('\u{0179}', "Z");
            m.insert('\u{1e90}', "Z");
            m.insert('\u{017b}', "Z");
            m.insert('\u{017d}', "Z");
            m.insert('\u{1e92}', "Z");
            m.insert('\u{1e94}', "Z");
            m.insert('\u{01b5}', "Z");
            m.insert('\u{0224}', "Z");
            m.insert('\u{2c7f}', "Z");
            m.insert('\u{2c6b}', "Z");
            m.insert('\u{a762}', "Z");
            m.insert('\u{24d0}', "a");
            m.insert('\u{ff41}', "a");
            m.insert('\u{1e9a}', "a");
            m.insert('\u{00e0}', "a");
            m.insert('\u{00e1}', "a");
            m.insert('\u{00e2}', "a");
            m.insert('\u{1ea7}', "a");
            m.insert('\u{1ea5}', "a");
            m.insert('\u{1eab}', "a");
            m.insert('\u{1ea9}', "a");
            m.insert('\u{00e3}', "a");
            m.insert('\u{0101}', "a");
            m.insert('\u{0103}', "a");
            m.insert('\u{1eb1}', "a");
            m.insert('\u{1eaf}', "a");
            m.insert('\u{1eb5}', "a");
            m.insert('\u{1eb3}', "a");
            m.insert('\u{0227}', "a");
            m.insert('\u{01e1}', "a");
            m.insert('\u{00e4}', "a");
            m.insert('\u{01df}', "a");
            m.insert('\u{1ea3}', "a");
            m.insert('\u{00e5}', "a");
            m.insert('\u{01fb}', "a");
            m.insert('\u{01ce}', "a");
            m.insert('\u{0201}', "a");
            m.insert('\u{0203}', "a");
            m.insert('\u{1ea1}', "a");
            m.insert('\u{1ead}', "a");
            m.insert('\u{1eb7}', "a");
            m.insert('\u{1e01}', "a");
            m.insert('\u{0105}', "a");
            m.insert('\u{2c65}', "a");
            m.insert('\u{0250}', "a");
            m.insert('\u{0251}', "a");
            m.insert('\u{a733}', "aa");
            m.insert('\u{00e6}', "ae");
            m.insert('\u{01fd}', "ae");
            m.insert('\u{01e3}', "ae");
            m.insert('\u{a735}', "ao");
            m.insert('\u{a737}', "au");
            m.insert('\u{a739}', "av");
            m.insert('\u{a73b}', "av");
            m.insert('\u{a73d}', "ay");
            m.insert('\u{24d1}', "b");
            m.insert('\u{ff42}', "b");
            m.insert('\u{1e03}', "b");
            m.insert('\u{1e05}', "b");
            m.insert('\u{1e07}', "b");
            m.insert('\u{0180}', "b");
            m.insert('\u{0183}', "b");
            m.insert('\u{0253}', "b");
            m.insert('\u{0182}', "b");
            m.insert('\u{ff43}', "c");
            m.insert('\u{24d2}', "c");
            m.insert('\u{0107}', "c");
            m.insert('\u{0109}', "c");
            m.insert('\u{010b}', "c");
            m.insert('\u{010d}', "c");
            m.insert('\u{00e7}', "c");
            m.insert('\u{1e09}', "c");
            m.insert('\u{0188}', "c");
            m.insert('\u{023c}', "c");
            m.insert('\u{a73f}', "c");
            m.insert('\u{2184}', "c");
            m.insert('\u{24d3}', "d");
            m.insert('\u{ff44}', "d");
            m.insert('\u{1e0b}', "d");
            m.insert('\u{010f}', "d");
            m.insert('\u{1e0d}', "d");
            m.insert('\u{1e11}', "d");
            m.insert('\u{1e13}', "d");
            m.insert('\u{1e0f}', "d");
            m.insert('\u{0111}', "d");
            m.insert('\u{018c}', "d");
            m.insert('\u{0256}', "d");
            m.insert('\u{0257}', "d");
            m.insert('\u{018b}', "d");
            m.insert('\u{13e7}', "d");
            m.insert('\u{0501}', "d");
            m.insert('\u{a7aa}', "d");
            m.insert('\u{00f0}', "dh");
            m.insert('\u{01f3}', "dz");
            m.insert('\u{01c6}', "dz");
            m.insert('\u{24d4}', "e");
            m.insert('\u{ff45}', "e");
            m.insert('\u{00e8}', "e");
            m.insert('\u{00e9}', "e");
            m.insert('\u{00ea}', "e");
            m.insert('\u{1ec1}', "e");
            m.insert('\u{1ebf}', "e");
            m.insert('\u{1ec5}', "e");
            m.insert('\u{1ec3}', "e");
            m.insert('\u{1ebd}', "e");
            m.insert('\u{0113}', "e");
            m.insert('\u{1e15}', "e");
            m.insert('\u{1e17}', "e");
            m.insert('\u{0115}', "e");
            m.insert('\u{0117}', "e");
            m.insert('\u{00eb}', "e");
            m.insert('\u{1ebb}', "e");
            m.insert('\u{011b}', "e");
            m.insert('\u{0205}', "e");
            m.insert('\u{0207}', "e");
            m.insert('\u{1eb9}', "e");
            m.insert('\u{1ec7}', "e");
            m.insert('\u{0229}', "e");
            m.insert('\u{1e1d}', "e");
            m.insert('\u{0119}', "e");
            m.insert('\u{1e19}', "e");
            m.insert('\u{1e1b}', "e");
            m.insert('\u{0247}', "e");
            m.insert('\u{01dd}', "e");
            m.insert('\u{24d5}', "f");
            m.insert('\u{ff46}', "f");
            m.insert('\u{1e1f}', "f");
            m.insert('\u{0192}', "f");
            m.insert('\u{fb00}', "ff");
            m.insert('\u{fb01}', "fi");
            m.insert('\u{fb02}', "fl");
            m.insert('\u{fb03}', "ffi");
            m.insert('\u{fb04}', "ffl");
            m.insert('\u{24d6}', "g");
            m.insert('\u{ff47}', "g");
            m.insert('\u{01f5}', "g");
            m.insert('\u{011d}', "g");
            m.insert('\u{1e21}', "g");
            m.insert('\u{011f}', "g");
            m.insert('\u{0121}', "g");
            m.insert('\u{01e7}', "g");
            m.insert('\u{0123}', "g");
            m.insert('\u{01e5}', "g");
            m.insert('\u{0260}', "g");
            m.insert('\u{a7a1}', "g");
            m.insert('\u{a77f}', "g");
            m.insert('\u{1d79}', "g");
            m.insert('\u{24d7}', "h");
            m.insert('\u{ff48}', "h");
            m.insert('\u{0125}', "h");
            m.insert('\u{1e23}', "h");
            m.insert('\u{1e27}', "h");
            m.insert('\u{021f}', "h");
            m.insert('\u{1e25}', "h");
            m.insert('\u{1e29}', "h");
            m.insert('\u{1e2b}', "h");
            m.insert('\u{1e96}', "h");
            m.insert('\u{0127}', "h");
            m.insert('\u{2c68}', "h");
            m.insert('\u{2c76}', "h");
            m.insert('\u{0265}', "h");
            m.insert('\u{0195}', "hv");
            m.insert('\u{24d8}', "i");
            m.insert('\u{ff49}', "i");
            m.insert('\u{00ec}', "i");
            m.insert('\u{00ed}', "i");
            m.insert('\u{00ee}', "i");
            m.insert('\u{0129}', "i");
            m.insert('\u{012b}', "i");
            m.insert('\u{012d}', "i");
            m.insert('\u{00ef}', "i");
            m.insert('\u{1e2f}', "i");
            m.insert('\u{1ec9}', "i");
            m.insert('\u{01d0}', "i");
            m.insert('\u{0209}', "i");
            m.insert('\u{020b}', "i");
            m.insert('\u{1ecb}', "i");
            m.insert('\u{012f}', "i");
            m.insert('\u{1e2d}', "i");
            m.insert('\u{0268}', "i");
            m.insert('\u{0131}', "i");
            m.insert('\u{24d9}', "j");
            m.insert('\u{ff4a}', "j");
            m.insert('\u{0135}', "j");
            m.insert('\u{01f0}', "j");
            m.insert('\u{0249}', "j");
            m.insert('\u{24da}', "k");
            m.insert('\u{ff4b}', "k");
            m.insert('\u{1e31}', "k");
            m.insert('\u{01e9}', "k");
            m.insert('\u{1e33}', "k");
            m.insert('\u{0137}', "k");
            m.insert('\u{1e35}', "k");
            m.insert('\u{0199}', "k");
            m.insert('\u{2c6a}', "k");
            m.insert('\u{a741}', "k");
            m.insert('\u{a743}', "k");
            m.insert('\u{a745}', "k");
            m.insert('\u{a7a3}', "k");
            m.insert('\u{24db}', "l");
            m.insert('\u{ff4c}', "l");
            m.insert('\u{0140}', "l");
            m.insert('\u{013a}', "l");
            m.insert('\u{013e}', "l");
            m.insert('\u{1e37}', "l");
            m.insert('\u{1e39}', "l");
            m.insert('\u{013c}', "l");
            m.insert('\u{1e3d}', "l");
            m.insert('\u{1e3b}', "l");
            m.insert('\u{017f}', "l");
            m.insert('\u{0142}', "l");
            m.insert('\u{019a}', "l");
            m.insert('\u{026b}', "l");
            m.insert('\u{2c61}', "l");
            m.insert('\u{a749}', "l");
            m.insert('\u{a781}', "l");
            m.insert('\u{a747}', "l");
            m.insert('\u{026d}', "l");
            m.insert('\u{01c9}', "lj");
            m.insert('\u{24dc}', "m");
            m.insert('\u{ff4d}', "m");
            m.insert('\u{1e3f}', "m");
            m.insert('\u{1e41}', "m");
            m.insert('\u{1e43}', "m");
            m.insert('\u{0271}', "m");
            m.insert('\u{026f}', "m");
            m.insert('\u{24dd}', "n");
            m.insert('\u{ff4e}', "n");
            m.insert('\u{01f9}', "n");
            m.insert('\u{0144}', "n");
            m.insert('\u{00f1}', "n");
            m.insert('\u{1e45}', "n");
            m.insert('\u{0148}', "n");
            m.insert('\u{1e47}', "n");
            m.insert('\u{0146}', "n");
            m.insert('\u{1e4b}', "n");
            m.insert('\u{1e49}', "n");
            m.insert('\u{019e}', "n");
            m.insert('\u{0272}', "n");
            m.insert('\u{0149}', "n");
            m.insert('\u{a791}', "n");
            m.insert('\u{a7a5}', "n");
            m.insert('\u{043b}', "n");
            m.insert('\u{0509}', "n");
            m.insert('\u{01cc}', "nj");
            m.insert('\u{24de}', "o");
            m.insert('\u{ff4f}', "o");
            m.insert('\u{00f2}', "o");
            m.insert('\u{00f3}', "o");
            m.insert('\u{00f4}', "o");
            m.insert('\u{1ed3}', "o");
            m.insert('\u{1ed1}', "o");
            m.insert('\u{1ed7}', "o");
            m.insert('\u{1ed5}', "o");
            m.insert('\u{00f5}', "o");
            m.insert('\u{1e4d}', "o");
            m.insert('\u{022d}', "o");
            m.insert('\u{1e4f}', "o");
            m.insert('\u{014d}', "o");
            m.insert('\u{1e51}', "o");
            m.insert('\u{1e53}', "o");
            m.insert('\u{014f}', "o");
            m.insert('\u{022f}', "o");
            m.insert('\u{0231}', "o");
            m.insert('\u{00f6}', "o");
            m.insert('\u{022b}', "o");
            m.insert('\u{1ecf}', "o");
            m.insert('\u{0151}', "o");
            m.insert('\u{01d2}', "o");
            m.insert('\u{020d}', "o");
            m.insert('\u{020f}', "o");
            m.insert('\u{01a1}', "o");
            m.insert('\u{1edd}', "o");
            m.insert('\u{1edb}', "o");
            m.insert('\u{1ee1}', "o");
            m.insert('\u{1edf}', "o");
            m.insert('\u{1ee3}', "o");
            m.insert('\u{1ecd}', "o");
            m.insert('\u{1ed9}', "o");
            m.insert('\u{01eb}', "o");
            m.insert('\u{01ed}', "o");
            m.insert('\u{00f8}', "o");
            m.insert('\u{01ff}', "o");
            m.insert('\u{a74b}', "o");
            m.insert('\u{a74d}', "o");
            m.insert('\u{0275}', "o");
            m.insert('\u{0254}', "o");
            m.insert('\u{1d11}', "o");
            m.insert('\u{0153}', "oe");
            m.insert('\u{01a3}', "oi");
            m.insert('\u{a74f}', "oo");
            m.insert('\u{0223}', "ou");
            m.insert('\u{24df}', "p");
            m.insert('\u{ff50}', "p");
            m.insert('\u{1e55}', "p");
            m.insert('\u{1e57}', "p");
            m.insert('\u{01a5}', "p");
            m.insert('\u{1d7d}', "p");
            m.insert('\u{a751}', "p");
            m.insert('\u{a753}', "p");
            m.insert('\u{a755}', "p");
            m.insert('\u{03c1}', "p");
            m.insert('\u{24e0}', "q");
            m.insert('\u{ff51}', "q");
            m.insert('\u{024b}', "q");
            m.insert('\u{a757}', "q");
            m.insert('\u{a759}', "q");
            m.insert('\u{24e1}', "r");
            m.insert('\u{ff52}', "r");
            m.insert('\u{0155}', "r");
            m.insert('\u{1e59}', "r");
            m.insert('\u{0159}', "r");
            m.insert('\u{0211}', "r");
            m.insert('\u{0213}', "r");
            m.insert('\u{1e5b}', "r");
            m.insert('\u{1e5d}', "r");
            m.insert('\u{0157}', "r");
            m.insert('\u{1e5f}', "r");
            m.insert('\u{024d}', "r");
            m.insert('\u{027d}', "r");
            m.insert('\u{a75b}', "r");
            m.insert('\u{a7a7}', "r");
            m.insert('\u{a783}', "r");
            m.insert('\u{24e2}', "s");
            m.insert('\u{ff53}', "s");
            m.insert('\u{015b}', "s");
            m.insert('\u{1e65}', "s");
            m.insert('\u{015d}', "s");
            m.insert('\u{1e61}', "s");
            m.insert('\u{0161}', "s");
            m.insert('\u{1e67}', "s");
            m.insert('\u{1e63}', "s");
            m.insert('\u{1e69}', "s");
            m.insert('\u{0219}', "s");
            m.insert('\u{015f}', "s");
            m.insert('\u{023f}', "s");
            m.insert('\u{a7a9}', "s");
            m.insert('\u{a785}', "s");
            m.insert('\u{1e9b}', "s");
            m.insert('\u{0282}', "s");
            m.insert('\u{00df}', "ss");
            m.insert('\u{24e3}', "t");
            m.insert('\u{ff54}', "t");
            m.insert('\u{1e6b}', "t");
            m.insert('\u{1e97}', "t");
            m.insert('\u{0165}', "t");
            m.insert('\u{1e6d}', "t");
            m.insert('\u{021b}', "t");
            m.insert('\u{0163}', "t");
            m.insert('\u{1e71}', "t");
            m.insert('\u{1e6f}', "t");
            m.insert('\u{0167}', "t");
            m.insert('\u{01ad}', "t");
            m.insert('\u{0288}', "t");
            m.insert('\u{2c66}', "t");
            m.insert('\u{a787}', "t");
            m.insert('\u{00fe}', "th");
            m.insert('\u{a729}', "tz");
            m.insert('\u{24e4}', "u");
            m.insert('\u{ff55}', "u");
            m.insert('\u{00f9}', "u");
            m.insert('\u{00fa}', "u");
            m.insert('\u{00fb}', "u");
            m.insert('\u{0169}', "u");
            m.insert('\u{1e79}', "u");
            m.insert('\u{016b}', "u");
            m.insert('\u{1e7b}', "u");
            m.insert('\u{016d}', "u");
            m.insert('\u{00fc}', "u");
            m.insert('\u{01dc}', "u");
            m.insert('\u{01d8}', "u");
            m.insert('\u{01d6}', "u");
            m.insert('\u{01da}', "u");
            m.insert('\u{1ee7}', "u");
            m.insert('\u{016f}', "u");
            m.insert('\u{0171}', "u");
            m.insert('\u{01d4}', "u");
            m.insert('\u{0215}', "u");
            m.insert('\u{0217}', "u");
            m.insert('\u{01b0}', "u");
            m.insert('\u{1eeb}', "u");
            m.insert('\u{1ee9}', "u");
            m.insert('\u{1eef}', "u");
            m.insert('\u{1eed}', "u");
            m.insert('\u{1ef1}', "u");
            m.insert('\u{1ee5}', "u");
            m.insert('\u{1e73}', "u");
            m.insert('\u{0173}', "u");
            m.insert('\u{1e77}', "u");
            m.insert('\u{1e75}', "u");
            m.insert('\u{0289}', "u");
            m.insert('\u{24e5}', "v");
            m.insert('\u{ff56}', "v");
            m.insert('\u{1e7d}', "v");
            m.insert('\u{1e7f}', "v");
            m.insert('\u{028b}', "v");
            m.insert('\u{a75f}', "v");
            m.insert('\u{028c}', "v");
            m.insert('\u{a761}', "vy");
            m.insert('\u{24e6}', "w");
            m.insert('\u{ff57}', "w");
            m.insert('\u{1e81}', "w");
            m.insert('\u{1e83}', "w");
            m.insert('\u{0175}', "w");
            m.insert('\u{1e87}', "w");
            m.insert('\u{1e85}', "w");
            m.insert('\u{1e98}', "w");
            m.insert('\u{1e89}', "w");
            m.insert('\u{2c73}', "w");
            m.insert('\u{24e7}', "x");
            m.insert('\u{ff58}', "x");
            m.insert('\u{1e8b}', "x");
            m.insert('\u{1e8d}', "x");
            m.insert('\u{24e8}', "y");
            m.insert('\u{ff59}', "y");
            m.insert('\u{1ef3}', "y");
            m.insert('\u{00fd}', "y");
            m.insert('\u{0177}', "y");
            m.insert('\u{1ef9}', "y");
            m.insert('\u{0233}', "y");
            m.insert('\u{1e8f}', "y");
            m.insert('\u{00ff}', "y");
            m.insert('\u{1ef7}', "y");
            m.insert('\u{1e99}', "y");
            m.insert('\u{1ef5}', "y");
            m.insert('\u{01b4}', "y");
            m.insert('\u{024f}', "y");
            m.insert('\u{1eff}', "y");
            m.insert('\u{24e9}', "z");
            m.insert('\u{ff5a}', "z");
            m.insert('\u{017a}', "z");
            m.insert('\u{1e91}', "z");
            m.insert('\u{017c}', "z");
            m.insert('\u{017e}', "z");
            m.insert('\u{1e93}', "z");
            m.insert('\u{1e95}', "z");
            m.insert('\u{01b6}', "z");
            m.insert('\u{0225}', "z");
            m.insert('\u{0240}', "z");
            m.insert('\u{2c6c}', "z");
            m.insert('\u{a763}', "z");

            m
        };
    }

    if HAS_DIACRITICS.is_match(text) {
        let mut no_dia = String::new();

        for text_char in text.chars() {
             match DIACRITICS.get(&text_char) {
                 Some(replacement) => no_dia.push_str(replacement),
                 None => no_dia.push(text_char)
             }
        }

        no_dia
    } else {
        text.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remove_diacritics() {
        assert_eq!(diacritics(&String::from("Iлｔèｒｎåｔïｏｎɑｌíƶａｔï߀ԉ")), String::from("Internationalizati0n"));

        assert_eq!(diacritics(&String::from("Båｃòл íｐѕùｍ ðｏɭ߀ｒ ѕïｔ ａϻèｔ âùþê ａԉᏧ߀üïｌɭê ƃëéｆ ｃｕｌρá ｆïｌèｔ ϻｉǥｎòｎ ｃｕρｉᏧａｔａｔ ｕｔ êлｉｍ ｔòлɢùê.")), String::from("Bacon ipѕum dhol0r ѕit aMet authe and0uille beef culpa filet Mignon cupidatat ut enim tonGue."));

        assert_eq!(diacritics(&String::from("ᴎᴑᴅᴇȷʂ")), String::from("NoDEJs"));

        assert_eq!(diacritics(&String::from("hambúrguer")), String::from("hamburguer"));

        assert_eq!(diacritics(&String::from("hŒllœ")), String::from("hOElloe"));

        assert_eq!(diacritics(&String::from("Fußball")), String::from("Fussball"));

        assert_eq!(diacritics(&String::from("ABCDEFGHIJKLMNOPQRSTUVWXYZé")), String::from("ABCDEFGHIJKLMNOPQRSTUVWXYZe"));
    }
}
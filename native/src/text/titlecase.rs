use regex::Regex;

///
/// Titlecase input strings
///

const MINOR: [&str; 40] = [
    "a",
    "an",
    "and",
    "as",
    "at",
    "but",
    "by",
    "en",
    "for",
    "from",
    "how",
    "if",
    "in",
    "neither",
    "nor",
    "of",
    "on",
    "only",
    "onto",
    "out",
    "or",
    "per",
    "so",
    "than",
    "that",
    "the",
    "to",
    "until",
    "up",
    "upon",
    "v",
    "v.",
    "versus",
    "vs",
    "vs.",
    "via",
    "when",
    "with",
    "without",
    "yet"
];

pub fn titlecase(text: &String) -> String {
    lazy_static! {
        static ref WORD_BOUNDARY: Regex = Regex::new(r##"[\s\u2000-\u206F\u2E00-\u2E7F\\!"#$%&()*+,\-./:;<=>?@\[\]\^_{\|}~]+"##).unwrap();
    }

    let mut normalized = text.trim().to_lowercase();
    normalized = Regex::new(r"\s+").unwrap().replace_all(&normalized, " ").to_string();
    let mut new = String::new();
    while normalized.len() > 0 {
        match WORD_BOUNDARY.find(&normalized[..]) {
            None => {
                let word = &normalized[..];
                new.push_str(&capitalize(word));
                break;
            },
            Some(m) => {
                let word = &normalized[..m.start()];
                new.push_str(&capitalize(word));
                new.push_str(&m.as_str());
                normalized = String::from(&normalized[m.end()..]);
            }
        }
    }
    normalize_cardinals(&new)
}

fn capitalize(text: &str) -> String {
    if MINOR.contains(&text) {
        String::from(text)
    } else {
        text[0..1].to_uppercase() + &text[1..]
    }
}

fn normalize_cardinals(text: &String) -> String {
    lazy_static! {
        static ref CARDINAL: Regex = Regex::new(r"(?i)(?P<pre>.*\s)?(?P<cardinal>(n\.w\.|nw|n\.e\.|ne|s\.w\.|sw|s\.e\.|se))(?P<post>\s.*)?$").unwrap();
    }
    if CARDINAL.is_match(text) {
        let strpre: String = match CARDINAL.captures(text) {
            Some(capture) => match capture.name("pre") {
                Some(name) => name.as_str().to_string(),
                None => String::from("")
            },
            None => String::from("")
        };

        let cardinal: String = match CARDINAL.captures(text) {
            Some(capture) => match capture.name("cardinal") {
                Some(name) => name.as_str().to_uppercase().replace(".", ""),
                None => String::from("")
            },
            None => String::from("")
        };

        let strpost: String = match CARDINAL.captures(text) {
            Some(capture) => match capture.name("post") {
                Some(name) => name.as_str().to_string(),
                None => String::from("")
            },
            None => String::from("")
        };
        strpre + &cardinal + &strpost
    } else {
        text.to_owned()
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_titlecase() {
        assert_eq!(titlecase(&String::from("Väike-Sõjamäe")), String::from("Väike-Sõjamäe"));
        assert_eq!(titlecase(&String::from("Väike-sõjamäe")), String::from("Väike-Sõjamäe"));
        assert_eq!(titlecase(&String::from("väike-sõjamäe")), String::from("Väike-Sõjamäe"));
        assert_eq!(titlecase(&String::from("väike sõjamäe")), String::from("Väike Sõjamäe"));
        assert_eq!(titlecase(&String::from("väike  sõjamäe")), String::from("Väike Sõjamäe"));
        assert_eq!(titlecase(&String::from("Väike Sõjamäe")), String::from("Väike Sõjamäe"));
        assert_eq!(titlecase(&String::from("VäikeSõjamäe")), String::from("Väikesõjamäe"));
        assert_eq!(titlecase(&String::from("abra CAda -bra")), String::from("Abra Cada -Bra"));
        assert_eq!(titlecase(&String::from("abra-CAda-bra")), String::from("Abra-Cada-Bra"));
        assert_eq!(titlecase(&String::from("our lady of whatever")), String::from("Our Lady of Whatever"));
        assert_eq!(titlecase(&String::from("our lady OF whatever")), String::from("Our Lady of Whatever"));
        assert_eq!(titlecase(&String::from("St Martin\"s Neck Road")), String::from("St Martin\"S Neck Road"));
        assert_eq!(titlecase(&String::from("St Martin's Neck Road")), String::from("St Martin's Neck Road"));
        assert_eq!(titlecase(&String::from("MT. MOOSILAUKE HWY")), String::from("Mt. Moosilauke Hwy"));
        assert_eq!(titlecase(&String::from("some  miscellaneous rd (what happens to parentheses?)")), String::from("Some Miscellaneous Rd (What Happens to Parentheses?)"));
        assert_eq!(titlecase(&String::from("main st NE")), String::from("Main St NE"));
        assert_eq!(titlecase(&String::from("main St NW")), String::from("Main St NW"));
        assert_eq!(titlecase(&String::from("SW Main St.")), String::from("SW Main St."));
        assert_eq!(titlecase(&String::from("Main S.E. St")), String::from("Main SE St"));
        assert_eq!(titlecase(&String::from("main st ne")), String::from("Main St NE"));
        assert_eq!(titlecase(&String::from("nE. Main St")), String::from("Ne. Main St"));
    }
}

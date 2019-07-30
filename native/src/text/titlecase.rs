use regex::Regex;
use crate::Context;

///
/// Titlecase input strings
///

pub fn titlecase(text: &String, context: &Context) -> String {
    lazy_static! {
        static ref WORD_BOUNDARY: Regex = Regex::new(r#"[\s\u2000-\u206F\u2E00-\u2E7F\\!#$%&()"*+,\-./:;<=>?@\[\]\^_{\|}~]+"#).unwrap();
    }
    let mut text = text.trim().to_lowercase();
    text = Regex::new(r"\s+").unwrap().replace_all(&text, " ").to_string();
    let mut new = String::new();
    let mut word_count = 0;
    let mut last_match = 0;
    for mat in WORD_BOUNDARY.find_iter(&text[..]) {
        let word = &text[last_match..mat.start()];
        if word.len() > 0 {
            word_count = word_count + 1;
            new.push_str(&capitalize(word, word_count, context));
        }
        new.push_str(&mat.as_str());
        last_match = mat.end();
    }
    // any last words?
    if last_match < text.len() {
        let word = &text[last_match..];
        word_count = word_count + 1;
        new.push_str(&capitalize(word, word_count, context));
    }

    if context.country == String::from("US")
    || context.country == String::from("CA") {
        new = normalize_cardinals(&new)
    }

    new
}

pub fn capitalize(text: &str, word_count: usize, context: &Context) -> String {
    const MINOR_EN: [&str; 40] = [
        "a", "an", "and", "as", "at", "but", "by", "en", "for", "from", "how", "if", "in", "neither", "nor",
        "of", "on", "only", "onto", "out", "or", "per", "so", "than", "that", "the", "to", "until", "up",
        "upon", "v", "v.", "versus", "vs", "vs.", "via", "when", "with", "without", "yet"
    ];

    const MAJOR_EN: [&str; 2] = ["us", "dc"];

    const MINOR_DE: [&str; 1] = ["du"];

    if (context.country == String::from("US")
        || context.country == String::from("CA"))
        && MAJOR_EN.contains(&text) {
        return String::from(text).to_uppercase();
    }
    // don't apply lower casing to the first word in the string
    if word_count > 1 {
        if (context.country == String::from("US")
            || context.country == String::from("CA"))
            && MINOR_EN.contains(&text) {
            return String::from(text);
        } else if context.country == String::from("DE")
            && MINOR_DE.contains(&text) {
            return String::from(text);
        }
    }
    text[0..1].to_uppercase() + &text[1..]
}

pub fn normalize_cardinals(text: &String) -> String {
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
    use std::collections::HashMap;
    use crate::Tokens;

    #[test]
    fn test_titlecase() {
        let context = Context::new(String::from("us"), None, Tokens::new(HashMap::new()));

        assert_eq!(titlecase(&String::from("Väike-Sõjamäe"), &context), String::from("Väike-Sõjamäe"));
        assert_eq!(titlecase(&String::from("Väike-sõjamäe"), &context), String::from("Väike-Sõjamäe"));
        assert_eq!(titlecase(&String::from("väike-sõjamäe"), &context), String::from("Väike-Sõjamäe"));
        assert_eq!(titlecase(&String::from("väike sõjamäe"), &context), String::from("Väike Sõjamäe"));
        assert_eq!(titlecase(&String::from("väike  sõjamäe"), &context), String::from("Väike Sõjamäe"));
        assert_eq!(titlecase(&String::from("Väike Sõjamäe"), &context), String::from("Väike Sõjamäe"));
        assert_eq!(titlecase(&String::from("VäikeSõjamäe"), &context), String::from("Väikesõjamäe"));
        assert_eq!(titlecase(&String::from("abra CAda -bra"), &context), String::from("Abra Cada -Bra"));
        assert_eq!(titlecase(&String::from("abra-CAda-bra"), &context), String::from("Abra-Cada-Bra"));
        assert_eq!(titlecase(&String::from("our lady of whatever"), &context), String::from("Our Lady of Whatever"));
        assert_eq!(titlecase(&String::from("our lady OF whatever"), &context), String::from("Our Lady of Whatever"));
        assert_eq!(titlecase(&String::from("St Martin\"s Neck Road"), &context), String::from("St Martin\"S Neck Road"));
        assert_eq!(titlecase(&String::from("St Martin's Neck Road"), &context), String::from("St Martin's Neck Road"));
        assert_eq!(titlecase(&String::from("MT. MOOSILAUKE HWY"), &context), String::from("Mt. Moosilauke Hwy"));
        assert_eq!(titlecase(&String::from("some  miscellaneous rd (what happens to parentheses?)"), &context), String::from("Some Miscellaneous Rd (What Happens to Parentheses?)"));
        assert_eq!(titlecase(&String::from("main st NE"), &context), String::from("Main St NE"));
        assert_eq!(titlecase(&String::from("main St NW"), &context), String::from("Main St NW"));
        assert_eq!(titlecase(&String::from("SW Main St."), &context), String::from("SW Main St."));
        assert_eq!(titlecase(&String::from("Main S.E. St"), &context), String::from("Main SE St"));
        assert_eq!(titlecase(&String::from("main st ne"), &context), String::from("Main St NE"));
        assert_eq!(titlecase(&String::from("nE. Main St"), &context), String::from("Ne. Main St"));
        assert_eq!(titlecase(&String::from("us hwy 1"), &context), String::from("US Hwy 1"));
        assert_eq!(titlecase(&String::from(" -a nice road- "), &context), String::from("-A Nice Road-"));
        assert_eq!(titlecase(&String::from("-x"), &context), String::from("-X"));
        assert_eq!(titlecase(&String::from("x-"), &context), String::from("X-"));
        assert_eq!(titlecase(&String::from(" *$&#()__ "), &context), String::from("*$&#()__"));

        let context = Context::new(String::from("de"), None, Tokens::new(HashMap::new()));
        assert_eq!(titlecase(&String::from(" hast Du recht"), &context), String::from("Hast du Recht"));
        assert_eq!(titlecase(&String::from("a 9, 80939 münchen, germany"), &context), String::from("A 9, 80939 München, Germany"));
    }
}

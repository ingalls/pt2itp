use regex::Regex;
use unicode_segmentation::UnicodeSegmentation;
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

pub fn capitalize(word: &str, word_count: usize, context: &Context) -> String {
    const MINOR_EN: [&str; 40] = [
        "a", "an", "and", "as", "at", "but", "by", "en", "for", "from", "how", "if", "in", "neither", "nor",
        "of", "on", "only", "onto", "out", "or", "per", "so", "than", "that", "the", "to", "until", "up",
        "upon", "v", "v.", "versus", "vs", "vs.", "via", "when", "with", "without", "yet"
    ];

    const MAJOR_EN: [&str; 2] = ["us", "dc"];

    const MINOR_DE: [&str; 1] = ["du"];

    if (context.country == String::from("US")
        || context.country == String::from("CA"))
        && MAJOR_EN.contains(&word) {
        return String::from(word).to_uppercase();
    }
    // don't apply lower casing to the first word in the string
    if word_count > 1 {
        if (context.country == String::from("US")
            || context.country == String::from("CA"))
            && MINOR_EN.contains(&word) {
            return String::from(word);
        } else if context.country == String::from("DE")
            && MINOR_DE.contains(&word) {
            return String::from(word);
        }
    }

    let mut graphemes = UnicodeSegmentation::graphemes(word, true);
    let first_grapheme = match graphemes.next() {
        Some(g) => g,
        None => return String::from(word)
    };
    first_grapheme.to_uppercase() + graphemes.as_str()
}

pub fn normalize_cardinals(text: &str) -> String {
    lazy_static! {
        static ref CARDINAL: Regex = Regex::new(r"(?i)(^|\s)(?P<cardinal>(n\.w\.|nw|n\.e\.|ne|s\.w\.|sw|s\.e\.|se))(\s|$)").unwrap();
    }
    let output = match CARDINAL.captures(text) {
        Some(capture) => {
            match capture.name("cardinal") {
                Some(mat) => {
                    let cardinal = mat.as_str().to_uppercase().replace(".", "");
                    text[..mat.start()].to_string() + &cardinal + &text[mat.end()..]
                },
                None => text.to_string()
            }
        },
        None => text.to_string()
    };
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use crate::Tokens;

    #[test]
    fn test_titlecase() {
        let context = Context::new(String::from("us"), None, Tokens::new(HashMap::new(), HashMap::new()));

        assert_eq!(titlecase(&String::from("Väike-Sõjamäe"), &context), String::from("Väike-Sõjamäe"));
        assert_eq!(titlecase(&String::from("Väike-sõjamäe"), &context), String::from("Väike-Sõjamäe"));
        assert_eq!(titlecase(&String::from("väike-sõjamäe"), &context), String::from("Väike-Sõjamäe"));
        assert_eq!(titlecase(&String::from("väike sõjamäe"), &context), String::from("Väike Sõjamäe"));
        assert_eq!(titlecase(&String::from("väike  sõjamäe"), &context), String::from("Väike Sõjamäe"));
        assert_eq!(titlecase(&String::from("Väike Sõjamäe"), &context), String::from("Väike Sõjamäe"));
        assert_eq!(titlecase(&String::from("VäikeSõjamäe"), &context), String::from("Väikesõjamäe"));
        assert_eq!(titlecase(&String::from("ámbar"), &context), String::from("Ámbar"));
        assert_eq!(titlecase(&String::from("y̆ámbary̆"), &context), String::from("Y̆ámbary̆"));
        assert_eq!(titlecase(&String::from("y\u{306}ámbary\u{306}"), &context), String::from("Y\u{306}ámbary\u{306}"));
        assert_eq!(titlecase(&String::from("ç"), &context), String::from("Ç"));
        assert_eq!(titlecase(&String::from("Здравствуйте"), &context), String::from("Здравствуйте"));
        assert_eq!(titlecase(&String::from("नमस्त"), &context), String::from("नमस्त"));
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
        assert_eq!(titlecase(&String::from("BrandywiNE Street Northwest"), &context), String::from("Brandywine Street Northwest"));

        let context = Context::new(String::from("de"), None, Tokens::new(HashMap::new(), HashMap::new()));
        assert_eq!(titlecase(&String::from(" hast Du recht"), &context), String::from("Hast du Recht"));
        assert_eq!(titlecase(&String::from("a 9, 80939 münchen, germany"), &context), String::from("A 9, 80939 München, Germany"));
    }
}

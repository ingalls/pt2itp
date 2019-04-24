use regex::Regex;
use super::diacritics;
use std::collections::HashMap;

#[derive(Debug, PartialEq, Clone)]
pub struct Tokens {
    tokens: HashMap<String, String>
}

impl Tokens {
    pub fn new(tokens: HashMap<String, String>) -> Self {
        Tokens {
            tokens: tokens
        }
    }

    pub fn generate(mut tokens: Vec<Vec<String>>) -> Self {
        let mut map: HashMap<String, String> = HashMap::new();

        for group in tokens.iter_mut() {
            if group.len() == 0 {
                continue;
            } else if group.len() == 1 {
                map.insert(diacritics(&group[0].to_lowercase()), diacritics(&group[0].to_lowercase()));
            } else {
                group.sort_by(|a, b| {
                    if a.len() > b.len() {
                         std::cmp::Ordering::Greater
                    } else if a.len() < b.len() {
                         std::cmp::Ordering::Less
                    } else {
                         std::cmp::Ordering::Equal
                    }
                });

                let master = diacritics(&group[0].to_lowercase());

                for token in group.iter() {
                    if token != &master {
                        map.insert(diacritics(&token.to_lowercase()), master.clone());
                    }
                }
            }
        }

        Tokens {
            tokens: map
        }
    }

    pub fn process(&self, text: &String) -> (String, String) {
        let tokens = self.tokenize(&text);

        let mut tokenized: Vec<String> = Vec::with_capacity(tokens.len());
        let mut tokenless: Vec<String> = Vec::new();

        for token in tokens {
            match self.tokens.get(&token) {
                None => {
                    tokenized.push(token.clone());
                    tokenless.push(token);
                },
                Some(abbr) => {
                    tokenized.push(abbr.to_string());
                }
            };
        }

        (
            tokenized.join(" ").trim().to_string(),
            tokenless.join(" ").trim().to_string()
        )
    }

    ///
    /// Remove all diacritics, punctuation non-space whitespace
    /// returning a vector of component tokens
    ///
    fn tokenize(&self, text: &String) -> Vec<String> {
        lazy_static! {
            static ref UP: Regex = Regex::new(r"[\^]+").unwrap();

            // collapse apostraphes, periods
            static ref PUNC: Regex = Regex::new(r"[\u2018\u2019\u02BC\u02BB\uFF07'\.]").unwrap();

            // all other ascii and unicode punctuation except '-' per
            // http://stackoverflow.com/questions/4328500 split terms
            static ref SPACEPUNC: Regex = Regex::new(r#"[\u2000-\u206F\u2E00-\u2E7F\\'!"$#%&()*+,./:;<=>?@\[\]^_`{|}~-]"#).unwrap();

            static ref SPACE: Regex = Regex::new(r"\s+").unwrap();

            static ref IGNORE: Regex = Regex::new(r"(\d+)-(\d+)[a-z]?").unwrap();
        }

        let mut normalized = diacritics(&text.to_lowercase());

        normalized = UP.replace_all(normalized.as_str(), "").to_string();
        normalized = PUNC.replace_all(normalized.as_str(), "").to_string();
        normalized = SPACEPUNC.replace_all(normalized.as_str(), " ").to_string();
        normalized = SPACE.replace_all(normalized.as_str(), " ").to_string();

        let tokens: Vec<String> = normalized.split(" ").map(|split| {
            String::from(split)
        }).collect();

        tokens
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_remove_diacritics() {
        let tokens = Tokens::new(HashMap::new());

        // diacritics are removed from latin text
        assert_eq!(tokens.process(&String::from("Hérê àrë søme wöřdš, including diacritics and puncatuation!")).0, String::from("here are some words including diacritics and puncatuation"));

        // nothing happens to latin text
        assert_eq!(tokens.process(&String::from("Cranberries are low, creeping shrubs or vines up to 2 metres (7 ft)")).0, String::from("cranberries are low creeping shrubs or vines up to 2 metres 7 ft"));

        // nothing happens to Japanese text
        assert_eq!(tokens.process(&String::from("堪《たま》らん！」と片息《かたいき》になつて、喚《わめ》")).0, String::from("堪《たま》らん！」と片息《かたいき》になつて、喚《わめ》"));

        // greek diacritics are removed and other characters stay the same
        assert_eq!(tokens.process(&String::from("άΆέΈήΉίΊόΌύΎ αΑεΕηΗιΙοΟυΥ")).0, String::from("άάέέήήίίόόύύ ααεεηηιιοουυ"));

        // cyrillic diacritics are removed and other characters stay the same
        assert_eq!(tokens.process(&String::from("ўЎёЁѐЀґҐйЙ уУеЕеЕгГиИ")).0, String::from("ўўёёѐѐґґйй ууееееггии"));
    }

    #[test]
    fn test_tokenize() {
        let tokens = Tokens::new(HashMap::new());

        assert_eq!(tokens.process(&String::from("")).0, String::from(""));

        assert_eq!(tokens.process(&String::from("foo")).0, String::from("foo"));
        assert_eq!(tokens.process(&String::from("foo bar")).0, String::from("foo bar"));
        assert_eq!(tokens.process(&String::from("foo-bar")).0, String::from("foo bar"));
        assert_eq!(tokens.process(&String::from("foo+bar")).0, String::from("foo bar"));
        assert_eq!(tokens.process(&String::from("foo_bar")).0, String::from("foo bar"));
        assert_eq!(tokens.process(&String::from("foo:bar")).0, String::from("foo bar"));
        assert_eq!(tokens.process(&String::from("foo;bar")).0, String::from("foo bar"));
        assert_eq!(tokens.process(&String::from("foo|bar")).0, String::from("foo bar"));
        assert_eq!(tokens.process(&String::from("foo}bar")).0, String::from("foo bar"));
        assert_eq!(tokens.process(&String::from("foo{bar")).0, String::from("foo bar"));
        assert_eq!(tokens.process(&String::from("foo[bar")).0, String::from("foo bar"));
        assert_eq!(tokens.process(&String::from("foo]bar")).0, String::from("foo bar"));
        assert_eq!(tokens.process(&String::from("foo(bar")).0, String::from("foo bar"));
        assert_eq!(tokens.process(&String::from("foo)bar")).0, String::from("foo bar"));
        assert_eq!(tokens.process(&String::from("foo b.a.r")).0, String::from("foo bar"));
        assert_eq!(tokens.process(&String::from("foo's bar")).0, String::from("foos bar"));

        assert_eq!(tokens.process(&String::from("San José")).0, String::from("san jose"));
        assert_eq!(tokens.process(&String::from("A Coruña")).0, String::from("a coruna"));
        assert_eq!(tokens.process(&String::from("Chamonix-Mont-Blanc")).0, String::from("chamonix mont blanc"));
        assert_eq!(tokens.process(&String::from("Rue d'Argout")).0, String::from("rue dargout"));
        assert_eq!(tokens.process(&String::from("Hale’iwa Road")).0, String::from("haleiwa road"));
        assert_eq!(tokens.process(&String::from("москва")).0, String::from("москва"));
        assert_eq!(tokens.process(&String::from("京都市")).0, String::from("京都市"));
    }

    #[test]
    fn test_replacement_tokens() {
        let mut map: HashMap<String, String> = HashMap::new();
        map.insert(String::from("barter"), String::from("foo"));
        map.insert(String::from("saint"), String::from("st"));
        map.insert(String::from("street"), String::from("st"));

        let tokens = Tokens::new(map);

        assert_eq!(tokens.process(&String::from("Main Street")), (
            String::from("main st"),
            String::from("main")
        ));

        assert_eq!(tokens.process(&String::from("foobarter")), (
            String::from("foobarter"),
            String::from("foobarter")
        ));

        assert_eq!(tokens.process(&String::from("foo barter")), (
            String::from("foo foo"),
            String::from("foo")
        ));
    }
}

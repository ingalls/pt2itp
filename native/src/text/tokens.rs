use regex::Regex;
use super::diacritics;
use std::collections::HashMap;
use geocoder_abbreviations::{Token, TokenType};

#[derive(Debug, PartialEq, Clone)]
pub struct Tokens {
    tokens: Vec<Token>
}

impl Tokens {
    pub fn new(tokens: Vec<Token>) -> Self {
        Tokens {
            tokens: tokens
        }
    }

    pub fn generate(languages: Vec<String>) -> Self {
        let import: HashMap<String, Vec<Token>> = geocoder_abbreviations::config(languages).unwrap();
        let mut v = Vec::new();

        for language in import.keys() {
            for group in import.get(language).unwrap() {
                if group.regex.is_none() {
                    v.push(group.clone());
                }
            }
        }

        Tokens {
            tokens: v
        }
    }

    pub fn process(&self, text: &String) -> Vec<Tokenized> {
        let tokens = self.tokenize(&text);

        let mut tokenized: Vec<Tokenized> = Vec::with_capacity(tokens.len());

        for token in tokens {
            match self.tokens.iter().find(|&tk| {
                let tokens_lc: Vec<String> = tk.tokens.iter().map(|x| x.to_lowercase()).collect();
                tokens_lc.contains(&token.to_lowercase())
            }) {
                None => {
                    tokenized.push(Tokenized::new(token.to_lowercase().to_owned(), None));
                },
                Some(t) => {
                    tokenized.push(Tokenized::new(t.canonical.to_lowercase().to_owned(), t.token_type.to_owned()));
                }
            };
        }

        tokenized
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

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct Tokenized {
    pub token: String,
    pub token_type: Option<TokenType>
}

impl Tokenized {
    pub fn new(token: String, token_type: Option<TokenType>) -> Self {
        Tokenized {
            token,
            token_type
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tokenized_string(tokenized: Vec<Tokenized>) -> String {
        let tokens: Vec<String> = tokenized
            .into_iter()
            .map(|x| String::from(x.token))
            .collect();
        let token_string = String::from(tokens.join(" ").trim());
        token_string
    }

    #[test]
    fn test_remove_diacritics() {
        let tokens = Tokens::new(Vec::new());

        // diacritics are removed from latin text
        assert_eq!(tokenized_string(tokens.process(&String::from("Hérê àrë søme wöřdš, including diacritics and puncatuation!"))), String::from("here are some words including diacritics and puncatuation"));

        // nothing happens to latin text
        assert_eq!(tokenized_string(tokens.process(&String::from("Cranberries are low, creeping shrubs or vines up to 2 metres (7 ft)"))), String::from("cranberries are low creeping shrubs or vines up to 2 metres 7 ft"));

        // nothing happens to Japanese text
        assert_eq!(tokenized_string(tokens.process(&String::from("堪《たま》らん！」と片息《かたいき》になつて、喚《わめ》"))), String::from("堪《たま》らん！」と片息《かたいき》になつて、喚《わめ》"));

        // greek diacritics are removed and other characters stay the same
        assert_eq!(tokenized_string(tokens.process(&String::from("άΆέΈήΉίΊόΌύΎ αΑεΕηΗιΙοΟυΥ"))), String::from("άάέέήήίίόόύύ ααεεηηιιοουυ"));

        // cyrillic diacritics are removed and other characters stay the same
        assert_eq!(tokenized_string(tokens.process(&String::from("ўЎёЁѐЀґҐйЙ уУеЕеЕгГиИ"))), String::from("ўўёёѐѐґґйй ууееееггии"));
    }

    #[test]
    fn test_tokenize() {
        let tokens = Tokens::new(Vec::new());

        assert_eq!(tokenized_string(tokens.process(&String::from(""))), String::from(""));

        assert_eq!(tokenized_string(tokens.process(&String::from("foo"))), String::from("foo"));
        assert_eq!(tokenized_string(tokens.process(&String::from("foo bar"))), String::from("foo bar"));
        assert_eq!(tokenized_string(tokens.process(&String::from("foo-bar"))), String::from("foo bar"));
        assert_eq!(tokenized_string(tokens.process(&String::from("foo+bar"))), String::from("foo bar"));
        assert_eq!(tokenized_string(tokens.process(&String::from("foo_bar"))), String::from("foo bar"));
        assert_eq!(tokenized_string(tokens.process(&String::from("foo:bar"))), String::from("foo bar"));
        assert_eq!(tokenized_string(tokens.process(&String::from("foo;bar"))), String::from("foo bar"));
        assert_eq!(tokenized_string(tokens.process(&String::from("foo|bar"))), String::from("foo bar"));
        assert_eq!(tokenized_string(tokens.process(&String::from("foo}bar"))), String::from("foo bar"));
        assert_eq!(tokenized_string(tokens.process(&String::from("foo{bar"))), String::from("foo bar"));
        assert_eq!(tokenized_string(tokens.process(&String::from("foo[bar"))), String::from("foo bar"));
        assert_eq!(tokenized_string(tokens.process(&String::from("foo]bar"))), String::from("foo bar"));
        assert_eq!(tokenized_string(tokens.process(&String::from("foo(bar"))), String::from("foo bar"));
        assert_eq!(tokenized_string(tokens.process(&String::from("foo)bar"))), String::from("foo bar"));
        assert_eq!(tokenized_string(tokens.process(&String::from("foo b.a.r"))), String::from("foo bar"));
        assert_eq!(tokenized_string(tokens.process(&String::from("foo's bar"))), String::from("foos bar"));

        assert_eq!(tokenized_string(tokens.process(&String::from("San José"))), String::from("san jose"));
        assert_eq!(tokenized_string(tokens.process(&String::from("A Coruña"))), String::from("a coruna"));
        assert_eq!(tokenized_string(tokens.process(&String::from("Chamonix-Mont-Blanc"))), String::from("chamonix mont blanc"));
        assert_eq!(tokenized_string(tokens.process(&String::from("Rue d'Argout"))), String::from("rue dargout"));
        assert_eq!(tokenized_string(tokens.process(&String::from("Hale’iwa Road"))), String::from("haleiwa road"));
        assert_eq!(tokenized_string(tokens.process(&String::from("москва"))), String::from("москва"));
        assert_eq!(tokenized_string(tokens.process(&String::from("京都市"))), String::from("京都市"));
    }

    #[test]
    fn test_replacement_tokens() {
        let mut v: Vec<Token> = Vec::new();
        v.push(Token::new(String::from("barter"), String::from("foo"), None, false).unwrap());
        v.push(Token::new(String::from("saint"), String::from("st"), None, false).unwrap());
        v.push(Token::new(String::from("street"), String::from("st"), Some(TokenType::Way), false).unwrap());
        let tokens = Tokens::new(v);

        assert_eq!(tokens.process(&String::from("Main Street")),
            vec![
                Tokenized::new(String::from("main"), None),
                Tokenized::new(String::from("st"), Some(TokenType::Way))
            ]);

        assert_eq!(tokens.process(&String::from("Main St")),
            vec![
                Tokenized::new(String::from("main"), None),
                Tokenized::new(String::from("st"), None)
            ]);

        assert_eq!(tokens.process(&String::from("foobarter")),
            vec![Tokenized::new(String::from("foobarter"), None)]);

        assert_eq!(tokens.process(&String::from("foo barter")),
            vec![
                Tokenized::new(String::from("foo"), None),
                Tokenized::new(String::from("foo"), None)
            ]);
    }

    #[test]
    fn test_generate_tokens() {
        let tokens = Tokens::generate(vec![String::from("en")]);

        assert_eq!(tokens.process(&String::from("New Jersey Av NW")),
            vec![
                Tokenized::new(String::from("new"), None),
                Tokenized::new(String::from("jersey"), None),
                Tokenized::new(String::from("av"), Some(TokenType::Way)),
                Tokenized::new(String::from("nw"), Some(TokenType::Cardinal))
            ]);

        assert_eq!(tokens.process(&String::from("New Jersey Ave NW")),
            vec![
                Tokenized::new(String::from("new"), None),
                Tokenized::new(String::from("jersey"), None),
                Tokenized::new(String::from("av"), Some(TokenType::Way)),
                Tokenized::new(String::from("nw"), Some(TokenType::Cardinal))
            ]);

        assert_eq!(tokens.process(&String::from("New Jersey Avenue Northwest")),
            vec![
                Tokenized::new(String::from("new"), None),
                Tokenized::new(String::from("jersey"), None),
                Tokenized::new(String::from("av"), Some(TokenType::Way)),
                Tokenized::new(String::from("nw"), Some(TokenType::Cardinal))
            ]);
    }
}

use crate::text::{
    distance,
    is_numbered,
    is_routish
};

use crate::types::Names;
use geocoder_abbreviations::TokenType;

#[derive(Debug)]
pub struct Link<'a> {
    pub id: i64,
    pub maxscore: f64,
    pub names: &'a Names
}

impl<'a> Link<'a> {
    pub fn new(id: i64, names: &'a Names) -> Self {
        Link {
            id: id,
            maxscore: 0.0,
            names: names
        }
    }
}

#[derive(Debug, PartialEq)]
pub struct LinkResult {
    pub id: i64,
    pub score: f64
}

impl LinkResult {
    pub fn new(id: i64, score: f64) -> Self {
        LinkResult {
            id: id,
            score: score
        }
    }
}

///
/// Determines if there is a match between any of two given set of name values
/// Geometric proximity must be determined/filtered by the caller
///
/// The potentials input array should be ordered from most proximal to least
///
/// The linker module has two distinct modes controlled by the strict arg
///
/// # Strict Mode (strict: true)
///
/// Cardinal & Way Type must match in order for a primary to be able to match
/// to a given potential
///
/// IE:
///
/// North Main St cannot match South Main St
/// Main St cannot match Main Av
///
/// # Default Mode (strict: false)
///
/// Although exact matches are always prioritized, matches can fallback to
/// being matched with a slightly less desirable match, usually due to data
/// reasons.
///
pub fn linker(primary: Link, mut potentials: Vec<Link>, strict: bool) -> Option<LinkResult> {
    for name in &primary.names.names {
        let tokenized = name.tokenized_string();
        let tokenless = name.tokenless_string();

        for potential in potentials.iter_mut() {
            'outer: for potential_name in &potential.names.names {
                // Ensure exact matches are always returned before potential short-circuits
                //
                // N Main St == N Main St
                if name.tokenized == potential_name.tokenized {
                    return Some(LinkResult::new(potential.id, 100.0));
                }

                let potential_tokenized = potential_name.tokenized_string();
                let potential_tokenless = potential_name.tokenless_string();

                if strict {
                    for tk in &name.tokenized {
                        match tk.token_type {
                            Some(TokenType::Cardinal) => {
                                if potential_name.has_type(Some(TokenType::Cardinal)) && !potential_name.tokenized.contains(tk) {
                                    continue 'outer;
                                }
                            },
                            Some(TokenType::Way) => {
                                if potential_name.has_type(Some(TokenType::Way)) && !potential_name.tokenized.contains(tk) {
                                    continue 'outer;
                                }
                            },
                            _ => ()
                        }
                    }
                } else {

                    // A cardinaled primary can exactly match a non-cardinaled potential
                    //
                    // N Main St => Main St
                    if
                        name.has_type(Some(TokenType::Cardinal))
                        && !potential_name.has_type(Some(TokenType::Cardinal))
                        && name.remove_type_string(Some(TokenType::Cardinal)) == potential_tokenized
                    {
                        return Some(LinkResult::new(potential.id, 100.0));
                    }
                }

                // Don't bother considering if the tokenless forms don't share a starting letter
                // this might require adjustment for countries with addresses that have leading tokens
                // which aren't properly stripped from the token list
                if !potential_tokenless.is_empty() && !tokenless.is_empty() && potential_tokenless.get(0..1) != tokenless.get(0..1) {
                    continue;
                }

                // Don't bother considering if both addr and network are a numbered street that
                // doesn't match (1st != 11th)
                let name_numbered = is_numbered(name);
                let name_routish = is_routish(name);
                if
                    (name_numbered.is_some() && name_numbered != is_numbered(potential_name))
                    || (name_routish.is_some() && name_routish != is_routish(potential_name))
                {
                    continue;
                }

                // Use a weighted average w/ the tokenless dist score if possible
                let mut lev_score: Option<f64> = None;

                if !tokenless.is_empty() && !potential_tokenless.is_empty() {
                    lev_score = Some((0.25 * distance(&tokenized, &potential_tokenized) as f64) + (0.75 * distance(&tokenless, &potential_tokenless) as f64));
                } else if (!tokenless.is_empty() && potential_tokenless.is_empty()) || (tokenless.is_empty() && !potential_tokenless.is_empty()) {
                    lev_score = Some(distance(&tokenized, &potential_tokenized) as f64);
                } else {

                    let atoks: Vec<String> = name.tokenized
                        .iter()
                        .map(|x| x.token.to_owned())
                        .collect();

                    let mut ntoks: Vec<String> = potential_name.tokenized
                        .iter()
                        .map(|x| x.token.to_owned())
                        .collect();

                    let ntoks_len = ntoks.len() as f64;

                    let mut a_match = 0;


                    for atok in &atoks {
                        // If there are dup tokens ensure they match a unique token ie Saint Street => st st != main st
                        let ntok_index = &ntoks.iter().position(|r| r == atok);

                        match ntok_index {
                            Some(index) => {
                                ntoks.remove(*index);
                                a_match = a_match + 1;
                            },
                            None => ()
                        };
                    }

                    if a_match as f64 / ntoks_len > 0.66 {
                        lev_score = Some(a_match as f64 / ntoks_len);
                    }

                    if lev_score.is_none() {
                        lev_score = Some(distance(&tokenized, &potential_tokenized) as f64);
                    }
                }

                let score = 100.0 - (((2.0 * lev_score.unwrap()) / (potential_tokenized.len() as f64 + tokenized.len() as f64)) * 100.0);

                if score > potential.maxscore {
                    potential.maxscore = score;
                }
            }
        }
    }

    // Calculate max score (score must be > 70% for us to return any matches)
    let mut max: Option<&Link> = None;
    for potential in potentials.iter() {
        match max {
            None => {
                max = Some(potential);
            },
            Some(current_max) => {
                if potential.maxscore > current_max.maxscore {
                    max = Some(potential);
                }
            }
        };
    }

    match max {
        Some(max) => {
            if max.maxscore > 70.0 {
                Some(LinkResult::new(max.id, (max.maxscore * 100.0).round() / 100.0))
            } else {
                None
            }
        },
        None => None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use crate::{Context, Tokens, Name, Names};
    use crate::text::ParsedToken;
    use geocoder_abbreviations::TokenType;

    #[test]
    fn test_linker() {
        let mut tokens: HashMap<String, ParsedToken> = HashMap::new();
        tokens.insert(String::from("saint"), ParsedToken::new(String::from("st"), None));
        tokens.insert(String::from("street"), ParsedToken::new(String::from("st"), Some(TokenType::Way)));
        tokens.insert(String::from("st"), ParsedToken::new(String::from("st"), Some(TokenType::Way)));
        tokens.insert(String::from("lake"), ParsedToken::new(String::from("lk"), None));
        tokens.insert(String::from("lk"), ParsedToken::new(String::from("lk"), None));
        tokens.insert(String::from("road"), ParsedToken::new(String::from("rd"), Some(TokenType::Way)));
        tokens.insert(String::from("rd"), ParsedToken::new(String::from("rd"), Some(TokenType::Way)));
        tokens.insert(String::from("avenue"), ParsedToken::new(String::from("ave"), Some(TokenType::Way)));
        tokens.insert(String::from("ave"), ParsedToken::new(String::from("ave"), Some(TokenType::Way)));
        tokens.insert(String::from("west"), ParsedToken::new(String::from("w"), Some(TokenType::Cardinal)));
        tokens.insert(String::from("east"), ParsedToken::new(String::from("e"), Some(TokenType::Cardinal)));
        tokens.insert(String::from("south"), ParsedToken::new(String::from("s"), Some(TokenType::Cardinal)));
        tokens.insert(String::from("north"), ParsedToken::new(String::from("n"), Some(TokenType::Cardinal)));
        tokens.insert(String::from("northwest"), ParsedToken::new(String::from("nw"), Some(TokenType::Cardinal)));
        tokens.insert(String::from("nw"), ParsedToken::new(String::from("nw"), Some(TokenType::Cardinal)));
        tokens.insert(String::from("n"), ParsedToken::new(String::from("n"), Some(TokenType::Cardinal)));
        tokens.insert(String::from("s"), ParsedToken::new(String::from("s"), Some(TokenType::Cardinal)));
        tokens.insert(String::from("w"), ParsedToken::new(String::from("w"), Some(TokenType::Cardinal)));
        tokens.insert(String::from("e"), ParsedToken::new(String::from("e"), Some(TokenType::Cardinal)));

        let context = Context::new(String::from("us"), None, Tokens::new(tokens));

        // === Intentional Matches ===
        // The following tests should match one of the given potential matches
        {
            let a_name = Names::new(vec![Name::new("S STREET NW", 0, None, &context)], &context);

            let b_name1 = Names::new(vec![Name::new("n capitol st", 0, None, &context)], &context);
            let b_name2 = Names::new(vec![Name::new("t st ne", 0, None, &context)], &context);
            let b_name3 = Names::new(vec![Name::new("todd pl ne", 0, None, &context)], &context);
            let b_name4 = Names::new(vec![Name::new("u st ne", 0, None, &context)], &context);
            let b_name5 = Names::new(vec![Name::new("v st ne", 0, None, &context)], &context);
            let b_name6 = Names::new(vec![Name::new("u st nw", 0, None, &context)], &context);
            let b_name7 = Names::new(vec![Name::new("t st nw", 0, None, &context)], &context);
            let b_name8 = Names::new(vec![Name::new("rhode is av ne", 0, None, &context)], &context);
            let b_name9 = Names::new(vec![Name::new("n capitol st ne", 0, None, &context)], &context);
            let b_name10 = Names::new(vec![Name::new("n capitol st nw", 0, None, &context)], &context);
            let b_name11 = Names::new(vec![Name::new("elm st nw", 0, None, &context)], &context);
            let b_name12 = Names::new(vec![Name::new("bates st nw", 0, None, &context)], &context);
            let b_name13 = Names::new(vec![Name::new("s st nw", 0, None, &context)], &context);
            let b_name14 = Names::new(vec![Name::new("rhode is av nw", 0, None, &context)], &context);
            let b_name15 = Names::new(vec![Name::new("r st nw", 0, None, &context)], &context);
            let b_name16 = Names::new(vec![Name::new("randolph pl ne", 0, None, &context)], &context);
            let b_name17 = Names::new(vec![Name::new("rt 1", 0, None, &context)], &context);
            let b_name18 = Names::new(vec![Name::new("lincoln rd ne", 0, None, &context)], &context);
            let b_name19 = Names::new(vec![Name::new("quincy pl ne", 0, None, &context)], &context);
            let b_name20 = Names::new(vec![Name::new("1st st nw", 0, None, &context)], &context);
            let b_name21 = Names::new(vec![Name::new("porter st ne", 0, None, &context)], &context);
            let b_name22 = Names::new(vec![Name::new("quincy pl nw", 0, None, &context)], &context);
            let b_name23 = Names::new(vec![Name::new("florida av ne", 0, None, &context)], &context);
            let b_name24 = Names::new(vec![Name::new("richardson pl nw", 0, None, &context)], &context);
            let b_name25 = Names::new(vec![Name::new("1st st ne", 0, None, &context)], &context);
            let b_name26 = Names::new(vec![Name::new("q st ne", 0, None, &context)], &context);
            let b_name27 = Names::new(vec![Name::new("florida av nw", 0, None, &context)], &context);
            let b_name28 = Names::new(vec![Name::new("p st ne", 0, None, &context)], &context);
            let b_name29 = Names::new(vec![Name::new("s st ne", 0, None, &context)], &context);
            let b_name30 = Names::new(vec![Name::new("r st ne", 0, None, &context)], &context);
            let b_name31 = Names::new(vec![Name::new("seaton pl ne", 0, None, &context)], &context);
            let b_name32 = Names::new(vec![Name::new("randolph pl nw", 0, None, &context)], &context);
            let b_name33 = Names::new(vec![Name::new("anna j cooper cir nw", 0, None, &context)], &context);
            let b_name34 = Names::new(vec![Name::new("p st nw", 0, None, &context)], &context);
            let b_name35 = Names::new(vec![Name::new("q st nw", 0, None, &context)], &context);
            let b_name36 = Names::new(vec![Name::new("4th st nw", 0, None, &context)], &context);
            let b_name37 = Names::new(vec![Name::new("v st nw", 0, None, &context)], &context);
            let b_name38 = Names::new(vec![Name::new("3rd st nw", 0, None, &context)], &context);
            let b_name39 = Names::new(vec![Name::new("seaton pl nw", 0, None, &context)], &context);
            let b_name40 = Names::new(vec![Name::new("flagler pl nw", 0, None, &context)], &context);
            let b_name41 = Names::new(vec![Name::new("2nd st nw", 0, None, &context)], &context);
            let b_name42 = Names::new(vec![Name::new("thomas st nw", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![
                Link::new(2, &b_name1),
                Link::new(3, &b_name2),
                Link::new(4, &b_name3),
                Link::new(5, &b_name4),
                Link::new(6, &b_name5),
                Link::new(7, &b_name6),
                Link::new(8, &b_name7),
                Link::new(9, &b_name8),
                Link::new(10, &b_name9),
                Link::new(11, &b_name10),
                Link::new(12, &b_name11),
                Link::new(13, &b_name12),
                Link::new(14, &b_name13),
                Link::new(15, &b_name14),
                Link::new(16, &b_name15),
                Link::new(17, &b_name16),
                Link::new(18, &b_name17),
                Link::new(19, &b_name18),
                Link::new(20, &b_name19),
                Link::new(21, &b_name20),
                Link::new(22, &b_name21),
                Link::new(23, &b_name22),
                Link::new(24, &b_name23),
                Link::new(25, &b_name24),
                Link::new(26, &b_name25),
                Link::new(27, &b_name26),
                Link::new(28, &b_name27),
                Link::new(29, &b_name28),
                Link::new(30, &b_name29),
                Link::new(31, &b_name30),
                Link::new(32, &b_name31),
                Link::new(33, &b_name32),
                Link::new(34, &b_name33),
                Link::new(35, &b_name34),
                Link::new(36, &b_name35),
                Link::new(37, &b_name36),
                Link::new(38, &b_name37),
                Link::new(39, &b_name38),
                Link::new(40, &b_name39),
                Link::new(41, &b_name40),
                Link::new(42, &b_name41),
                Link::new(43, &b_name42)
            ];
            assert_eq!(linker(a, b, false), Some(LinkResult::new(14, 100.0)));
        }

        /*
         * | Umpqua St
         * |
         * | . (N Umpqua St)
         * | . (N Unpqua St)
         * | S Umpqua St
         * | . (S Umpqua St)
         *
         * Cardinaled addresses should match a proximal non-cardinaled street
         * before they are matched againts a further away mismatched cardinal street
         *
         * In the above example (N Umpsqua St) should always match Umpqua St
         * and not S Umpqua St (previous behavior)
         */
        {
            let a_name = Names::new(vec![Name::new("N Umpqua St", 0, None, &context)], &context);

            let b_1_name = Names::new(vec![Name::new("Umpqua Street", 0, None, &context)], &context);
            let b_2_name = Names::new(vec![Name::new("South Umpqua Street", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![
                Link::new(2, &b_1_name),
                Link::new(3, &b_2_name)
            ];
            assert_eq!(linker(a, b, false), Some(LinkResult::new(2, 100.0)));
        }

        {
            let a_name = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);
            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, false), Some(LinkResult::new(2, 100.0)));
        }

        {
            let a_name = Names::new(vec![Name::new("Saint Peter Street", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("St Peter St", 0, None, &context)], &context);
            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, false), Some(LinkResult::new(2, 100.0)));
        }

        {
            let a_name = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("Maim Street", 0, None, &context)], &context);
            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, false), Some(LinkResult::new(2, 85.71)));
        }

        {
            let a_name = Names::new(vec![Name::new("US Route 50 East", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("US Route 50 West", 0, None, &context)], &context);
            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, false), Some(LinkResult::new(2, 98.08)));
        }

        {
            let a_name = Names::new(vec![Name::new("11th Street West", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("11th Avenue West", 0, None, &context)], &context);
            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, false), Some(LinkResult::new(2, 92.11)));
        }

        {
            let a_name = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);

            let b_name1 = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);
            let b_name2 = Names::new(vec![Name::new("Main Avenue", 0, None, &context)], &context);
            let b_name3 = Names::new(vec![Name::new("Main Road", 0, None, &context)], &context);
            let b_name4 = Names::new(vec![Name::new("Main Drive", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![
                Link::new(2, &b_name1),
                Link::new(3, &b_name2),
                Link::new(4, &b_name3),
                Link::new(5, &b_name4)
            ];
            assert_eq!(linker(a, b, false), Some(LinkResult::new(2, 100.0)));
        }

        {
            let a_name = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);

            let b_name1 = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);
            let b_name2 = Names::new(vec![Name::new("Asdg Street", 0, None, &context)], &context);
            let b_name3 = Names::new(vec![Name::new("Asdg Street", 0, None, &context)], &context);
            let b_name4 = Names::new(vec![Name::new("Maim Drive", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![
                Link::new(2, &b_name1),
                Link::new(3, &b_name2),
                Link::new(4, &b_name3),
                Link::new(5, &b_name4)
            ];
            assert_eq!(linker(a, b, false), Some(LinkResult::new(2, 100.0)));
        }

        {
            let a_name = Names::new(vec![Name::new("Ola Avenue", 0, None, &context)], &context);

            let b_name1 = Names::new(vec![Name::new("Ola", 0, None, &context)], &context);
            let b_name2 = Names::new(vec![Name::new("Ola Avg", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![
                Link::new(2, &b_name1),
                Link::new(3, &b_name2)
            ];
            assert_eq!(linker(a, b, false), Some(LinkResult::new(2, 80.0)));
        }

        {
            let a_name = Names::new(vec![Name::new("Avenue Street", 0, None, &context)], &context);

            let b_name1 = Names::new(vec![Name::new("Ave", 0, None, &context)], &context);
            let b_name2 = Names::new(vec![Name::new("Avenida", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![
                Link::new(2, &b_name1),
                Link::new(3, &b_name2)
            ];
            assert_eq!(linker(a, b, false), Some(LinkResult::new(2, 77.78)));
        }

        {
            let a_name = Names::new(vec![Name::new("Avenue Street", 0, None, &context)], &context);

            let b_name1 = Names::new(vec![Name::new("Avenue", 0, None, &context)], &context);
            let b_name2 = Names::new(vec![Name::new("Avenue", 0, None, &context)], &context);
            let b_name3 = Names::new(vec![Name::new("Avenida", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![
                Link::new(2, &b_name1),
                Link::new(3, &b_name2),
                Link::new(4, &b_name3)
            ];
            assert_eq!(linker(a, b, false), Some(LinkResult::new(2, 77.78)));
        }

        {
            let a_name = Names::new(vec![Name::new("Main Street West", 0, None, &context)], &context);

            let b_name1 = Names::new(vec![Name::new("Main Road", 0, None, &context)], &context);
            let b_name2 = Names::new(vec![Name::new("Main Avenue", 0, None, &context)], &context);
            let b_name3 = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![
                Link::new(2, &b_name1),
                Link::new(3, &b_name2),
                Link::new(4, &b_name3)
            ];
            assert_eq!(linker(a, b, false), Some(LinkResult::new(4, 100.0)));
        }

        {
            let a_name = Names::new(vec![Name::new("Lake Street West", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("West Lake Street", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, false), Some(LinkResult::new(2, 85.71)));
        }

        {
            let a_name = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);

            let b_name1 = Names::new(vec![Name::new("Maim Street", 0, None, &context)], &context);
            let b_name2 = Names::new(vec![Name::new("Maim Street", 0, None, &context)], &context);
            let b_name3 = Names::new(vec![Name::new("Cross Street", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![
                Link::new(2, &b_name1),
                Link::new(3, &b_name2),
                Link::new(4, &b_name3)
            ];
            assert_eq!(linker(a, b, false), Some(LinkResult::new(2, 85.71)));
        }

        {
            let a_name = Names::new(vec![Name::new("S Street NW", 0, None, &context)], &context);

            let b_name1 = Names::new(vec![Name::new("P Street Northeast", 0, None, &context)], &context);
            let b_name2 = Names::new(vec![Name::new("S Street NW", 0, None, &context)], &context);
            let b_name3 = Names::new(vec![Name::new("S Street NE", 0, None, &context)], &context);
            let b_name4 = Names::new(vec![Name::new("Bates Street NW", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![
                Link::new(2, &b_name1),
                Link::new(3, &b_name2),
                Link::new(4, &b_name3),
                Link::new(5, &b_name4)
            ];
            assert_eq!(linker(a, b, false), Some(LinkResult::new(3, 100.0)));
        }

        // === Intentional Non-Matches ===
        // The following tests should *NOT* match one of the given potential matches

        {
            let a_name = Names::new(vec![Name::new("1st Street West", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("2nd Street West", 0, None, &context)], &context);
            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, false), None);
        }

        {
            let a_name = Names::new(vec![Name::new("1st Street West", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("3rd Street West", 0, None, &context)], &context);
            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, false), None);
        }

        {
            let a_name = Names::new(vec![Name::new("1st Street West", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("4th Street West", 0, None, &context)], &context);
            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, false), None);
        }

        {
            let a_name = Names::new(vec![Name::new("11th Street West", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("21st Street West", 0, None, &context)], &context);
            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, false), None);
        }

        {
            let a_name = Names::new(vec![Name::new("US Route 60 East", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("US Route 51 West", 0, None, &context)], &context);
            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, false), None);
        }

        {
            let a_name = Names::new(vec![Name::new("West Main Street", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("West Saint Street", 0, None, &context)], &context);
            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, false), None);
        }

        {
            let a_name = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("Anne Boulevard", 0, None, &context)], &context);
            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, false), None);
        }

        // === Intentional Strict Matches ===
        // The following tests should match one of the given potential matches in strict mode

        {
            let a_name = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);

            let b_name = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);
            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, true), Some(LinkResult::new(2, 100.0)));
        }

        {
            let a_name = Names::new(vec![Name::new("Saint Peter Street", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("St Peter St", 0, None, &context)], &context);
            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, true), Some(LinkResult::new(2, 100.0)));
        }

        {
            let a_name = Names::new(vec![Name::new("Main Street West", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, true), Some(LinkResult::new(2, 93.75)));
        }

        {
            let a_name = Names::new(vec![Name::new("Main West", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("Main Street West", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, true), Some(LinkResult::new(2, 90.0)));
        }

        {
            let a_name = Names::new(vec![Name::new("Main", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, true), Some(LinkResult::new(2, 86.36)));
        }

        {
            let a_name = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("Main", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, true), Some(LinkResult::new(2, 86.36)));
        }

        {
            let a_name = Names::new(vec![Name::new("Main West", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("Main", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, true), Some(LinkResult::new(2, 90.0)));
        }

        {
            let a_name = Names::new(vec![Name::new("Lake Street West", 0, None, &context)], &context);
            let b_name1 = Names::new(vec![Name::new("West Lake Street", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name1)];
            assert_eq!(linker(a, b, true), Some(LinkResult::new(2, 85.71)));
        }

        {
            let a_name = Names::new(vec![Name::new("East Main", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, true), Some(LinkResult::new(2, 80.77)));
        }

        {
            let a_name = Names::new(vec![Name::new("East Main", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("Main North East", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, true), Some(LinkResult::new(2, 78.57)));
        }

        // === Intentional Strict Non-Matches ===
        // The following tests should *NOT* match one of the given potential matches in strict mode
        {
            let a_name = Names::new(vec![Name::new("US Route 50 East", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("US Route 50 West", 0, None, &context)], &context);
            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, true), None);
        }

        {
            let a_name = Names::new(vec![Name::new("West Main Street", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("West Saint Street", 0, None, &context)], &context);
            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, true), None);
        }

        {
            let a_name = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("Main Ave", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, true), None);
        }

        {
            let a_name = Names::new(vec![Name::new("East Main", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("West Main", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, true), None);
        }

        {
            let a_name = Names::new(vec![Name::new("East Main Street", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("West Main Street", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, true), None);
        }

        {
            let a_name = Names::new(vec![Name::new("Main Street Ave", 0, None, &context)], &context);
            let b_name = Names::new(vec![Name::new("Main Street", 0, None, &context)], &context);

            let a = Link::new(1, &a_name);
            let b = vec![Link::new(2, &b_name)];
            assert_eq!(linker(a, b, true), None);
        }

    }
}

use std::collections::HashMap;
use crate::{Context, text};
use crate::Tokenized;
use geocoder_abbreviations::TokenType;
use crate::text::titlecase;

///
/// InputName is only used internally to serialize a names array to the
/// Names type. It should not be used unless as an intermediary into or out of the Names type
///
#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct InputName {
    /// Street Name
    pub display: String,

    /// When choosing which street name is primary, order by priority
    pub priority: i8
}

impl From<Name> for InputName {
    fn from(name: Name) -> Self {
        InputName {
            display: name.display,
            priority: name.priority
        }
    }
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct Names {
    pub names: Vec<Name>
}

impl Names {
    pub fn new(names: Vec<Name>, context: &Context) -> Self {
        let mut names = Names {
            names: names
        };

        if names.names.len() == 0 {
            return names;
        }

        let mut synonyms: Vec<Name> = Vec::new();

        if context.country == String::from("US") {
            for name in names.names.iter_mut() {
                if name.source == Some(Source::Network) {
                    synonyms.append(&mut text::syn_number_suffix(&name, &context));
                    synonyms.append(&mut text::syn_written_numeric(&name, &context));
                    synonyms.append(&mut text::syn_state_hwy(&name, &context));
                    synonyms.append(&mut text::syn_us_hwy(&name, &context));
                    synonyms.append(&mut text::syn_us_cr(&name, &context));
                    synonyms.append(&mut text::syn_us_famous(&name, &context));

                    if context.region.is_some() && context.region.as_ref().unwrap() == "NY" {
                        synonyms.append(&mut text::syn_ny_beach(&name, &context));
                    }
                }
            }
        } else if context.country == String::from("CA") {
            for name in names.names.iter_mut() {
                if name.source == Some(Source::Network) {
                    synonyms.append(&mut text::syn_ca_hwy(&name, &context));

                    if context.region.is_some() && context.region.as_ref().unwrap() == "QC" {
                        synonyms.append(&mut text::syn_ca_french(&name, &context));
                    }
                }
            }
        }
        names.names.append(&mut synonyms);
        names.empty();
        names.sort();
        names.dedupe();

        names
    }

    pub fn from_input(names: Vec<InputName>, context: &Context) -> Self {
        let mut full_names: Vec<Name> = Vec::with_capacity(names.len());

        for name in names {
            full_names.push(Name::new(name.display, name.priority, None, &context));
        }

        Names::new(full_names, &context)
    }

    ///
    /// Parse a Names object from a serde_json value, returning
    /// an empty names vec if unparseable
    ///
    pub fn from_value(value: Option<serde_json::Value>, source: Option<Source>, context: &Context) -> Result<Self, String> {
        let names: Vec<Name> = match value {
            Some(street) => {
                let mut names: Vec<InputName> = if street.is_string() {
                    vec![InputName { display: street.as_str().unwrap().to_string(), priority: 0 }]
                } else {
                    match serde_json::from_value(street) {
                        Ok(street) => street,
                        Err(err) => { return Err(format!("Invalid Street Property: {}", err)); }
                    }
                };
                // network features must have a name with a higher priority than alternative names
                if source == Some(Source::Network) && names.len() > 1 {
                    if names[0].priority == names[1].priority {
                        panic!("1 network synonym must have greater priority: {:?}", names);
                    }
                }

                // lower the priority of names on address features
                if source == Some(Source::Address) {
                    for name in names.iter_mut() {
                        name.priority -= 1;
                    }
                }

                let names: Vec<Name> = names.into_iter().map(|name| {
                    Name::new(name.display, name.priority, source.clone(), &context)
                }).collect();

                names
            },
            None => Vec::new()
        };

        Ok(Names::new(names, &context))
    }

    ///
    /// Concatenate two Names structs
    /// Does not deduplicate existing names
    ///
    pub fn concat(&mut self, new_names: Names) {
        self.names.extend(new_names.names);
    }

    ///
    /// Test to see if the given names argument has synonyms
    /// that the self names object does not
    ///
    pub fn has_diff(&self, names: &Names) -> bool {
        let mut tokenized: HashMap<String, _> = HashMap::new();

        for self_name in self.names.iter() {
            tokenized.insert(self_name.tokenized_string(), ());
        }

        for name in names.names.iter() {
            if !tokenized.contains_key(&name.tokenized_string()) {
                return true;
            }
        }

        false
    }

    ///
    /// Dedupe a Names struct based on the tokenized version of each name.
    /// Names with the same priority and tokenized name will preference the dupliacate with the
    /// longest display name. This tries to prefence non-abbreviated synonyms where they exist,
    /// e.g. 'East Main Street' rather than 'E Main St'
    ///
    pub fn dedupe(&mut self) {
        struct Dedupe {
            name: Name,
            first_index: usize
        }
        impl Dedupe {
            fn new(name: Name, first_index: usize) -> Self {
                Dedupe {
                    name,
                    first_index
                }
            }
        }

        let mut tokenized: HashMap<String, Dedupe> = HashMap::new();
        let old_names: Vec<Name> = std::mem::replace(&mut self.names, Vec::new());

        for (i, name) in old_names.into_iter().enumerate() {
            match tokenized.get_mut(&name.tokenized_string()) {
                // if the tokenized name already exists
                Some(d) => {
                    // if the existing name is generated, don't overwrite
                    if d.name.source == Some(Source::Generated) {
                        continue;
                    // if the new name is generated or had a longer, potentially unabbreviated form,
                    // overwrite the entire Name, keeping the existing priority and freq values
                    } else if name.source == Some(Source::Generated) || name.display.len() > d.name.display.len() {
                        let priority = d.name.priority;
                        let freq = d.name.freq;
                        d.name = name;
                        d.name.priority = priority;
                        d.name.freq = freq;
                    }
                },
                // if it doesn't yet exist, add it
                None => {
                    tokenized.insert(name.tokenized_string(), Dedupe::new(name, i));
                }
            }
        }
        let mut names: Vec<Dedupe> = tokenized.into_iter().map(|(_,name)| name).collect();
        names.sort_by(|a, b| a.first_index.partial_cmp(&b.first_index).unwrap());
        names.into_iter().for_each(|d| self.names.push(d.name));
    }

    ///
    /// Sort Names struct by priority and frequency
    ///
    pub fn sort(&mut self) {
        self.names.sort_by(|a, b| {
            if a.priority > b.priority {
                std::cmp::Ordering::Less
            } else if a.priority < b.priority {
                std::cmp::Ordering::Greater
            } else {
                if a.freq > b.freq {
                    std::cmp::Ordering::Less
                } else if a.freq < b.freq {
                    std::cmp::Ordering::Greater
                } else {
                    std::cmp::Ordering::Equal
                }
            }
        });
    }

    ///
    /// Set the source on all the given names
    /// that don't have a source yet set
    ///
    pub fn set_source(&mut self, source: Option<Source>) {
        for name in self.names.iter_mut() {
            if name.source == None {
                name.source = source.clone();
            }
        }
    }

    ///
    /// Remove all Name instances where display is whitespace
    ///
    pub fn empty(&mut self) {
        self.names.retain(|name| name.display.trim() != String::from(""));
    }
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub struct Name {
    /// Street Name
    pub display: String,

    /// When choosing which street name is primary, order by priority
    pub priority: i8,

    /// Geometry Type of a given name (network/address/generated)
    pub source: Option<Source>,

    /// full token structure tokenless is derived from
    pub tokenized: Vec<Tokenized>,

    /// Frequency of the given name
    pub freq: i64
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub enum Source {
    Address,
    Network,
    Generated
}

impl Name {

    /// Returns a representation of a street name
    ///
    /// # Arguments
    ///
    /// * `display` - A string containing the street name (Main St)
    ///
    /// ```
    pub fn new(display: impl ToString, mut priority: i8, source: Option<Source>, context: &Context) -> Self {
        let mut display = display
            .to_string()
            .replace(r#"""#, "")
            .replace(r#","#, ""); // commas are not allowed as they are used to delimit synonyms on output

        // only title case non-generated names
        if source != Some(Source::Generated) {
            display = titlecase(&display, &context);
        }

        let tokenized = context.tokens.process(&display, &context.country);

        if context.country == String::from("US") || context.country == String::from("CA") {
            display = text::str_remove_octo(&display);
            // penalize less desireable street names
            if text::is_undesireable(&tokenized) {
                priority -= 1;
            }
        }

        Name {
            display: display,
            priority: priority,
            source: source,
            tokenized: tokenized,
            freq: 1
        }
    }

    ///
    /// Builder style source setter
    ///
    /// ie:
    /// Name::new().set_source(Some(Source::Generated))
    ///
    /// Can be chained with other builder functions
    ///
    pub fn set_source(mut self, source: Option<Source>) -> Self {
        self.source = source;
        self
    }

    ///
    /// Builder style source setter
    ///
    /// ie:
    /// Name::new().set_freq(1)
    ///
    /// Can be chained with other builder functions
    ///
    pub fn set_freq(mut self, freq: i64) -> Self {
        self.freq = freq;
        self
    }

    ///
    /// Tokenize the name object and return it as a string
    ///
    pub fn tokenized_string(&self) -> String {
        let tokens: Vec<String> = self.tokenized
            .iter()
            .map(|x| x.token.to_owned())
            .collect();

        let tokenized = String::from(tokens.join(" ").trim());

        tokenized
    }

    ///
    /// Return a String representation of a Name
    /// object with all known tokens removed
    ///
    /// IE:
    /// N Main St => Main
    ///
    pub fn tokenless_string(&self) -> String {
        let tokens: Vec<String> = self.tokenized
            .iter()
            .filter(|x| x.token_type.is_none())
            .map(|x| x.token.to_owned())
            .collect();
        let tokenless = String::from(tokens.join(" ").trim());

        tokenless
    }

    ///
    /// Remove instances of a given type from the Name type and return
    /// the remaining tokens as a String
    ///
    pub fn remove_type_string(&self, token_type: Option<TokenType>) -> String {
        let tokens: Vec<String> = self.tokenized
            .iter()
            .filter(|x| x.token_type != token_type)
            .map(|x| x.token.to_string())
            .collect();

        tokens.join(" ").trim().to_string()
    }

    ///
    /// Given a token type, return whether or not the Name object
    /// contains the given token
    ///
    pub fn has_type(&self, token_type: Option<TokenType>) -> bool {
        let tokens: Vec<&Tokenized> = self.tokenized
            .iter()
            .filter(|x| x.token_type == token_type)
            .collect();

        tokens.len() > 0
    }

}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use super::*;
    use std::collections::HashMap;
    use crate::Tokens;

    #[test]
    fn test_name() {
        let context = Context::new(String::from("us"), None, Tokens::new(HashMap::new()));

        assert_eq!(Name::new(String::from("main ST nw"), 0, None, &context), Name {
            display: String::from("Main St NW"),
            priority: 0,
            source: None,
            tokenized: vec![
                Tokenized::new(String::from("main"), None),
                Tokenized::new(String::from("st"), Some(TokenType::Way)),
                Tokenized::new(String::from("nw"), None)],
            freq: 1
        });

        assert_eq!(Name::new(String::from("HiGHway #12 \" wEST"), 0, None, &context), Name {
            display: String::from("Highway 12 West"),
            priority: 0,
            source: None,
            tokenized: vec![
                Tokenized::new(String::from("highway"), None),
                Tokenized::new(String::from("12"), None),
                Tokenized::new(String::from("west"), None)],
            freq: 1
        });

        assert_eq!(Name::new(String::from("\thighway #12 west ext 1\n"), -1, None, &context), Name {
            display: String::from("Highway 12 West Ext 1"),
            priority: -2,
            source: None,
            tokenized: vec![
                Tokenized::new(String::from("highway"), None),
                Tokenized::new(String::from("12"), None),
                Tokenized::new(String::from("west"), None),
                Tokenized::new(String::from("ext"), None),
                Tokenized::new(String::from("1"), None)],
            freq: 1
        });

        assert_eq!(Name::new(String::from("\""), 0, None, &context), Name {
            display: String::from(""),
            priority: 0,
            source: None,
            tokenized: vec![],
            freq: 1
        });

        assert_eq!(Name::new(String::from(","), 0, None, &context), Name {
            display: String::from(""),
            priority: 0,
            source: None,
            tokenized: vec![],
            freq: 1
        });
    }

    #[test]
    fn test_names_sort() {
        let context = Context::new(String::from("us"), None, Tokens::generate(vec![String::from("en")]));

        let mut names = Names {
            names: vec![
                Name::new(String::from("Highway 123"), -1, None, &context),
                Name::new(String::from("Route 123"), 2, None, &context),
                Name::new(String::from("Test 123"), 0, None, &context)
            ]
        };

        names.sort();

        let names_sorted = Names {
            names: vec![
                Name::new(String::from("Route 123"), 2, None, &context),
                Name::new(String::from("Test 123"), 0, None, &context),
                Name::new(String::from("Highway 123"), -1, None, &context)
            ]
        };

        assert_eq!(names, names_sorted);

        let mut names = Names {
            names: vec![
                Name::new(String::from("hwy 3"), -1, None, &context),
                Name::new(String::from("highway 3"), -1, None, &context),
                Name::new(String::from("hwy 2"), -1, None, &context).set_freq(2),
                Name::new(String::from("hwy 1"), -1, None, &context).set_freq(3),
                Name::new(String::from("hwy 1"), 1, None, &context)
            ]
        };

        names.sort();

        let names_sorted = Names {
            names: vec![
                Name::new(String::from("hwy 1"), 1, None, &context),
                Name::new(String::from("hwy 1"), -1, None, &context).set_freq(3),
                Name::new(String::from("hwy 2"), -1, None, &context).set_freq(2),
                Name::new(String::from("hwy 3"), -1, None, &context),
                Name::new(String::from("highway 3"), -1, None, &context),
            ]
        };

        assert_eq!(names, names_sorted);

    }

    #[test]
    fn test_names_concat() {
        let context = Context::new(String::from("us"), None, Tokens::new(HashMap::new()));

        let mut names = Names {
            names: vec![
                Name::new(String::from("Highway 123"), -1, None, &context),
                Name::new(String::from("Highway 123"), -1, None, &context)
            ]
        };

        let names2 = Names {
            names: vec![
                Name::new(String::from("Highway 123"), -1, None, &context)
            ]
        };

        names.concat(names2);

        // concat does not dedupe
        let names_concat = Names {
            names: vec![
                Name::new(String::from("Highway 123"), -1, None, &context),
                Name::new(String::from("Highway 123"), -1, None, &context),
                Name::new(String::from("Highway 123"), -1, None, &context)
            ]
        };

        assert_eq!(names, names_concat);
    }

    #[test]
    fn test_names_dedupe() {
        let context = Context::new(String::from("us"), None, Tokens::generate(vec![String::from("en")]));

        // deduping does not sort by priority and frequency-- must call .sort() first
        let mut names = Names {
            names: vec![
                Name::new(String::from("hwy 3"), -1, None, &context).set_freq(1),
                Name::new(String::from("highway 3"), -1, None, &context).set_freq(1),
                Name::new(String::from("hwy 2"), -1, None, &context).set_freq(1),
                Name::new(String::from("hwy 2"), -1, None, &context).set_freq(2),
                Name::new(String::from("hwy 1"), -1, None, &context),
                Name::new(String::from("hwy 1"), 1, None, &context)
            ]
        };
        names.dedupe();
        let names_deduped = Names {
            names: vec![
                Name::new(String::from("highway 3"), -1, None, &context).set_freq(1),
                Name::new(String::from("hwy 2"), -1, None, &context).set_freq(1),
                Name::new(String::from("hwy 1"), -1, None, &context)
            ]
        };
        assert_eq!(names, names_deduped);

        // Will only overwrite with a longer name if it's not generated
        let mut names = Names {
            names: vec![
                Name::new(String::from("E Main Street"), 0, Some(Source::Generated), &context),
                Name::new(String::from("East Main Street"), 0, None, &context),
                Name::new(String::from("E Main St"), 0, None, &context)
            ]
        };
        names.dedupe();
        let names_deduped = Names {
            names: vec![Name::new(String::from("E Main Street"), 0, Some(Source::Generated), &context)]
        };
        assert_eq!(names, names_deduped);


        // Will only overwrite with a longer name if it's not generated
        let mut names = Names {
            names: vec![
                Name::new(String::from("East Main Street"), 0, None, &context),
                Name::new(String::from("E Main St"), -1, None, &context),
                Name::new(String::from("E Main Street"), -1, Some(Source::Generated), &context)
            ]
        };
        names.dedupe();
        let names_deduped = Names {
            names: vec![Name::new(String::from("E Main Street"), 0, Some(Source::Generated), &context)]
        };
        assert_eq!(names, names_deduped);
    }

    #[test]
    fn test_names_from_value() {
        let context = Context::new(String::from("us"), None, Tokens::new(HashMap::new()));

        let expected = Names::new(vec![Name::new(String::from("Main St NE"), 0, Some(Source::Network), &context)], &context);

        assert_eq!(Names::from_value(Some(json!("Main St NE")), Some(Source::Network), &context).unwrap(), expected);

        assert_eq!(Names::from_value(Some(json!([{
            "display": "Main St NE",
            "priority": 0
        }])), Some(Source::Network), &context).unwrap(), expected);

        // Address features can have multiple names with the same priority
        // Names from address features should have a priority of -1
        let expected = Names::new(vec![Name::new(String::from("Main St NE"), -1, Some(Source::Address), &context)], &context);

        assert_eq!(Names::from_value(Some(json!("Main St NE")), Some(Source::Address), &context).unwrap(), expected);

        assert_eq!(Names::from_value(Some(json!([{
            "display": "Main St NE",
            "priority": 0
        }, {
            "display": "Main St NE",
            "priority": 0
        }])), Some(Source::Address), &context).unwrap(), expected);
    }

    #[test]
    #[should_panic(expected = "1 network synonym must have greater priority: [InputName { display: \"Main St\", priority: -1 }, InputName { display: \"E Main St\", priority: -1 }]")]
    fn test_names_from_value_invalid_priority() {
        let context = Context::new(String::from("us"), None, Tokens::new(HashMap::new()));

        let _names = Names::from_value(Some(json!([{
            "display": "Main St",
            "priority": -1
        }, {
            "display": "E Main St",
            "priority": -1
        }])), Some(Source::Network), &context);
    }


    #[test]
    fn test_names_has_diff() {
        let context = Context::new(String::from("us"), None, Tokens::new(HashMap::new()));

        let a_name = Names::new(vec![Name::new("Main St", 0, None, &context)], &context);
        let b_name = Names::new(vec![Name::new("Main St", 0, None, &context)], &context);
        assert_eq!(a_name.has_diff(&b_name), false);

        let a_name = Names::new(vec![Name::new("US Route 1", 0, None, &context)], &context);
        let b_name = Names::new(vec![Name::new("us route 1", 0, None, &context)], &context);
        assert_eq!(a_name.has_diff(&b_name), false);

        let a_name = Names::new(vec![Name::new("highway 1", 0, None, &context), Name::new("US Route 1", 0, None, &context)], &context);
        let b_name = Names::new(vec![Name::new("us route 1", 0, None, &context)], &context);
        assert_eq!(a_name.has_diff(&b_name), false);

        let a_name = Names::new(vec![Name::new("us route 1", 0, None, &context)], &context);
        let b_name = Names::new(vec![Name::new("highway 1", 0, None, &context), Name::new("US Route 1", 0, None, &context)], &context);
        assert_eq!(a_name.has_diff(&b_name), true);
    }

    #[test]
    fn test_names() {
        let mut context = Context::new(String::from("us"), None, Tokens::generate(vec![String::from("en")]));

        assert_eq!(Names::new(vec![], &context), Names {
            names: Vec::new()
        });

        assert_eq!(Names::new(vec![Name::new(String::from("Main St NW"), 0, None, &context)], &context), Names {
            names: vec![Name::new(String::from("Main St NW"), 0, None, &context)]
        });

        // Ensure invalid whitespace-only names are removed
        assert_eq!(Names::new(vec![Name::new(String::from(""), 0, None, &context), Name::new(String::from("\t  \n"), 0, None, &context)], &context), Names {
            names: Vec::new()
        });

        // Dedupe identical names
        assert_eq!(
            Names::new(
                vec![Name::new(String::from("Main Street"), 0, None, &context),
                    Name::new(String::from("Main Street"), 0, None, &context)],
                    &context),
            Names { names: vec![Name::new(String::from("Main Street"), 0, None, &context)]}
        );

        // Dedupe names with the same tokenized name and priority, preference longer display name
        assert_eq!(
            Names::new(
                vec![Name::new(String::from("Main St"), 0, None, &context),
                    Name::new(String::from("Main Street"), 0, None, &context),
                    Name::new(String::from("E Main St"), 0, None, &context),
                    Name::new(String::from("East Main Street"), 0, None, &context)],
                    &context),
            Names {
                names: vec![
                    Name::new(String::from("Main Street"), 0, None, &context),
                    Name::new(String::from("East Main Street"), 0, None, &context)
                ]}
        );

        // Dedupe names with the same tokenized name but different priorities, preference longer display name
        assert_eq!(
            Names::new(
                vec![Name::new(String::from("Main St"), 1, None, &context),
                    Name::new(String::from("Main Street"), 0, None, &context),
                    Name::new(String::from("E Main St"), 1, None, &context),
                    Name::new(String::from("East Main Street"), 0, None, &context)],
                    &context),
            Names {
                names: vec![
                    Name::new(String::from("Main Street"), 1, None, &context),
                    Name::new(String::from("East Main Street"), 1, None, &context)
                ]}
        );

        // Ensure synonyms are being applied correctly
        assert_eq!(Names::new(vec![Name::new(String::from("US Route 1"), 0, Some(Source::Network), &context)], &context), Names {
            names: vec![
                Name::new(String::from("US Route 1"), 1, Some(Source::Generated), &context),
                Name::new(String::from("US 1"), -1, Some(Source::Generated), &context),
                Name::new(String::from("US Highway 1"), -1, Some(Source::Generated), &context),
                Name::new(String::from("United States Route 1"), -1, Some(Source::Generated), &context),
                Name::new(String::from("United States Highway 1"), -1, Some(Source::Generated), &context)
            ]
        });

        // Ensure highway synonyms are being applied correctly but are downgraded
        // if the highway is not the highest priority name
        assert_eq!(Names::new(vec![
            Name::new(String::from("Main St"), 0, Some(Source::Network), &context),
            Name::new(String::from("US Route 1"), -1, Some(Source::Network), &context)
        ], &context), Names {
            names: vec![
                Name::new(String::from("Main St"), 0, Some(Source::Network), &context),
                Name::new(String::from("US Route 1"), -1, Some(Source::Generated), &context),
                Name::new(String::from("US 1"), -2, Some(Source::Generated), &context),
                Name::new(String::from("US Highway 1"), -2, Some(Source::Generated), &context),
                Name::new(String::from("United States Route 1"), -2, Some(Source::Generated), &context),
                Name::new(String::from("United States Highway 1"), -2, Some(Source::Generated), &context)
            ]
        });

        // Don't preference generated highway synonyms over local names if there are addresses
        // that match the lower priority network name in the cluster
        assert_eq!(Names::new(vec![
            Name::new(String::from("US Highway 1"), -1, Some(Source::Address), &context),
            Name::new(String::from("Main Street"), -1, Some(Source::Address), &context),
            Name::new(String::from("US Highway 1"), -1, Some(Source::Network), &context),
            Name::new(String::from("Main St"), 0, Some(Source::Network), &context)
        ], &context), Names {
            names: vec![
                Name::new(String::from("Main Street"), 0, Some(Source::Address), &context),
                Name::new(String::from("US Highway 1"), -1, Some(Source::Generated), &context),
                Name::new(String::from("US Route 1"), -1, Some(Source::Generated), &context),
                Name::new(String::from("US 1"), -2, Some(Source::Generated), &context),
                Name::new(String::from("United States Route 1"), -2, Some(Source::Generated), &context),
                Name::new(String::from("United States Highway 1"), -2, Some(Source::Generated), &context)
            ]
        });

        // @TODO remove, real world test case
        context = Context::new(String::from("us"), None, Tokens::generate(vec![String::from("en")]));

        assert_eq!(Names::new(vec![
            Name::new("NE M L King Blvd", -1, Some(Source::Address), &context).set_freq(1480),
            Name::new("NE MARTIN LUTHER KING JR BLVD", -1, Some(Source::Address), &context).set_freq(110),
            Name::new("NE M L KING BLVD", -1, Some(Source::Address), &context).set_freq(18),
            Name::new("SE M L King Blvd", -1, Some(Source::Address), &context).set_freq(7),
            Name::new("N M L King Blvd", -1, Some(Source::Address), &context).set_freq(3),
            Name::new("SE MARTIN LUTHER KING JR BLVD", -1, Some(Source::Address), &context).set_freq(2),
            Name::new("Northeast Martin Luther King Junior Boulevard", 0, Some(Source::Network), &context).set_freq(1),
            Name::new("NE MLK", -1, Some(Source::Network), &context).set_freq(1),
            Name::new("OR 99E", -1, Some(Source::Network), &context).set_freq(1),
            Name::new("State Highway 99E", -1, Some(Source::Network), &context).set_freq(1)
        ], &context), Names {
            names: vec![
                Name::new("Northeast Martin Luther King Jr Boulevard", 1, Some(Source::Generated), &context),
                Name::new("NE M L King Blvd", -1, Some(Source::Address), &context).set_freq(1480),
                Name::new("SE M L King Blvd", -1, Some(Source::Address), &context).set_freq(7),
                Name::new("N M L King Blvd", -1, Some(Source::Address), &context).set_freq(3),
                Name::new("SE Martin Luther King Jr Blvd", -1, Some(Source::Address), &context).set_freq(2),
                Name::new("NE MLK", -1, Some(Source::Generated), &context),
                Name::new("Or 99e", -1, Some(Source::Network), &context),
                Name::new("State Highway 99e", -1, Some(Source::Network), &context),
                Name::new("Northeast MLK Boulevard", -1, Some(Source::Generated), &context),
                Name::new("Northeast M L K Boulevard", -1, Some(Source::Generated), &context),
                Name::new("Northeast Martin Luther King Boulevard", -1, Some(Source::Generated), &context),
                Name::new("Northeast MLK Jr Boulevard", -1, Some(Source::Generated), &context),
                Name::new("Northeast M L K Jr Boulevard", -1, Some(Source::Generated), &context),
                Name::new("NE Martin Luther King Jr", -1, Some(Source::Generated), &context),
                Name::new("NE M L K", -2, Some(Source::Generated), &context),
                Name::new("NE Martin Luther King", -2, Some(Source::Generated), &context),
                Name::new("NE MLK Jr", -2, Some(Source::Generated), &context),
                Name::new("NE M L K Jr", -2, Some(Source::Generated), &context)
            ]
        });
    }

    #[test]
    fn test_tokenized_string() {
        let context = Context::new(String::from("us"), None, Tokens::generate(vec![String::from("en")]));

        assert_eq!(Name::new(String::from("Main St NW"), 0, None, &context).tokenized_string(),
            String::from("main st nw")
        );
        assert_eq!(Name::new(String::from("Main Street Northwest"), 0, None, &context).tokenized_string(),
            String::from("main st nw")
        );
    }

    #[test]
    fn test_tokenless_string() {
        let context = Context::new(String::from("us"), None, Tokens::generate(vec![String::from("en")]));

        assert_eq!(Name::new(String::from("Main St NW"), 0, None, &context).tokenless_string(),
            String::from("main")
        );
        assert_eq!(Name::new(String::from("Main Street Northwest"), 0, None, &context).tokenless_string(),
            String::from("main")
        );
        assert_eq!(Name::new(String::from("East College Road"), 0, None, &context).tokenless_string(),
            String::from("coll")
        );
    }

    #[test]
    fn test_remove_type_string() {
        let context = Context::new(String::from("us"), None, Tokens::generate(vec![String::from("en")]));

        assert_eq!(Name::new(String::from("Main St NW"), 0, None, &context).remove_type_string(Some(TokenType::Way)), String::from("main nw"));
        assert_eq!(Name::new(String::from("Main St NW"), 0, None, &context).remove_type_string(Some(TokenType::Cardinal)), String::from("main st"));
        assert_eq!(Name::new(String::from("Main St NW"), 0, None, &context).remove_type_string(None), String::from("st nw"));
        assert_eq!(Name::new(String::from("Main St NW"), 0, None, &context).remove_type_string(Some(TokenType::PostalBox)), String::from("main st nw"));
    }

    #[test]
    fn test_has_type() {
        let context = Context::new(String::from("us"), None, Tokens::generate(vec![String::from("en")]));

        assert_eq!(Name::new(String::from("Main St NW"), 0, None, &context).has_type(Some(TokenType::Way)), true);
        assert_eq!(Name::new(String::from("Main St NW"), 0, None, &context).has_type(Some(TokenType::Cardinal)), true);
        assert_eq!(Name::new(String::from("Main St NW"), 0, None, &context).has_type(None), true);
        assert_eq!(Name::new(String::from("Main St NW"), 0, None, &context).has_type(Some(TokenType::PostalBox)), false);

        assert_eq!(Name::new(String::from("foo bar"), 0, None, &context).has_type(Some(TokenType::Way)), false);
        assert_eq!(Name::new(String::from("foo bar"), 0, None, &context).has_type(Some(TokenType::Cardinal)), false);
        assert_eq!(Name::new(String::from("foo bar"), 0, None, &context).has_type(None), true);
    }

    #[test]
    fn test_empty() {
        let context = Context::new(String::from("us"), None, Tokens::new(HashMap::new()));

        let mut empty_a = Names::new(vec![Name::new(String::from(""), 0, None, &context)], &context);
        empty_a.empty();
        assert_eq!(empty_a, Names { names: Vec::new() });

        let mut empty_b = Names::new(vec![Name::new(String::from("\t  \n"), 0, None, &context)], &context);
        empty_b.empty();
        assert_eq!(empty_b, Names { names: Vec::new() });

        let mut empty_c = Names::new(vec![Name::new(String::from(""), 0, None, &context), Name::new(String::from("\t  \n"), 0, None, &context)], &context);
        empty_c.empty();
        assert_eq!(empty_c, Names { names: Vec::new() });
    }
}

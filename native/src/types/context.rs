use std::collections::HashMap;
use crate::text::Tokens;

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct InputContext {
    pub country: Option<String>,
    pub region: Option<String>,
    pub languages: Option<Vec<String>>
}

#[derive(Debug, PartialEq, Clone)]
pub struct Context {
    pub country: String,
    pub region: Option<String>,
    pub tokens: Tokens
}

impl From<InputContext> for Context {
    fn from(input: InputContext) -> Self {
        let country = input.country.unwrap_or(String::from(""));
        let region = input.region;
        let tokens = match input.languages {
            None => Tokens::new(HashMap::new(), HashMap::new()),
            Some(languages) => Tokens::generate(languages)
        };

        Context::new(country, region, tokens)
    }
}


impl Context {
    pub fn new(country: String, region: Option<String>, tokens: Tokens) -> Self {
        Context {
            country: country.to_uppercase(),
            region: match region {
                None => None,
                Some(region) => Some(region.to_uppercase())
            },
            tokens: tokens
        }
    }

    pub fn region_code(&self) -> Option<String> {
        match self.region {
            None => None,
            Some(ref region) => Some(format!("{}-{}", self.country, region))
        }
    }

    pub fn region_name(&self) -> Option<String> {
        lazy_static! {
            static ref REGIONS: HashMap<String, &'static str> = {
                let mut m = HashMap::new();

                m.insert(String::from("US-AL"), "Alabama");
                m.insert(String::from("US-AK"), "Alaska");
                m.insert(String::from("US-AZ"), "Arizona");
                m.insert(String::from("US-AR"), "Arkansas");
                m.insert(String::from("US-CA"), "California");
                m.insert(String::from("US-CO"), "Colorado");
                m.insert(String::from("US-CT"), "Connecticut");
                m.insert(String::from("US-DE"), "Delaware");
                m.insert(String::from("US-FL"), "Florida");
                m.insert(String::from("US-GA"), "Georgia");
                m.insert(String::from("US-HI"), "Hawaii");
                m.insert(String::from("US-ID"), "Idaho");
                m.insert(String::from("US-IL"), "Illinois");
                m.insert(String::from("US-IN"), "Indiana");
                m.insert(String::from("US-IA"), "Iowa");
                m.insert(String::from("US-KS"), "Kansas");
                m.insert(String::from("US-KY"), "Kentucky");
                m.insert(String::from("US-LA"), "Louisiana");
                m.insert(String::from("US-ME"), "Maine");
                m.insert(String::from("US-MD"), "Maryland");
                m.insert(String::from("US-MA"), "Massachusetts");
                m.insert(String::from("US-MI"), "Michigan");
                m.insert(String::from("US-MN"), "Minnesota");
                m.insert(String::from("US-MS"), "Mississippi");
                m.insert(String::from("US-MO"), "Missouri");
                m.insert(String::from("US-MT"), "Montana");
                m.insert(String::from("US-NE"), "Nebraska");
                m.insert(String::from("US-NV"), "Nevada");
                m.insert(String::from("US-NH"), "New Hampshire");
                m.insert(String::from("US-NJ"), "New Jersey");
                m.insert(String::from("US-NM"), "New Mexico");
                m.insert(String::from("US-NY"), "New York");
                m.insert(String::from("US-NC"), "North Carolina");
                m.insert(String::from("US-ND"), "North Dakota");
                m.insert(String::from("US-OH"), "Ohio");
                m.insert(String::from("US-OK"), "Oklahoma");
                m.insert(String::from("US-OR"), "Oregon");
                m.insert(String::from("US-PA"), "Pennsylvania");
                m.insert(String::from("US-RI"), "Rhode Island");
                m.insert(String::from("US-SC"), "South Carolina");
                m.insert(String::from("US-SD"), "South Dakota");
                m.insert(String::from("US-TN"), "Tennessee");
                m.insert(String::from("US-TX"), "Texas");
                m.insert(String::from("US-UT"), "Utah");
                m.insert(String::from("US-VT"), "Vermont");
                m.insert(String::from("US-VA"), "Virginia");
                m.insert(String::from("US-WA"), "Washington");
                m.insert(String::from("US-WV"), "West Virginia");
                m.insert(String::from("US-WI"), "Wisconsin");
                m.insert(String::from("US-WY"), "Wyoming");
                m.insert(String::from("US-DC"), "District of Columbia");
                m.insert(String::from("US-AS"), "American Samoa");
                m.insert(String::from("US-GU"), "Guam");
                m.insert(String::from("US-MP"), "Northern Mariana Islands");
                m.insert(String::from("US-PR"), "Puerto Rico");
                m.insert(String::from("US-UM"), "United States Minor Outlying Islands");
                m.insert(String::from("US-VI"), "Virgin Islands");

                m.insert(String::from("CA-ON"), "Ontario");
                m.insert(String::from("CA-QC"), "Quebec");
                m.insert(String::from("CA-NS"), "Nova Scotia");
                m.insert(String::from("CA-NB"), "New Brunswick");
                m.insert(String::from("CA-MB"), "Manitoba");
                m.insert(String::from("CA-BC"), "British Columbia");
                m.insert(String::from("CA-PE"), "Prince Edward Island");
                m.insert(String::from("CA-SK"), "Saskatchewan");
                m.insert(String::from("CA-AB"), "Alberta");
                m.insert(String::from("CA-NL"), "Newfoundland and Labrador");
                m.insert(String::from("CA-NT"), "Northwest Territories");
                m.insert(String::from("CA-YT"), "Yukon");
                m.insert(String::from("CA-NU"), "Nunavut");

                m
            };
        }

        match self.region_code() {
            None => None,
            Some(ref code) => match REGIONS.get(code) {
                None => None,
                Some(name) => Some(format!("{}", name))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn context_test() {
        assert_eq!(Context::new(String::from("us"), None, Tokens::new(HashMap::new(), HashMap::new())), Context {
            country: String::from("US"),
            region: None,
            tokens: Tokens::new(HashMap::new(), HashMap::new())
        });

        assert_eq!(Context::new(String::from("uS"), Some(String::from("wv")), Tokens::new(HashMap::new(), HashMap::new())), Context {
            country: String::from("US"),
            region: Some(String::from("WV")),
            tokens: Tokens::new(HashMap::new(), HashMap::new())
        });

        let cntx = Context::new(String::from("uS"), Some(String::from("wv")), Tokens::new(HashMap::new(), HashMap::new()));

        assert_eq!(cntx.region_code(), Some(String::from("US-WV")));

        assert_eq!(cntx.region_name(), Some(String::from("West Virginia")));
    }
}

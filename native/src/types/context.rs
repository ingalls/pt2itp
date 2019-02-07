use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct Context {
    pub country: String,
    pub region: Option<String> 
}

impl Context {
    pub fn new(country: String, region: Option<String>) -> Self {
        Context {
            country: country.to_uppercase(),
            region: match region {
                None => None,
                Some(region) => Some(region.to_uppercase())
            }
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
        assert_eq!(Context::new(String::from("us"), None), Context {
            country: String::from("US"),
            region: None
        });

        assert_eq!(Context::new(String::from("uS"), Some(String::from("wv"))), Context {
            country: String::from("US"),
            region: Some(String::from("WV"))
        });

        let cntx = Context::new(String::from("uS"), Some(String::from("wv")));

        assert_eq!(cntx.region_code(), Some(String::from("US-WV")));

        assert_eq!(cntx.region_name(), Some(String::from("West Virginia")));
    }
}

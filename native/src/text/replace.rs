use fancy_regex::{Regex, Captures, Error};
use std::str;
use memchr::memchr;

pub trait ReplaceAll {
    fn replace_all(&self, text: &str, rep: &str) -> Result<String, Error>;
}

impl ReplaceAll for Regex {
    fn replace_all(&self, text: &str, rep: &str) -> Result<String, Error> {
        let mut input = text;
        let mut new = String::new();

        if rep.contains('$') {
            while !input.is_empty() {
                // captures finds the left-most first match in a string
                match self.captures(input)? {
                    None => {
                        new.push_str(&input);
                        break;
                    },
                    Some(m) => {
                        // capture group 0 always corresponds to the entire match
                        let pos = (m.pos(0).unwrap().0, m.pos(0).unwrap().1);
                        // add the string up until the beginning of the match to the output
                        new.push_str(&input[..pos.0]);
                        // add the capture group replacement to the output
                        expand_str(&m, &rep, &mut new);
                        // set input to the original string from the end of the match and repeat
                        input = &input[pos.1..];
                    }
                }
            }
        } else {
            while !input.is_empty() {
                match self.find(input)? {
                    None => {
                        new.push_str(&input);
                        break;
                    },
                    Some(m) => {
                        new.push_str(&input[..m.0]);
                        new.push_str(&rep);
                        input = &input[m.1..];
                    }
                }
            }
        }
        Ok(new)
    }
}

/// The following functions, structs, and enums are derived from the core Rust regex crate
/// They add capture group replacement functionality currently not supported by fancy-regex
///  License MIT

/// A reference to a capture group in some text.
///
/// e.g., `$2`, `$foo`, `${foo}`.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct CaptureRef {
    cap: usize,
    end: usize,
}

fn expand_str(
    caps: &Captures,
    mut replacement: &str,
    dst: &mut String,
) {
    while !replacement.is_empty() {
        match memchr(b'$', replacement.as_bytes()) {
            None => break,
            Some(i) => {
                dst.push_str(&replacement[..i]);
                replacement = &replacement[i..];
            }
        }
        if replacement.as_bytes().get(1).map_or(false, |&b| b == b'$') {
            dst.push_str("$");
            replacement = &replacement[2..];
            continue;
        }
        let cap_ref = match find_cap_ref(replacement) {
            Some(cap_ref) => cap_ref,
            None => {
                dst.push_str("$");
                replacement = &replacement[1..];
                continue;
            }
        };
        replacement = &replacement[cap_ref.end..];
        dst.push_str(caps.at(cap_ref.cap).map(|m| m).unwrap_or(""));
    }
    dst.push_str(replacement);
}

/// Parses a possible reference to a capture group name in the given text,
/// starting at the beginning of `replacement`.
///
/// If no such valid reference could be found, None is returned.
fn find_cap_ref<T: ?Sized + AsRef<[u8]>>(
    replacement: &T,
) -> Option<CaptureRef> {
    let mut i = 0;
    let rep: &[u8] = replacement.as_ref();
    if rep.len() <= 1 || rep[0] != b'$' {
        return None;
    }
    i += 1;
    let mut cap_end = i;
    while rep.get(cap_end).map_or(false, |b| { is_valid_cap(*b) }) {
        cap_end += 1;
    }
    if cap_end == i {
        return None;
    }
    // We just verified that the range 0..cap_end is valid ASCII, so it must
    // therefore be valid UTF-8. If we really cared, we could avoid this UTF-8
    // check with either unsafe or by parsing the number straight from &[u8].
    let cap = str::from_utf8(&rep[i..cap_end])
                  .expect("valid UTF-8 capture name");

    match cap.parse::<u32>() {
        Ok(i) => {
            Some(CaptureRef {
                cap: i as usize,
                end: cap_end
            })
        },
        Err(_) => None
    }
}

/// Returns true if and only if the given byte is allowed in a capture name.
/// Modified to only support numbered capture groups
fn is_valid_cap(b: u8) -> bool {
    match b {
        b'0' ..= b'9' => true,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_replace() {
        assert_eq!(Regex::new(r"(?:floor|fl) #?\d{1,3}").unwrap().replace_all("123 main st", "").unwrap(), "123 main st");
        assert_eq!(Regex::new(r"(?:apartment|apt|bldg|building|rm|room|unit) #?(?:[A-Z]|\d+|[A-Z]\d+|\d+[A-Z]|\d+-\d+[A-Z]?)").unwrap().replace_all("123 main st apt #5 washington dc", "").unwrap(), "123 main st  washington dc");
        assert_eq!(Regex::new(r"(?:floor|fl) #?\d{1,3}").unwrap().replace_all("123 main st floor 5", "").unwrap(), "123 main st ");
        assert_eq!(Regex::new(r"\d{1,3}(?:st|nd|rd|th) (?:floor|fl)").unwrap().replace_all("5th floor", "").unwrap(), "");
        assert_eq!(Regex::new(r"[１1]丁目").unwrap().replace_all("1丁目 意思", "一丁目").unwrap(), "一丁目 意思");

        assert_eq!(Regex::new(r"([a-z]+)vagen").unwrap().replace_all("123 main st", "$1v").unwrap(), "123 main st");
        assert_eq!(Regex::new(r"([a-z]+)vagen").unwrap().replace_all("amanuensvagen 5 stockholm sweden", "$1v").unwrap(), "amanuensv 5 stockholm sweden");
        assert_eq!(Regex::new(r"([a-z]+)vagen").unwrap().replace_all("amanuensvagen 5 stockholm sweden gutenvagen", "$1v").unwrap(), "amanuensv 5 stockholm sweden gutenv");
        assert_eq!(Regex::new(r"([^ ]+)(strasse|straße|str)").unwrap().replace_all("wilhelmstraße 3", "$1 str").unwrap(), "wilhelm str 3");
        assert_eq!(Regex::new(r"(foo) (bar)").unwrap().replace_all("foo bar", "$2 $1").unwrap(), "bar foo");
    }

    /// Tests from the core Rust regex crate
    macro_rules! find {
        ($name:ident, $text:expr) => {
            #[test]
            fn $name() {
                assert_eq!(None, find_cap_ref($text));
            }
        };
        ($name:ident, $text:expr, $capref:expr) => {
            #[test]
            fn $name() {
                assert_eq!(Some($capref), find_cap_ref($text));
            }
        };
    }

    macro_rules! c {
        ($name_or_number:expr, $pos:expr) => {
            CaptureRef { cap: $name_or_number, end: $pos }
        };
    }

    find!(find_cap_ref3, "$0", c!(0, 2));
    find!(find_cap_ref4, "$5", c!(5, 2));
    find!(find_cap_ref5, "$10", c!(10, 3));
    find!(find_cap_ref6, "$42a", c!(42, 3));
    find!(find_cap_ref7, "${42}a");
    find!(find_cap_ref8, "${42");
    find!(find_cap_ref9, "${42 ");
    find!(find_cap_ref1, "$foo");
    find!(find_cap_ref2, "${foo}");
    find!(find_cap_ref10, " $0 ");
    find!(find_cap_ref11, "$");
    find!(find_cap_ref12, "$$");
    find!(find_cap_ref13, " ");
    find!(find_cap_ref14, "");
}

const MAX_TITLE_CHARS: usize = 100;

/// Page title derived from paste content:
/// non-ASCII characters are dropped, leading `#` and `/` (and spaces) are stripped,
/// whitespace is collapsed into single spaces and the result is cut to 100 characters.
pub fn from_content(content: &str) -> String {
    let ascii: String = content
        .chars()
        .filter(|c| c.is_ascii_graphic() || c.is_ascii_whitespace())
        .collect();
    let stripped =
        ascii.trim_start_matches(|c: char| c == '#' || c == '/' || c.is_ascii_whitespace());

    let mut title = String::new();
    for word in stripped.split_ascii_whitespace() {
        if title.len() >= MAX_TITLE_CHARS {
            break;
        }
        if !title.is_empty() {
            title.push(' ');
        }
        title.push_str(word);
    }
    // Only ASCII is left, so byte length == character count.
    title.truncate(MAX_TITLE_CHARS);
    title.trim_end().to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_leading_markers_and_whitespace() {
        assert_eq!(from_content("# Hello world"), "Hello world");
        assert_eq!(from_content("  // # / Comment\there"), "Comment here");
        assert_eq!(from_content("#include <stdio.h>"), "include <stdio.h>");
        assert_eq!(from_content("a # b"), "a # b");
    }

    #[test]
    fn normalizes_whitespace() {
        assert_eq!(
            from_content("\n\n  one \r\n\t two   three  \n"),
            "one two three"
        );
    }

    #[test]
    fn drops_non_ascii() {
        assert_eq!(from_content("Привет 🍝 pasta"), "pasta");
        assert_eq!(from_content("caf\u{e9} au lait"), "caf au lait");
        assert_eq!(from_content("Только кириллица"), "");
        assert_eq!(from_content("a\u{0}b"), "ab");
    }

    #[test]
    fn limits_length() {
        let title = from_content(&"word ".repeat(100));
        assert_eq!(title.len(), 99);
        assert!(title.ends_with("word"));
        assert_eq!(from_content(&"x".repeat(150)).len(), 100);
    }
}

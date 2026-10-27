/// Languages the editor can highlight, as `(id, name)`. The ids must match the loaders in
/// `resources/js/languages.js`.
pub const LANGUAGES: [(&str, &str); 17] = [
    ("plaintext", "Plain text"),
    ("markdown", "Markdown"),
    ("csv", "CSV"),
    ("json", "JSON"),
    ("yaml", "YAML"),
    ("html", "HTML"),
    ("css", "CSS"),
    ("javascript", "JavaScript"),
    ("typescript", "TypeScript"),
    ("python", "Python"),
    ("php", "PHP"),
    ("rust", "Rust"),
    ("go", "Go"),
    ("java", "Java"),
    ("cpp", "C/C++"),
    ("shell", "Shell"),
    ("sql", "SQL"),
];

/// The known language with this id; `None` (auto-detect) for an empty or unknown id.
pub fn from_id(id: &str) -> Option<&'static str> {
    LANGUAGES
        .iter()
        .find(|(known, _)| *known == id)
        .map(|(known, _)| *known)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_known_ids() {
        assert_eq!(from_id("rust"), Some("rust"));
        assert_eq!(from_id("plaintext"), Some("plaintext"));
        assert_eq!(from_id(""), None);
        assert_eq!(from_id("Rust"), None);
        assert_eq!(from_id("<script>"), None);
    }
}

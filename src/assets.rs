use std::collections::HashMap;
use std::path::Path;
use std::{fs, io};

use serde::Deserialize;

/// Resolves Vite entry points (e.g. `resources/css/app.css`) to their hashed build URLs.
#[derive(Debug, Default)]
pub struct Assets {
    urls: HashMap<String, String>,
}

#[derive(Deserialize)]
struct ManifestChunk {
    file: String,
}

impl Assets {
    pub fn load(manifest_path: &Path) -> io::Result<Self> {
        let manifest = fs::read_to_string(manifest_path)?;
        Self::from_manifest(&manifest).map_err(io::Error::other)
    }

    pub fn from_manifest(manifest: &str) -> Result<Self, serde_json::Error> {
        let chunks: HashMap<String, ManifestChunk> = serde_json::from_str(manifest)?;
        let urls = chunks
            .into_iter()
            .map(|(entry, chunk)| (entry, format!("/build/{}", chunk.file)))
            .collect();
        Ok(Self { urls })
    }

    pub fn url(&self, entry: &str) -> &str {
        self.urls.get(entry).map(String::as_str).unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_manifest_entries() {
        let assets = Assets::from_manifest(
            r#"{"resources/css/app.css":{"file":"assets/app-abc.css","src":"resources/css/app.css","isEntry":true}}"#,
        )
        .unwrap();

        assert_eq!(
            assets.url("resources/css/app.css"),
            "/build/assets/app-abc.css"
        );
        assert_eq!(assets.url("missing.js"), "");
    }
}

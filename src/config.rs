use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub listen_addr: String,
    /// Directory with `favicon.ico`, `robots.txt` and the Vite `build/` output.
    pub public_dir: String,
    pub admin_login: String,
    pub admin_password: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: var_or("DATABASE_URL", "sqlite://database/database.sqlite"),
            listen_addr: var_or("LISTEN_ADDR", "0.0.0.0:8000"),
            public_dir: var_or("PUBLIC_DIR", "public"),
            admin_login: var_or("ADMIN_LOGIN", ""),
            admin_password: var_or("ADMIN_PASSWORD", ""),
        }
    }
}

fn var_or(key: &str, default: &str) -> String {
    env::var(key)
        .ok()
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| default.to_owned())
}

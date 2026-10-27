use std::str::FromStr;
use std::time::Duration;

use chrono::Utc;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::{FromRow, SqlitePool};

/// Same format Laravel used, so databases created by the PHP version keep working.
const TIMESTAMP_FORMAT: &str = "%Y-%m-%d %H:%M:%S";

pub async fn connect(database_url: &str) -> Result<SqlitePool, sqlx::Error> {
    let options = SqliteConnectOptions::from_str(database_url)?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .busy_timeout(Duration::from_secs(5));

    if let Some(parent) = options.get_filename().parent()
        && !parent.as_os_str().is_empty()
    {
        std::fs::create_dir_all(parent)?;
    }

    let pool = SqlitePoolOptions::new().connect_with(options).await?;
    migrate(&pool).await?;
    Ok(pool)
}

/// Creates or upgrades the schema. The base table matches the one created by the Laravel
/// migration, so databases from the PHP version are upgraded in place.
pub async fn migrate(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::raw_sql(
        "CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            created_at DATETIME,
            updated_at DATETIME,
            slug VARCHAR NOT NULL,
            content VARCHAR NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS posts_slug_unique ON posts (slug);
        CREATE INDEX IF NOT EXISTS posts_created_at_index ON posts (created_at);",
    )
    .execute(pool)
    .await?;

    let columns: Vec<String> = sqlx::query_scalar("SELECT name FROM pragma_table_info('posts')")
        .fetch_all(pool)
        .await?;
    if !columns.iter().any(|column| column == "parent_id") {
        sqlx::raw_sql("ALTER TABLE posts ADD COLUMN parent_id INTEGER REFERENCES posts (id)")
            .execute(pool)
            .await?;
    }
    if !columns.iter().any(|column| column == "version") {
        sqlx::raw_sql("ALTER TABLE posts ADD COLUMN version INTEGER NOT NULL DEFAULT 1")
            .execute(pool)
            .await?;
    }
    if !columns.iter().any(|column| column == "language") {
        sqlx::raw_sql("ALTER TABLE posts ADD COLUMN language VARCHAR")
            .execute(pool)
            .await?;
    }
    sqlx::raw_sql("CREATE INDEX IF NOT EXISTS posts_parent_id_index ON posts (parent_id)")
        .execute(pool)
        .await?;

    Ok(())
}

#[derive(FromRow)]
pub struct Post {
    pub id: i64,
    pub parent_id: Option<i64>,
    pub version: i64,
    pub slug: String,
    pub content: String,
    /// Language chosen in the editor; `None` means auto-detect.
    pub language: Option<String>,
}

#[derive(FromRow)]
pub struct PostSummary {
    pub id: i64,
    pub parent_id: Option<i64>,
    pub version: i64,
    pub slug: String,
    pub created_at: Option<String>,
    /// First 101 characters of the content: enough to tell whether it needs truncating.
    pub preview: String,
}

const SUMMARY_COLUMNS: &str =
    "id, parent_id, version, slug, created_at, substr(content, 1, 101) AS preview";

pub async fn insert_post(
    pool: &SqlitePool,
    slug: &str,
    content: &str,
    language: Option<&str>,
    parent: Option<&Post>,
) -> Result<(), sqlx::Error> {
    let now = Utc::now().format(TIMESTAMP_FORMAT).to_string();
    sqlx::query(
        "INSERT INTO posts (slug, content, language, parent_id, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(slug)
    .bind(content)
    .bind(language)
    .bind(parent.map(|parent| parent.id))
    .bind(parent.map_or(1, |parent| parent.version + 1))
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn find_post(pool: &SqlitePool, slug: &str) -> Result<Option<Post>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, parent_id, version, slug, content, language FROM posts WHERE slug = ?",
    )
    .bind(slug)
    .fetch_optional(pool)
    .await
}

pub async fn find_slug(pool: &SqlitePool, id: i64) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar("SELECT slug FROM posts WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

/// Direct descendants (next versions) of a post, oldest first.
pub async fn children(pool: &SqlitePool, id: i64) -> Result<Vec<PostSummary>, sqlx::Error> {
    sqlx::query_as(&format!(
        "SELECT {SUMMARY_COLUMNS} FROM posts WHERE parent_id = ? ORDER BY id"
    ))
    .bind(id)
    .fetch_all(pool)
    .await
}

/// Versions in the tree that contains the post, ordered by id (parents before children),
/// at most `limit` of them.
pub async fn version_tree(
    pool: &SqlitePool,
    id: i64,
    limit: i64,
) -> Result<Vec<PostSummary>, sqlx::Error> {
    sqlx::query_as(&format!(
        "WITH RECURSIVE
            ancestors(id, parent_id) AS (
                SELECT id, parent_id FROM posts WHERE id = ?
                UNION
                SELECT posts.id, posts.parent_id FROM posts JOIN ancestors ON posts.id = ancestors.parent_id
            ),
            tree(id) AS (
                SELECT id FROM ancestors WHERE parent_id IS NULL
                UNION
                SELECT posts.id FROM posts JOIN tree ON posts.parent_id = tree.id
            )
        SELECT {SUMMARY_COLUMNS} FROM posts WHERE id IN (SELECT id FROM tree) ORDER BY id LIMIT ?"
    ))
    .bind(id)
    .bind(limit)
    .fetch_all(pool)
    .await
}

/// Number of posts whose content or slug contains `search` (all posts when empty).
pub async fn count_posts(pool: &SqlitePool, search: &str) -> Result<i64, sqlx::Error> {
    let pattern = like_pattern(search);
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM posts
        WHERE ?1 = '%%' OR content LIKE ?1 ESCAPE '\\' OR slug LIKE ?1 ESCAPE '\\'",
    )
    .bind(&pattern)
    .fetch_one(pool)
    .await
}

pub async fn search_posts(
    pool: &SqlitePool,
    search: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<PostSummary>, sqlx::Error> {
    let pattern = like_pattern(search);
    sqlx::query_as(&format!(
        "SELECT {SUMMARY_COLUMNS} FROM posts
        WHERE ?1 = '%%' OR content LIKE ?1 ESCAPE '\\' OR slug LIKE ?1 ESCAPE '\\'
        ORDER BY created_at DESC, id DESC
        LIMIT ?2 OFFSET ?3"
    ))
    .bind(&pattern)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
}

fn like_pattern(search: &str) -> String {
    let escaped = search
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    format!("%{escaped}%")
}

pub fn parse_timestamp(value: &str) -> Option<chrono::NaiveDateTime> {
    chrono::NaiveDateTime::parse_from_str(value, TIMESTAMP_FORMAT).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escapes_like_wildcards() {
        assert_eq!(like_pattern(""), "%%");
        assert_eq!(like_pattern("50%_off\\"), "%50\\%\\_off\\\\%");
    }
}

use std::collections::{HashMap, HashSet};

use askama::Template;
use axum::Form;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{Html, IntoResponse, Redirect, Response};
use chrono::{NaiveDateTime, Utc};
use serde::Deserialize;

use crate::{AppState, Assets, db, humanize, language, title};

const SLUG_ALPHABET: [char; 31] = [
    '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'j', 'k', 'm',
    'n', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
];
const SLUG_LENGTH: usize = 16;
const MAX_CONTENT_CHARS: usize = 10_000_000;
const PAGE_SIZE: i64 = 100;
const PREVIEW_CHARS: usize = 100;
const VERSION_TREE_LIMIT: i64 = 1000;
/// Deeper versions are drawn at this indent, so long edit chains don't run off the page.
const MAX_TREE_INDENT: usize = 10;
/// Cookie set by the editor's width toggle.
const LAYOUT_COOKIE: &str = "pasta_layout";

pub struct AppError(Box<dyn std::error::Error + Send + Sync>);

impl<E: Into<Box<dyn std::error::Error + Send + Sync>>> From<E> for AppError {
    fn from(error: E) -> Self {
        Self(error.into())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        tracing::error!(error = %self.0, "request failed");
        (StatusCode::INTERNAL_SERVER_ERROR, "Server Error").into_response()
    }
}

#[derive(Template)]
#[template(path = "posts/new.html")]
struct NewPage<'a> {
    assets: &'a Assets,
    editor: Editor,
}

#[derive(Template)]
#[template(path = "posts/show.html")]
struct ShowPage<'a> {
    assets: &'a Assets,
    title: String,
    slug: String,
    version: i64,
    /// Number of direct next versions; the editor links to the first one.
    next_count: usize,
    editor: Editor,
}

/// Data for the `editor.html` partial.
#[derive(Default)]
struct Editor {
    value: String,
    /// Slug the edited content is saved as a new version of.
    parent: String,
    prev_url: String,
    next_url: String,
    indicate_changes: bool,
    /// Id of the chosen language; empty for auto-detect.
    language: String,
    /// Centered column instead of the full width.
    centered: bool,
}

impl Editor {
    fn languages(&self) -> &'static [(&'static str, &'static str)] {
        &language::LANGUAGES
    }

    fn is_language(&self, id: &str) -> bool {
        self.language == id
    }
}

#[derive(Template)]
#[template(path = "posts/index.html")]
struct IndexPage<'a> {
    assets: &'a Assets,
    count: i64,
    search: String,
    posts: Vec<ListItem>,
    page: i64,
    prev_page_url: Option<String>,
    next_page_url: Option<String>,
}

#[derive(Template)]
#[template(path = "posts/versions.html")]
struct VersionsPage<'a> {
    assets: &'a Assets,
    current: String,
    versions: Vec<ListItem>,
    /// The tree has more versions than are shown.
    truncated: bool,
}

#[derive(Template)]
#[template(path = "about.html")]
struct AboutPage<'a> {
    assets: &'a Assets,
}

#[derive(Template)]
#[template(path = "not_found.html")]
struct NotFoundPage<'a> {
    assets: &'a Assets,
}

struct ListItem {
    slug: String,
    version: i64,
    created_at: String,
    created_ago: String,
    preview: String,
    /// Indentation in the version tree, in pixels.
    indent: usize,
}

impl ListItem {
    fn new(post: db::PostSummary, now: NaiveDateTime, depth: usize) -> Self {
        let created_at = post.created_at.unwrap_or_default();
        let created_ago = db::parse_timestamp(&created_at)
            .map(|time| humanize::ago(now - time))
            .unwrap_or_default();
        Self {
            slug: post.slug,
            version: post.version,
            created_at,
            created_ago,
            preview: truncate(&post.preview, PREVIEW_CHARS),
            indent: depth.min(MAX_TREE_INDENT) * 24,
        }
    }
}

#[derive(Deserialize)]
pub struct CreateForm {
    #[serde(default)]
    content: String,
    /// Slug of the version this one was edited from.
    #[serde(default)]
    parent: String,
    /// Language id; empty or unknown means auto-detect.
    #[serde(default)]
    language: String,
}

#[derive(Deserialize)]
pub struct IndexQuery {
    #[serde(default)]
    q: String,
    #[serde(default)]
    page: Option<String>,
}

pub async fn new_post(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let page = NewPage {
        assets: &state.assets,
        editor: Editor {
            centered: layout_centered(&headers),
            ..Editor::default()
        },
    };
    Ok(([(header::VARY, "Cookie")], Html(page.render()?)).into_response())
}

pub async fn create_post(
    State(state): State<AppState>,
    Form(form): Form<CreateForm>,
) -> Result<Response, AppError> {
    let content = form.content.trim();
    if content.is_empty() {
        return Ok(Redirect::to("/").into_response());
    }
    if content.chars().count() > MAX_CONTENT_CHARS {
        return Ok((StatusCode::PAYLOAD_TOO_LARGE, "Content is too long").into_response());
    }

    let language = language::from_id(&form.language);
    let parent = match form.parent.as_str() {
        "" => None,
        slug => db::find_post(&state.db, slug).await?,
    };
    if let Some(parent) = &parent
        && parent.content == content
        && parent.language.as_deref() == language
    {
        return Ok(Redirect::to(&format!("/{}", parent.slug)).into_response());
    }

    let slug = nanoid::nanoid!(SLUG_LENGTH, &SLUG_ALPHABET);
    db::insert_post(&state.db, &slug, content, language, parent.as_ref()).await?;

    Ok(Redirect::to(&format!("/{slug}")).into_response())
}

pub async fn show_post(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let Some(post) = db::find_post(&state.db, &slug).await? else {
        return Ok(not_found(State(state)).await);
    };

    let prev_url = match post.parent_id {
        Some(parent_id) => db::find_slug(&state.db, parent_id)
            .await?
            .map(|slug| format!("/{slug}"))
            .unwrap_or_default(),
        None => String::new(),
    };
    let next_versions = db::children(&state.db, post.id).await?;
    let next_url = next_versions
        .first()
        .map(|next| format!("/{}", next.slug))
        .unwrap_or_default();

    let content_title = title::from_content(&post.content);
    let title = if content_title.is_empty() {
        format!("Pasta #{} · v{}", post.slug, post.version)
    } else {
        format!("{content_title} · v{}", post.version)
    };

    let page = ShowPage {
        assets: &state.assets,
        title,
        slug: post.slug.clone(),
        version: post.version,
        next_count: next_versions.len(),
        editor: Editor {
            value: post.content,
            parent: post.slug,
            prev_url,
            next_url,
            indicate_changes: true,
            language: post.language.unwrap_or_default(),
            centered: layout_centered(&headers),
        },
    };
    Ok(([(header::VARY, "Cookie")], Html(page.render()?)).into_response())
}

pub async fn versions(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Response, AppError> {
    let Some(post) = db::find_post(&state.db, &slug).await? else {
        return Ok(not_found(State(state)).await);
    };

    let posts = db::version_tree(&state.db, post.id, VERSION_TREE_LIMIT + 1).await?;
    let truncated = posts.len() as i64 > VERSION_TREE_LIMIT;
    let posts = posts
        .into_iter()
        .take(VERSION_TREE_LIMIT as usize)
        .collect();
    let page = VersionsPage {
        assets: &state.assets,
        current: post.slug,
        versions: flatten_tree(posts, Utc::now().naive_utc()),
        truncated,
    };
    Ok(Html(page.render()?).into_response())
}

pub async fn index(
    State(state): State<AppState>,
    Query(query): Query<IndexQuery>,
) -> Result<Html<String>, AppError> {
    let search = query.q.trim();
    let page = query
        .page
        .and_then(|page| page.parse::<i64>().ok())
        .unwrap_or(1)
        .max(1);

    let count = db::count_posts(&state.db, search).await?;
    let last_page = ((count + PAGE_SIZE - 1) / PAGE_SIZE).max(1);
    let page = page.min(last_page);

    let now = Utc::now().naive_utc();
    let posts = db::search_posts(&state.db, search, PAGE_SIZE, (page - 1) * PAGE_SIZE)
        .await?
        .into_iter()
        .map(|post| ListItem::new(post, now, 0))
        .collect();

    let page_url = |page: i64| {
        let mut params = vec![("page", page.to_string())];
        if !search.is_empty() {
            params.insert(0, ("q", search.to_owned()));
        }
        format!(
            "/all?{}",
            serde_urlencoded::to_string(params).unwrap_or_default()
        )
    };

    let html = IndexPage {
        assets: &state.assets,
        count,
        search: search.to_owned(),
        posts,
        page,
        prev_page_url: (page > 1).then(|| page_url(page - 1)),
        next_page_url: (page < last_page).then(|| page_url(page + 1)),
    }
    .render()?;
    Ok(Html(html))
}

pub async fn about(State(state): State<AppState>) -> Result<Html<String>, AppError> {
    Ok(Html(
        AboutPage {
            assets: &state.assets,
        }
        .render()?,
    ))
}

pub async fn redirect_home() -> Response {
    (StatusCode::FOUND, [(header::LOCATION, "/")]).into_response()
}

pub async fn health() -> &'static str {
    "OK"
}

pub async fn not_found(State(state): State<AppState>) -> Response {
    match (NotFoundPage {
        assets: &state.assets,
    })
    .render()
    {
        Ok(page) => (StatusCode::NOT_FOUND, Html(page)).into_response(),
        Err(error) => AppError::from(error).into_response(),
    }
}

fn layout_centered(headers: &HeaderMap) -> bool {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(';'))
        .filter_map(|pair| pair.trim().split_once('='))
        .any(|(name, value)| name == LAYOUT_COOKIE && value == "centered")
}

/// Orders a version tree depth-first (children by id) and records each node's depth.
fn flatten_tree(posts: Vec<db::PostSummary>, now: NaiveDateTime) -> Vec<ListItem> {
    let mut children: HashMap<Option<i64>, Vec<db::PostSummary>> = HashMap::new();
    let ids: HashSet<i64> = posts.iter().map(|post| post.id).collect();
    for post in posts {
        // A missing parent can only mean a broken reference: treat the node as a root.
        let parent = post.parent_id.filter(|parent| ids.contains(parent));
        children.entry(parent).or_default().push(post);
    }

    let mut items = Vec::new();
    let mut stack: Vec<(db::PostSummary, usize)> = children
        .remove(&None)
        .unwrap_or_default()
        .into_iter()
        .rev()
        .map(|post| (post, 0))
        .collect();
    while let Some((post, depth)) = stack.pop() {
        if let Some(kids) = children.remove(&Some(post.id)) {
            stack.extend(kids.into_iter().rev().map(|kid| (kid, depth + 1)));
        }
        items.push(ListItem::new(post, now, depth));
    }
    items
}

fn truncate(text: &str, max_chars: usize) -> String {
    match text.char_indices().nth(max_chars) {
        Some((end, _)) => format!("{}...", &text[..end]),
        None => text.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncates_by_characters() {
        assert_eq!(truncate("short", 100), "short");
        assert_eq!(truncate("abcdef", 3), "abc...");
        assert_eq!(truncate("абв", 3), "абв");
        assert_eq!(truncate("абвг", 3), "абв...");
    }

    #[test]
    fn reads_layout_cookie() {
        let headers = |cookies: &[&str]| {
            let mut map = HeaderMap::new();
            for cookie in cookies {
                map.append(header::COOKIE, cookie.parse().unwrap());
            }
            map
        };

        assert!(!layout_centered(&headers(&[])));
        assert!(layout_centered(&headers(&["pasta_layout=centered"])));
        assert!(layout_centered(&headers(&[
            "a=1; pasta_layout=centered; b=2"
        ])));
        assert!(layout_centered(&headers(&["a=1", "pasta_layout=centered"])));
        assert!(!layout_centered(&headers(&["pasta_layout=full"])));
        assert!(!layout_centered(&headers(&["xpasta_layout=centered"])));
    }

    #[test]
    fn flattens_tree_depth_first() {
        let post = |id, parent_id| db::PostSummary {
            id,
            parent_id,
            version: 1,
            slug: id.to_string(),
            created_at: None,
            preview: String::new(),
        };
        let posts = vec![
            post(1, None),
            post(2, Some(1)),
            post(3, Some(1)),
            post(4, Some(2)),
        ];

        let flat: Vec<(String, usize)> = flatten_tree(posts, Utc::now().naive_utc())
            .into_iter()
            .map(|item| (item.slug, item.indent / 24))
            .collect();

        assert_eq!(
            flat,
            [("1", 0), ("2", 1), ("4", 2), ("3", 1)].map(|(slug, depth)| (slug.to_owned(), depth))
        );
    }
}

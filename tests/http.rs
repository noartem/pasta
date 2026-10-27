use std::sync::Arc;

use axum::Router;
use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use http_body_util::BodyExt;
use pasta::{AppState, Assets, Config, app, db};
use sqlx::SqlitePool;
use sqlx::sqlite::SqlitePoolOptions;
use tower::ServiceExt;

const MANIFEST: &str = r#"{
    "resources/css/app.css": {"file": "assets/app-1.css"},
    "resources/css/codemirror.css": {"file": "assets/codemirror-2.css"},
    "resources/js/codemirror.js": {"file": "assets/codemirror-3.js"},
    "resources/js/list.js": {"file": "assets/list-4.js"}
}"#;

struct TestApp {
    router: Router,
    db: SqlitePool,
}

async fn test_app(admin_password: &str) -> TestApp {
    test_app_with_login("admin", admin_password).await
}

async fn test_app_with_login(admin_login: &str, admin_password: &str) -> TestApp {
    // A single connection, so every query sees the same in-memory database.
    let db = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    db::migrate(&db).await.unwrap();

    let config = Config {
        database_url: "sqlite::memory:".into(),
        listen_addr: "127.0.0.1:0".into(),
        public_dir: "public".into(),
        admin_login: admin_login.into(),
        admin_password: admin_password.into(),
    };
    let state = AppState {
        db: db.clone(),
        config: Arc::new(config),
        assets: Arc::new(Assets::from_manifest(MANIFEST).unwrap()),
    };
    TestApp {
        router: app(state),
        db,
    }
}

struct TestResponse {
    status: StatusCode,
    location: Option<String>,
    headers: axum::http::HeaderMap,
    body: String,
}

impl TestApp {
    async fn send(&self, request: Request<Body>) -> TestResponse {
        let response = self.router.clone().oneshot(request).await.unwrap();
        let status = response.status();
        let headers = response.headers().clone();
        let location = headers
            .get(header::LOCATION)
            .map(|value| value.to_str().unwrap().to_owned());
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        TestResponse {
            status,
            location,
            headers,
            body: String::from_utf8_lossy(&bytes).into_owned(),
        }
    }

    async fn get(&self, uri: &str) -> TestResponse {
        self.send(Request::get(uri).body(Body::empty()).unwrap())
            .await
    }

    async fn get_as_admin(&self, uri: &str, login: &str, password: &str) -> TestResponse {
        let credentials = STANDARD.encode(format!("{login}:{password}"));
        let request = Request::get(uri)
            .header(header::AUTHORIZATION, format!("Basic {credentials}"))
            .body(Body::empty())
            .unwrap();
        self.send(request).await
    }

    async fn post_form(&self, fields: &[(&str, &str)]) -> TestResponse {
        let body = serde_urlencoded::to_string(fields).unwrap();
        let request = Request::post("/")
            .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
            .body(Body::from(body))
            .unwrap();
        self.send(request).await
    }

    /// Creates a post and returns its slug.
    async fn create(&self, fields: &[(&str, &str)]) -> String {
        let response = self.post_form(fields).await;
        assert_eq!(response.status, StatusCode::SEE_OTHER);
        response
            .location
            .unwrap()
            .trim_start_matches('/')
            .to_owned()
    }

    async fn post_count(&self) -> i64 {
        db::count_posts(&self.db, "").await.unwrap()
    }
}

#[tokio::test]
async fn new_page_renders_editor_with_assets() {
    let app = test_app("secret").await;

    let response = app.get("/").await;

    assert_eq!(response.status, StatusCode::OK);
    assert!(
        response
            .body
            .contains(r#"<textarea name="content" id="content""#)
    );
    assert!(response.body.contains("/build/assets/app-1.css"));
    assert!(response.body.contains("/build/assets/codemirror-3.js"));
    assert!(!response.body.contains(r#"name="parent""#));
    assert!(
        response
            .headers
            .contains_key(header::CONTENT_SECURITY_POLICY)
    );
}

#[tokio::test]
async fn new_redirects_home() {
    let app = test_app("secret").await;

    let response = app.get("/new").await;

    assert_eq!(response.status, StatusCode::FOUND);
    assert_eq!(response.location.as_deref(), Some("/"));
}

#[tokio::test]
async fn health_check() {
    let app = test_app("secret").await;

    assert_eq!(app.get("/up").await.status, StatusCode::OK);
}

#[tokio::test]
async fn creates_and_shows_post() {
    let app = test_app("secret").await;

    let slug = app.create(&[("content", "  # Hello\nworld  \n")]).await;

    assert_eq!(slug.len(), 16);
    assert!(
        slug.chars()
            .all(|c| "23456789abcdefghjkmnpqrstuvwxyz".contains(c))
    );

    let response = app.get(&format!("/{slug}")).await;
    assert_eq!(response.status, StatusCode::OK);
    assert!(response.body.contains("<title>Hello world · v1</title>"));
    assert!(
        response.body.contains(">\n# Hello\nworld</textarea>")
            || response.body.contains("># Hello\nworld</textarea>")
    );
    assert!(
        response
            .body
            .contains(&format!(r#"name="parent" value="{slug}""#))
    );
    assert!(response.body.contains(r#"data-prev-url="""#));
}

#[tokio::test]
async fn title_falls_back_to_slug() {
    let app = test_app("secret").await;

    let slug = app.create(&[("content", "Привет")]).await;

    let response = app.get(&format!("/{slug}")).await;
    assert!(
        response
            .body
            .contains(&format!("<title>Pasta #{slug} · v1</title>"))
    );
}

#[tokio::test]
async fn escapes_content() {
    let app = test_app("secret").await;

    let slug = app
        .create(&[(
            "content",
            r#"</textarea><script>alert("x")</script> &amp; "quotes""#,
        )])
        .await;

    let body = app.get(&format!("/{slug}")).await.body;
    assert!(!body.contains("<script>alert"));
    assert!(body.contains("&#60;/textarea&#62;&#60;script&#62;"));
    assert!(body.contains("&#38;amp;"));
}

#[tokio::test]
async fn rejects_empty_content() {
    let app = test_app("secret").await;

    for fields in [&[("content", "   \n\t ")][..], &[][..]] {
        let response = app.post_form(fields).await;
        assert_eq!(response.status, StatusCode::SEE_OTHER);
        assert_eq!(response.location.as_deref(), Some("/"));
    }
    assert_eq!(app.post_count().await, 0);
}

#[tokio::test]
async fn rejects_too_long_content() {
    let app = test_app("secret").await;

    let content = "x".repeat(10_000_001);
    let response = app.post_form(&[("content", &content)]).await;

    assert_eq!(response.status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(app.post_count().await, 0);
}

#[tokio::test]
async fn unknown_slug_is_not_found() {
    let app = test_app("secret").await;

    for uri in ["/doesnotexist", "/doesnotexist/versions", "/a/b/c"] {
        let response = app.get(uri).await;
        assert_eq!(response.status, StatusCode::NOT_FOUND, "{uri}");
        assert!(response.body.contains("404"));
    }
}

#[tokio::test]
async fn saving_edit_creates_next_version() {
    let app = test_app("secret").await;

    let v1 = app.create(&[("content", "first")]).await;
    let v2 = app.create(&[("content", "second"), ("parent", &v1)]).await;
    let v2b = app.create(&[("content", "branch"), ("parent", &v1)]).await;
    let v3 = app.create(&[("content", "third"), ("parent", &v2)]).await;

    let v1_page = app.get(&format!("/{v1}")).await.body;
    assert!(v1_page.contains(&format!(r#"data-next-url="/{v2}""#)));
    assert!(v1_page.contains("+1"), "shows the extra branch");

    let v2_page = app.get(&format!("/{v2}")).await.body;
    assert!(v2_page.contains("<title>second · v2</title>"));
    assert!(v2_page.contains(&format!(r#"data-prev-url="/{v1}""#)));
    assert!(v2_page.contains(&format!(r#"data-next-url="/{v3}""#)));

    let v3_page = app.get(&format!("/{v3}")).await.body;
    assert!(v3_page.contains("<title>third · v3</title>"));
    assert!(v3_page.contains(r#"data-next-url="""#));

    let tree = app.get(&format!("/{v3}/versions")).await;
    assert_eq!(tree.status, StatusCode::OK);
    let list = &tree.body[tree.body.find("<ul").unwrap()..];
    let positions: Vec<usize> = [&v1, &v2, &v3, &v2b]
        .iter()
        .map(|slug| list.find(&format!(r#"href="/{slug}""#)).unwrap())
        .collect();
    assert!(positions.is_sorted(), "depth-first order: {positions:?}");
    assert!(tree.body.contains("margin-left: 48px"));
}

#[tokio::test]
async fn saving_unchanged_content_reuses_version() {
    let app = test_app("secret").await;

    let v1 = app.create(&[("content", "same")]).await;
    let again = app
        .create(&[("content", "  same\n"), ("parent", &v1)])
        .await;

    assert_eq!(again, v1);
    assert_eq!(app.post_count().await, 1);
}

#[tokio::test]
async fn saves_and_inherits_chosen_language() {
    let app = test_app("secret").await;

    let auto = app.create(&[("content", "text"), ("language", "")]).await;
    let auto_page = app.get(&format!("/{auto}")).await.body;
    assert!(auto_page.contains(r#"<option value="">Auto</option>"#));
    assert!(!auto_page.contains("selected"));

    // Same content, another language: a new version.
    let rust = app
        .create(&[("content", "text"), ("language", "rust"), ("parent", &auto)])
        .await;
    assert_ne!(rust, auto);
    let rust_page = app.get(&format!("/{rust}")).await.body;
    assert!(rust_page.contains(r#"<option value="rust" selected>Rust</option>"#));

    // Same content and language: the same version.
    let again = app
        .create(&[("content", "text"), ("language", "rust"), ("parent", &rust)])
        .await;
    assert_eq!(again, rust);

    let unknown = app
        .create(&[("content", "other"), ("language", "<script>")])
        .await;
    let unknown_page = app.get(&format!("/{unknown}")).await.body;
    assert!(!unknown_page.contains("selected"));
    assert!(!unknown_page.contains("<script>"));
}

#[tokio::test]
async fn layout_cookie_centers_editor() {
    let app = test_app("secret").await;
    let slug = app.create(&[("content", "text")]).await;

    for uri in ["/".to_owned(), format!("/{slug}")] {
        let full = app.get(&uri).await.body;
        assert!(full.contains(r#"<html lang="en">"#), "{uri}");
        assert!(full.contains(r#"id="layout-toggle""#), "{uri}");

        let request = Request::get(&uri)
            .header(header::COOKIE, "theme=x; pasta_layout=centered")
            .body(Body::empty())
            .unwrap();
        let centered = app.send(request).await.body;
        assert!(
            centered.contains(r#"<html lang="en" class="layout-centered">"#),
            "{uri}"
        );
    }
}

#[tokio::test]
async fn unknown_parent_creates_root_version() {
    let app = test_app("secret").await;

    let slug = app
        .create(&[("content", "orphan"), ("parent", "nope")])
        .await;

    assert!(
        app.get(&format!("/{slug}"))
            .await
            .body
            .contains("· v1</title>")
    );
}

#[tokio::test]
async fn index_requires_configured_password() {
    let app = test_app("").await;

    let response = app.get_as_admin("/all", "admin", "").await;

    assert_eq!(response.status, StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn index_requires_configured_login() {
    let app = test_app_with_login("", "secret").await;

    let response = app.get_as_admin("/all", "", "secret").await;

    assert_eq!(response.status, StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn index_requires_valid_credentials() {
    let app = test_app("secret").await;

    let anonymous = app.get("/all").await;
    assert_eq!(anonymous.status, StatusCode::UNAUTHORIZED);
    assert_eq!(anonymous.headers[header::WWW_AUTHENTICATE], "Basic");

    for (login, password) in [
        ("admin", "wrong"),
        ("other", "secret"),
        ("admin", "secret2"),
    ] {
        let response = app.get_as_admin("/all", login, password).await;
        assert_eq!(
            response.status,
            StatusCode::UNAUTHORIZED,
            "{login}:{password}"
        );
    }

    assert_eq!(
        app.get_as_admin("/all", "admin", "secret").await.status,
        StatusCode::OK
    );
}

#[tokio::test]
async fn index_lists_searches_and_paginates() {
    let app = test_app("secret").await;

    let long = format!("needle {}", "y".repeat(200));
    let needle = app.create(&[("content", &long)]).await;
    for i in 0..105 {
        app.create(&[("content", &format!("post {i}"))]).await;
    }

    let first = app.get_as_admin("/all", "admin", "secret").await.body;
    assert!(first.contains("<title>Pastas (106)</title>"));
    assert!(first.contains("/all?page=2"));
    assert!(!first.contains(&needle), "oldest post is on page 2");

    let second = app
        .get_as_admin("/all?page=2", "admin", "secret")
        .await
        .body;
    assert!(second.contains(&needle));
    assert!(second.contains(&format!("needle {}...", "y".repeat(93))));
    assert!(second.contains("/all?page=1"));

    let search = app
        .get_as_admin("/all?q=needle", "admin", "secret")
        .await
        .body;
    assert!(search.contains("<title>Pastas (1)</title>"));
    assert!(search.contains(&needle));
    assert!(search.contains(r#"value="needle""#));

    let wildcard = app.get_as_admin("/all?q=%25", "admin", "secret").await.body;
    assert!(wildcard.contains("<title>Pastas (0)</title>"));
    assert!(wildcard.contains("Nothing found"));

    let clamped = app.get_as_admin("/all?page=999", "admin", "secret").await;
    assert_eq!(clamped.status, StatusCode::OK);
    assert!(clamped.body.contains("Page 2"));
    assert!(clamped.body.contains(r#"id="prev-page""#));
    assert!(clamped.body.contains("/build/assets/list-4.js"));
}

#[tokio::test]
async fn about_page() {
    let app = test_app("secret").await;

    let response = app.get("/about").await;

    assert_eq!(response.status, StatusCode::OK);
    assert!(response.body.contains("Keyboard shortcuts"));
    assert!(response.body.contains("Alt+W"));
}

#[tokio::test]
async fn serves_public_files() {
    let app = test_app("secret").await;

    for uri in [
        "/favicon.ico",
        "/icon.svg",
        "/robots.txt",
        "/manifest.webmanifest",
    ] {
        assert_eq!(app.get(uri).await.status, StatusCode::OK, "{uri}");
    }
}

pub mod assets;
pub mod auth;
pub mod config;
pub mod db;
pub mod handlers;
pub mod humanize;
pub mod language;
pub mod title;

use std::path::Path;
use std::sync::Arc;

use axum::Router;
use axum::extract::DefaultBodyLimit;
use axum::http::{HeaderName, HeaderValue, header};
use axum::middleware;
use axum::response::Response;
use axum::routing::get;
use sqlx::SqlitePool;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::set_header::SetResponseHeaderLayer;
use tower_http::trace::TraceLayer;

pub use assets::Assets;
pub use config::Config;

/// Files from `public/` served at the site root.
const ROOT_FILES: [&str; 7] = [
    "favicon.ico",
    "icon.svg",
    "apple-touch-icon.png",
    "icon-192.png",
    "icon-512.png",
    "manifest.webmanifest",
    "robots.txt",
];

/// Room for 10M characters of mostly-ASCII url-encoded form data, small enough to bound
/// per-request memory.
const MAX_BODY_BYTES: usize = 16 * 1024 * 1024;

#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
    pub config: Arc<Config>,
    pub assets: Arc<Assets>,
}

pub fn app(state: AppState) -> Router {
    let public_dir = Path::new(&state.config.public_dir);

    let build_assets = Router::new()
        .fallback_service(ServeDir::new(public_dir.join("build")))
        .layer(middleware::map_response(cache_forever));

    let mut router = Router::new()
        .route("/", get(handlers::new_post).post(handlers::create_post))
        .route("/new", get(handlers::redirect_home))
        .route(
            "/all",
            get(handlers::index).route_layer(middleware::from_fn_with_state(
                state.clone(),
                auth::require_admin,
            )),
        )
        .route("/about", get(handlers::about))
        .route("/up", get(handlers::health))
        .route("/{slug}", get(handlers::show_post))
        .route("/{slug}/versions", get(handlers::versions))
        .nest("/build", build_assets);
    for file in ROOT_FILES {
        router = router.route_service(&format!("/{file}"), ServeFile::new(public_dir.join(file)));
    }

    router
        .fallback(handlers::not_found)
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .layer(security_header(
            header::CONTENT_SECURITY_POLICY,
            CONTENT_SECURITY_POLICY,
        ))
        .layer(security_header(header::X_CONTENT_TYPE_OPTIONS, "nosniff"))
        .layer(security_header(header::X_FRAME_OPTIONS, "DENY"))
        .layer(security_header(header::REFERRER_POLICY, "same-origin"))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// Scripts only from our own build; CodeMirror injects `<style>` elements, hence inline styles.
const CONTENT_SECURITY_POLICY: &str = concat!(
    "default-src 'self'; ",
    "script-src 'self'; ",
    "style-src 'self' 'unsafe-inline' https://fonts.bunny.net; ",
    "font-src 'self' https://fonts.bunny.net; ",
    "img-src 'self' data:; ",
    "object-src 'none'; ",
    "base-uri 'none'; ",
    "form-action 'self'; ",
    "frame-ancestors 'none'",
);

/// Built assets have content hashes in their names. Errors (e.g. a 404 during a deploy)
/// must not be cached.
async fn cache_forever(mut response: Response) -> Response {
    if response.status().is_success() {
        response.headers_mut().insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=31536000, immutable"),
        );
    }
    response
}

fn security_header(name: HeaderName, value: &'static str) -> SetResponseHeaderLayer<HeaderValue> {
    SetResponseHeaderLayer::if_not_present(name, HeaderValue::from_static(value))
}

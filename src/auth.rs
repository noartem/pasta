use axum::extract::{Request, State};
use axum::http::{HeaderMap, StatusCode, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use subtle::ConstantTimeEq;

use crate::AppState;

/// HTTP Basic auth against `ADMIN_LOGIN` / `ADMIN_PASSWORD`; both must be configured.
pub async fn require_admin(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    let config = &state.config;
    if config.admin_login.is_empty() || config.admin_password.is_empty() {
        tracing::error!("ADMIN_LOGIN or ADMIN_PASSWORD is not set");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Admin credentials are not set",
        )
            .into_response();
    }

    let authorized = basic_credentials(request.headers()).is_some_and(|(login, password)| {
        let login_ok = login.as_bytes().ct_eq(config.admin_login.as_bytes());
        let password_ok = password.as_bytes().ct_eq(config.admin_password.as_bytes());
        bool::from(login_ok & password_ok)
    });

    if !authorized {
        return (
            StatusCode::UNAUTHORIZED,
            [(header::WWW_AUTHENTICATE, "Basic")],
            "Unauthorized",
        )
            .into_response();
    }

    let mut response = next.run(request).await;
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        header::HeaderValue::from_static("no-store"),
    );
    response
}

fn basic_credentials(headers: &HeaderMap) -> Option<(String, String)> {
    let value = headers.get(header::AUTHORIZATION)?.to_str().ok()?;
    let (scheme, encoded) = value.split_once(' ')?;
    if !scheme.eq_ignore_ascii_case("basic") {
        return None;
    }
    let decoded = String::from_utf8(STANDARD.decode(encoded.trim()).ok()?).ok()?;
    let (login, password) = decoded.split_once(':')?;
    Some((login.to_owned(), password.to_owned()))
}

use std::path::Path;
use std::sync::Arc;

use pasta::{AppState, Assets, Config, app, db};
use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,tower_http=info")),
        )
        .init();

    let config = Config::from_env();

    let manifest = Path::new(&config.public_dir).join("build/.vite/manifest.json");
    let assets = Assets::load(&manifest).map_err(|error| {
        format!(
            "failed to read {} (run `npm run build` first): {error}",
            manifest.display()
        )
    })?;

    let db = db::connect(&config.database_url).await?;
    let listener = TcpListener::bind(&config.listen_addr).await?;
    tracing::info!("listening on http://{}", listener.local_addr()?);

    let state = AppState {
        db: db.clone(),
        config: Arc::new(config),
        assets: Arc::new(assets),
    };
    axum::serve(listener, app(state))
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    db.close().await;
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to listen for Ctrl+C");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to listen for SIGTERM")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }
    tracing::info!("shutting down");
}

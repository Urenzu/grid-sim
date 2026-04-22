mod analytics;
mod domain;
mod eia;
mod handlers;
mod labels;
mod parquet;
mod query;
mod types;

use anyhow::Result;
use axum::{routing::get, Router};
use moka::future::Cache;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use types::AppState;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    dotenvy::dotenv().ok();

    let eia_key = std::env::var("EIA_API_KEY").expect("EIA_API_KEY must be set");

    let cli_args: Vec<String> = std::env::args().collect();
    let data_dir = cli_args.iter()
        .position(|a| a == "--data-dir")
        .and_then(|i| cli_args.get(i + 1))
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("./data"));

    parquet::cleanup_tmp_parquet(&data_dir);
    tracing::info!("data dir: {}", data_dir.display());

    let history_cache = Cache::builder()
        .max_capacity(512)
        .time_to_live(Duration::from_secs(5 * 60))
        .build();

    let state = Arc::new(AppState {
        eia_key,
        http:              reqwest::Client::new(),
        gen_cache:         Arc::new(RwLock::new(None)),
        interchange_cache: Arc::new(RwLock::new(None)),
        demand_cache:      Arc::new(RwLock::new(None)),
        history_cache,
        data_dir,
    });

    tokio::spawn({
        let state = Arc::clone(&state);
        async move { handlers::smart_data_task(state).await }
    });

    tokio::spawn(handlers::r2_sync_task(state.data_dir.clone()));

    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "dist".to_string());

    let app = Router::new()
        .route("/health",                get(handlers::health_handler))
        .route("/api/interchange",       get(handlers::interchange_handler))
        .route("/api/generation",        get(handlers::generation_handler))
        .route("/api/carbon",            get(handlers::carbon_handler))
        .route("/api/history",           get(handlers::history_handler))
        .route("/api/duck-curve",        get(handlers::duck_curve_handler))
        .route("/api/analytics",         get(handlers::analytics_handler))
        .route("/api/analytics/compare", get(handlers::compare_handler))
        .route("/api/range",             get(handlers::range_handler))
        .route("/api/heatmap",           get(handlers::heatmap_handler))
        .route("/api/trends",            get(handlers::trends_handler))
        .layer(CorsLayer::permissive())
        .with_state(state)
        .fallback_service(ServeDir::new(&static_dir));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    tracing::info!("listening on http://localhost:3000");
    axum::serve(listener, app).await?;
    Ok(())
}

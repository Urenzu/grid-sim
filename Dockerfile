# ── Stage 1: Build frontend ────────────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /app
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

# ── Stage 2: Build Rust server ─────────────────────────────────────────────
FROM rust:1.88-slim-bookworm AS builder
WORKDIR /build

# duckdb bundled feature compiles libduckdb from source — needs cmake + C++
RUN apt-get update && apt-get install -y \
    cmake g++ pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
RUN cargo build --release -p server

# ── Stage 3: Runtime image ─────────────────────────────────────────────────
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /build/target/release/server ./server
COPY --from=frontend /app/dist ./dist
COPY data/ /seed/

EXPOSE 3000
ENV RUST_LOG=info

# On first boot the Railway volume at /data is empty — seed it from the
# bundled historical Parquet files. Subsequent boots skip the copy.
CMD ["sh", "-c", "if [ -z \"$(ls -A /data 2>/dev/null)\" ]; then echo 'Seeding /data from image...' && cp -r /seed/. /data/; fi && ./server --data-dir /data"]

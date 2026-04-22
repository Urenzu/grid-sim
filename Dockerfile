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
RUN cargo build --release -p server -j2

# ── Stage 3: Runtime image ─────────────────────────────────────────────────
FROM debian:bookworm-slim

# AWS CLI for seeding /data from R2 on first boot
RUN apt-get update && apt-get install -y ca-certificates curl unzip && \
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "/tmp/awscliv2.zip" && \
    unzip /tmp/awscliv2.zip -d /tmp && /tmp/aws/install && \
    rm -rf /tmp/awscliv2.zip /tmp/aws && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /build/target/release/server ./server
COPY --from=frontend /app/dist ./dist

RUN mkdir -p /data

EXPOSE 3000
ENV RUST_LOG=info

# On first boot the Railway volume at /data is empty — pull historical
# Parquet files from R2. Subsequent boots skip the sync.
CMD ["sh", "-c", "\
  if [ -z \"$(ls -A /data 2>/dev/null)\" ]; then \
    echo 'Seeding /data from R2...' && \
    AWS_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID} \
    AWS_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY} \
    aws s3 sync s3://${R2_BUCKET}/ /data/ \
      --endpoint-url https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com \
      --region auto --no-progress && \
    echo 'Seed complete.'; \
  fi && ./server --data-dir /data"]

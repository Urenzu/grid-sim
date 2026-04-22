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

RUN apt-get update && apt-get install -y \
    cmake g++ pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/

# Build deps with dummy entry points — this layer is cached by Railway
# as long as Cargo.toml/Cargo.lock don't change.
RUN mkdir -p crates/server/src crates/backfill/src && \
    echo "fn main() {}" > crates/server/src/main.rs && \
    echo "fn main() {}" > crates/backfill/src/main.rs && \
    cargo build --release -p server && \
    rm -rf crates/server/src crates/backfill/src

# Copy real source and recompile — only your code runs here on each push.
COPY crates/ crates/
RUN touch crates/server/src/main.rs && \
    cargo build --release -p server && \
    cp target/release/server /usr/local/bin/server

# ── Stage 3: Runtime image ─────────────────────────────────────────────────
FROM debian:bookworm-slim

# AWS CLI for seeding /data from R2 on first boot
RUN apt-get update && apt-get install -y ca-certificates curl unzip && \
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "/tmp/awscliv2.zip" && \
    unzip /tmp/awscliv2.zip -d /tmp && /tmp/aws/install && \
    rm -rf /tmp/awscliv2.zip /tmp/aws && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /usr/local/bin/server ./server
COPY --from=frontend /app/dist ./dist
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

RUN mkdir -p /data

EXPOSE 3000
ENV RUST_LOG=info

CMD ["./entrypoint.sh"]

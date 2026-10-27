# syntax=docker/dockerfile:1

# Frontend assets (CodeMirror, Tailwind) -> public/build
FROM node:22-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY vite.config.js tailwind.config.js postcss.config.js ./
COPY resources ./resources
COPY templates ./templates
RUN npm run build

# Rust server; dependencies are cooked in a separate layer so source changes rebuild only the app
FROM rust:1-bookworm AS chef
RUN cargo install cargo-chef --locked
WORKDIR /app

FROM chef AS planner
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS server
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --locked --recipe-path recipe.json
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY templates ./templates
RUN cargo build --release --locked && mkdir /data

FROM gcr.io/distroless/cc-debian12:nonroot
WORKDIR /app
COPY --from=server /app/target/release/pasta ./pasta
COPY public ./public
COPY --from=assets /app/public/build ./public/build
COPY --from=server --chown=65532:65532 /data /data

ENV DATABASE_URL=sqlite:///data/database.sqlite \
    LISTEN_ADDR=0.0.0.0:8000 \
    PUBLIC_DIR=/app/public
VOLUME /data
EXPOSE 8000

ENTRYPOINT ["/app/pasta"]

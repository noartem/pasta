# 🍝 Pasta

The tastiest note manager on the entire internet

A tiny pastebin: a Rust ([axum](https://github.com/tokio-rs/axum)) server with SQLite and a
[CodeMirror](https://codemirror.net) editor. Every save of an edited pasta creates a new version;
versions form a tree (`/{slug}/versions`). `/all` lists, searches and paginates all pastas behind
HTTP Basic auth (`ADMIN_LOGIN` / `ADMIN_PASSWORD`).

## Development

Requires Rust (stable, 1.88+) and Node.js 22.

```
cp .env.example .env
npm ci
npm run build        # or `npm run dev` to rebuild assets on change
cargo run
```

Open http://localhost:8000. Checks run in CI:

```
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

Configuration is read from the environment (and `.env` if present), see [.env.example](.env.example).

## Docker

Every push to `master` (and every `v*` tag) is tested, built and pushed to
`ghcr.io/noartem/pasta` by [GitHub Actions](.github/workflows/ci.yml). Tags: `latest` and `master`
for the default branch, `sha-<commit>`, and `X.Y.Z` / `X.Y` for `vX.Y.Z` tags. Only the 4 newest image
versions are kept in the registry; older ones are deleted automatically after each push.

Run:

```
docker run -d --name pasta -p 8000:8000 \
  -v pasta-data:/data \
  -e ADMIN_LOGIN=admin -e ADMIN_PASSWORD=change-me \
  ghcr.io/noartem/pasta
```

The database lives in the `/data` volume (`/data/database.sqlite`). The container runs as an
unprivileged user (uid 65532), so a host directory mounted at `/data` must be writable by it:

```
mkdir -p data && sudo chown 65532:65532 data
docker run -d --name pasta -p 8000:8000 -v "$(pwd)/data:/data" --env-file .env ghcr.io/noartem/pasta
```

A database created by the previous (Laravel) version can be reused as-is: put it at
`data/database.sqlite`; the schema is upgraded in place on start.

Build locally:

```
docker build -t pasta .
```

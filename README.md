# darkfactory

ONNX kernel cost calibration toolkit. Rust CLI is the source of truth. Python and TypeScript SDKs are thin wrappers that shell out.

## Layout

```
packages/
├── rust/      Rust core + CLI binary       -> crates.io as `darkfactory`
├── python/    Python SDK (subprocess)       -> PyPI as `darkfactory`
└── ts/        TypeScript SDK (subprocess)   -> npm as `darkfactory`
```

Python/TS depend on the Rust binary being on PATH. They do not bundle. Override path via `DARKFACTORY_BIN`.

## Install

```
cargo install darkfactory      # Rust CLI (required)
pip install darkfactory        # Python SDK
pnpm add darkfactory           # TS SDK
```

## Usage

```
darkfactory --help
```

## Develop

```
just build-rust    # cargo build --workspace
just build-py      # uv build
just build-ts      # pnpm install && pnpm build
just run -- --help # cargo run -p darkfactory -- --help
just ci            # clippy + fmt-check + test-rust
```

## Release

Driven by [`putitoutthere`](https://github.com/thekevinscott/putitoutthere) via `putitoutthere.toml`. Each package independent — no cascade, since bindings don't bundle Rust.

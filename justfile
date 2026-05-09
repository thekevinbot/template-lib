default:
    @just --list

# --- build ---
build-rust:
    cargo build --workspace

build-node:
    cd packages/node && pnpm install

# --- run ---
run *ARGS:
    cargo run -p darkfactory -- {{ARGS}}

# --- test ---
test-rust:
    cargo test --workspace

# --- lint ---
clippy:
    cargo clippy --workspace -- -D warnings

fmt-check:
    cargo fmt --all -- --check

# --- ci entrypoint ---
ci: clippy fmt-check test-rust

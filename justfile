default:
    @just --list

build:
    cargo build --workspace

run *ARGS:
    cargo run -p darkfactory -- {{ARGS}}

test:
    cargo test --workspace

clippy:
    cargo clippy --workspace -- -D warnings

fmt-check:
    cargo fmt --all -- --check

ci: clippy fmt-check test

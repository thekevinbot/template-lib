set shell := ["bash", "-cu"]

default:
    @just --list

# ---- Rust core (logic + Rust SDK + CLI) -----------------------------------
# Scoped to -p mynewproduct: a bare cargo would try to build the pyo3/napi
# binding cdylibs without their FFI feature and fail to link (esp. on macOS).

rust-lint:
    cargo fmt -p mynewproduct -- --check
    cargo clippy -p mynewproduct -- -D warnings

rust-format:
    cargo fmt -p mynewproduct

rust-test:
    cargo test -p mynewproduct

rust-cov:
    cargo llvm-cov -p mynewproduct --ignore-filename-regex 'main\.rs' --fail-under-lines 90

rust-build:
    cargo build --release -p mynewproduct

# ---- Python (PyO3 SDK) ----------------------------------------------------

py-venv:
    cd packages/python && uv venv .venv --python 3.12

py-develop:
    cd packages/python && VIRTUAL_ENV="$PWD/.venv" uvx maturin develop --uv --release

py-test:
    cd packages/python && uv run --python .venv/bin/python --with pytest python -m pytest python/mynewproduct -q

py-build:
    cd packages/python && uvx maturin build --release

# ---- Node (napi SDK) ------------------------------------------------------

node-install:
    cd packages/node && pnpm install --no-frozen-lockfile

node-build:
    cd packages/node && ./node_modules/.bin/napi build --platform --release

node-lint:
    cd packages/node && ./node_modules/.bin/eslint src

node-typecheck:
    cd packages/node && ./node_modules/.bin/tsc -p tsconfig.json --noEmit

node-test:
    cd packages/node && ./node_modules/.bin/vitest run

# ---- Docs -----------------------------------------------------------------

docs-install:
    cd docs && pnpm install --no-frozen-lockfile

docs-dev:
    cd docs && pnpm run dev

docs-build:
    cd docs && pnpm run build

# ---- Aggregates -----------------------------------------------------------

lint: rust-lint node-lint
format: rust-format
test: rust-test py-test node-test
build: rust-build py-develop node-build

ci: lint test

hooks:
    pre-commit install --install-hooks

clean:
    rm -rf target packages/python/.venv packages/python/dist \
        packages/node/*.node docs/.vitepress/dist

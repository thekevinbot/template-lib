# Rust Agent-Supervision Cheatsheet

*Compressed from a learning session, 2026-05-12. Goal: supervise agent-generated Rust — catch bad patterns, know the repo conventions — without writing Rust yourself. Cross-cutting repo rules (CHANGELOG/MIGRATIONS philosophy, etc.) live in `repo.md`.*

---

## Toolchain (one-time)

```fish
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# DO NOT use `brew install rust` — gives a static install with no toolchain management.
```

This installs:
- `rustup` — toolchain manager
- `rustc` — compiler
- `cargo` — build / dep / test / run
- `rustfmt`, `clippy` — formatter and linter

## Commands you'll use

| Command | Purpose | When |
|---|---|---|
| `cargo new <name>` | New project | Starting fresh |
| `cargo check` | Type-check only, no codegen | **Inner loop** — fastest feedback |
| `cargo clippy` | Lint (check + ~700 idiom checks) | **Main supervision tool** |
| `cargo test` | Run tests | Verifying |
| `cargo run` | Compile + run | Executing locally |
| `cargo build --release` | Optimized build | Shipping |
| `cargo fmt` | Auto-format | Before committing |
| `cargo add <crate>` | Add dependency | Avoid hand-editing `Cargo.toml` |

## Watch mode

```fish
cargo install --locked bacon
cd <project>
bacon clippy     # default to clippy as the watch target
```

Use **`bacon`**, not `cargo-watch` (its own README says it's "on life support" and points users at bacon).

Press `c` for clippy, `t` for test, `w` for clippy-all, `q` to quit. `bacon.toml` per-project config supported, hot-reloaded.

> **Note**: don't run `bacon` *and* let the agent run `cargo check` at the same time — they'll fight over Cargo's project lock. Pick one. Most agent setups expect the agent to invoke cargo itself; bacon is for *you* watching in parallel.

---

## Github

Github is the source of truth.

### Github Actions

`concurrency` to cancel previous runs on the same ref:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Cheap, always wanted.

---

## Project shape

```
my-project/
├── Cargo.toml          # manifest: deps, features, edition, version
├── Cargo.lock          # locked dep versions (commit for bins; not for libs)
├── src/
│   └── main.rs         # binary entry point
│       OR
│   └── lib.rs          # library entry point
└── tests/              # integration tests (optional)
```

For libraries: add `lib.rs`. For binaries: `main.rs`. Workspaces (multi-crate) are common in real projects — agent sets up `[workspace]` in the top-level `Cargo.toml`.

---

## Cargo.toml

The manifest — deps, features, edition, version. What to check in agent output:

```toml
[package]
name = "my-crate"
version = "0.0.0"          # release tooling owns this — don't hand-bump
edition = "2024"
license = "MIT"

[dependencies]
# added via `cargo add`, not hand-edited
```

- **`edition = "2024"`** — current edition. `2021` is fine on older crates; `2018`/`2015` in new code is a smell.
- **Workspaces**: multi-crate repos put `[workspace]` in the top-level `Cargo.toml`. Member crates share deps via `[workspace.dependencies]` + `dep = { workspace = true }`; version/edition/license set once under `[workspace.package]`.
- **`Cargo.lock`**: committed for binaries and workspaces, not for standalone libraries.
- **Version**: don't hand-edit. `putitoutthere` bumps it per the `release:` trailer (see Release).
- **Deps added with `cargo add`** — a hand-edited `[dependencies]` block with no `cargo add` in the diff is worth a glance for typo'd or pinned-too-loose versions.

---

## Reading vocabulary

| Syntax | Meaning |
|---|---|
| `fn foo(x: T) -> R` | function; `->` is return type |
| `use path::to::thing;` | import |
| `let x = ...` | immutable binding (like JS `const`) |
| `let mut x = ...` | mutable binding (like JS `let`) |
| `mut` | makes things mutable; required to mutate |
| `Vec<T>` | growable list (Python `list[T]`) |
| `Option<T>` | `Some(t)` or `None` (Python `Optional[T]`) |
| `Result<T, E>` | `Ok(t)` or `Err(e)` — failure made explicit |
| `()` | the *unit type* (Python `None`-ish; TS `void`) |
| `&T` | borrowed read-only reference |
| `&mut T` | exclusive mutable reference |
| `String` / `&str` | owned / borrowed string |
| `PathBuf` / `&Path` | owned / borrowed path |
| `Vec<T>` / `&[T]` | owned / borrowed slice |
| `?` | propagate error: if `Err`, return; if `Ok(v)`, unwrap |
| `\|args\| body` | closure (lambda) |
| `\|\|` | closure with no args |
| `name!(...)` | macro invocation (compile-time code generation) |
| `#[derive(Foo)]` | generates `impl Foo for ThisType` at compile time |
| `#[cfg(test)]` | only compile when running tests |
| `pub` | public visibility |
| `mod foo;` | declare a module |
| `Self` | "this type" |
| `self`, `&self`, `&mut self` | method receivers (instance methods) |

### Key foundational concepts

- **No GC, no manual free.** Compiler inserts `drop()` at scope ends. Deterministic, zero runtime overhead.
- **Ownership.** Every value has exactly one owner. Moves transfer ownership; borrows (`&T`) loan a view.
- **Borrow checker.** At compile time, proves no use-after-free and no data races. Refuses to compile if it can't prove.
- **No inheritance.** Structs can't extend. Code reuse is via **traits** (interfaces with optional default methods).
- **Expressions, not statements.** `if/else`, blocks, `match` all evaluate to values. The last expression in a block (no `;`) is the block's value — including function returns.
- **Trait methods require the trait in scope.** `use std::io::BufRead;` to call `.lines()` on a reader. The compiler errors with "no method named X" when you forget.

---

## Idiomatic patterns (what GOOD looks like)

### Error handling
- Helper functions return precise error types: `io::Result<T>`, `Result<T, MyError>`.
- Binary `main` returns `anyhow::Result<()>`.
- Use `?` for propagation; `.with_context(|| format!("...{var}"))?` to add context at each layer.
- For libraries, define typed errors with `thiserror`. **Don't use `anyhow` in library APIs.**

### Borrowing
- **Default to `&T`.** Reach for ownership only when downstream actually needs it.
- Functions take `&str` not `String` for parameters (callers can pass either).
- Functions take `&[T]` not `Vec<T>` for slice-like inputs.
- "Pick the weakest access you need."

### Construction
- `Type::new()` for the simplest case.
- `Type::with_<thing>(...)` for variants taking config.
- `Type::from(other)` for conversions (paired with `From` trait).
- `Type::try_new()` / `try_from` for fallible variants (returns `Result`).
- For many optional fields: builder pattern. `Foo::builder().with_x(1).with_y(true).build()`.

### Iteration
- `for x in &collection` — normal. Borrowing.
- `for x in collection` — consumes. Used when downstream needs ownership.
- `for x in &mut collection` — mutable borrow.
- Iterator chains are idiomatic: `vec.iter().filter(...).map(...).collect::<Vec<_>>()`.

### Tests
- Inline unit tests at the bottom of the same file:
  ```rust
  #[cfg(test)]
  mod tests {
      use super::*;
      use std::io::Cursor;

      #[test]
      fn it_works() {
          assert_eq!(count_lines(Cursor::new("a\nb\n")).unwrap(), 2);
      }
  }
  ```
- `Cursor::new(...)` for in-memory I/O testing — pairs beautifully with generic `<R: BufRead>` signatures.
- **Doc tests** in `///` comments for public APIs — they get run by `cargo test` and keep docs verified-correct.
- Integration tests in top-level `tests/` directory (each file is a separate crate, only sees the public API).

---

## Code smells / red flags in agent output

### Critical (almost always wrong)
| Smell | Why it's bad | What to ask |
|---|---|---|
| `.unwrap()` in non-test code | Panics on error, no recovery | "What should happen if this fails?" |
| `.expect("...")` outside tests | Same; very slightly better with message | Same |
| `unsafe { ... }` in business logic | Bypasses safety. Should be confined to FFI bindings, std-library internals | "What's the underlying constraint? Could this be done safely?" |
| Tests pass but `cargo clippy` fails | Agent skipped the lint check | Run clippy; address every warning |

### Style smells (often wrong)
| Smell | Why it's bad |
|---|---|
| `.clone()` on every line | Agent dodging the borrow checker. Each clone allocates. |
| Reflexive `Arc<Mutex<T>>` | Over-defensive. Often a borrow suffices. |
| `Box<T>` everywhere | Usually unnecessary; only needed for trait objects, recursive types, large stack values. |
| Custom `macro_rules!` | Almost always overcomplicated. Use a function, trait, or existing crate. |
| `make()`, `create()`, `build_new()` constructors | Non-idiomatic. Use `new`, `with_*`, `from`, `try_new`. |
| `String` parameter where `&str` would work | Forces caller to allocate. |
| `Vec<T>` parameter where `&[T]` would work | Same. |
| `Box<dyn Error>` returned from a library | Should be a typed error via `thiserror`. |
| `let mut x` that's never reassigned | Drop the `mut`. (clippy will catch.) |
| Missing `#[derive(Debug)]` on public types | Convention is to derive Debug everywhere. |
| Magic numbers / strings | Should be named `const FOO: usize = 42;` |
| Tests only in `tests/` when `#[cfg(test)] mod tests` would work | Agent treating Rust like Python. Inline `mod tests` is the Rust way. |
| `?` everywhere with no `.with_context()` | Errors propagate but lose context. |

### Subtle smells
- **No clippy run.** Agent's diff should pass `cargo clippy` clean (or with intentional `#[allow(...)]`).
- **Trait imports in `use` for no obvious reason.** Often intentional — trait must be in scope for methods. Not a smell.
- **`type` aliases used like a renamed module.** Sometimes valid; sometimes obscuring.
- **`#[allow(dead_code)]` without explanation.** What's the dead code, and why?

### When `unsafe` IS legitimate
- FFI bindings to C libraries (PyO3, napi-rs, native libraries)
- Implementing primitive data structures (rare in application code)
- Hardware access (embedded, OS kernel)
- Specific verified-by-hand performance optimizations

If `unsafe` appears outside these categories, treat it as a strong red flag.

---

## Public API design

- **`pub` is the API surface.** Anything `pub` in `lib.rs` (or re-exported through it) is a contract. Agents over-expose — scan for `pub` on things that should be `pub(crate)` or private.
- **Re-export the public surface from `lib.rs`.** `pub use` the handful of types/functions consumers need; keep paths shallow. Deep `my_crate::internal::detail::Thing` leaking to consumers is a smell.
- **Typed errors with `thiserror`** for libraries — one variant per failure mode, `#[error("...")]` messages. No `anyhow` in a library's public API; no `Box<dyn Error>` returned from a library.
- **`#[derive(Debug)]` on every public type.** Convention. Add `Clone` / `PartialEq` / `Eq` / `Hash` deliberately, where the type's semantics support them.
- **Doc comments (`///`) on every public item**, with a runnable example where it earns one — doc tests run under `cargo test`, so the docs can't silently rot. Prose explains *why*; the signature carries the *what*.
- **Constructors follow `new` / `with_*` / `from` / `try_*`** — `make()` / `create()` / `build_new()` are non-idiomatic (see Code smells).
- **`#[non_exhaustive]`** on public enums/structs that may grow — lets you add variants later without a breaking change.
- **Semver discipline.** Adding a variant to a non-`#[non_exhaustive]` public enum, changing a signature, removing a `pub` item — all breaking. The `release:` trailer must reflect it.

---

## CLI architecture

**Every CLI in this repo is a Rust binary.** The Python and Node packages are thin wrappers that put the compiled binary on `PATH` through `pip install` / `npm install -g`. Argument parsing, validation, exit codes, the whole runtime live in the crate.

Why: cross-platform distribution is a solved problem in Rust (one static binary per target), `clap` is the strongest CLI framework in any ecosystem, and one source of truth keeps argument grammar, help text, and error messages identical across every install path.

For the Rust reviewer this makes the crate the high-stakes package — the wrappers carry almost no logic; the crate carries all of it.

```
my-tool/
  packages/
    rust/              # binary crate — Cargo.toml, src/main.rs (clap App)
    node/              # npm wrapper — launcher resolves the per-platform binary
    python/            # PyPI wrapper — entrypoint execs the staged binary
  putitoutthere.toml
```

What to check:

- **`clap` with the derive API** — `#[derive(Parser)]` structs, not hand-rolled arg parsing.
- **`main` returns `anyhow::Result<()>`** — `?` propagates, the error prints, the process exits non-zero. No `.unwrap()` in `main`.
- **Exit codes are deliberate** — documented codes via `std::process::exit`, or `anyhow` for the catch-all non-zero.
- **The crate is tested in Rust** (`cargo test`); the wrappers ship one happy-path e2e each. CLI grammar is defined once, in `clap`.

The full three-artifact shape (Rust crate + npm wrapper + PyPI wheel) and the wrapper launchers are in `typescript-supervision.md` / `python-supervision.md`.

---

## CI/CD

`.github/workflows/` shape:

| Workflow | Purpose | Trigger |
|---|---|---|
| `test.yml` | `cargo test` | every push/PR |
| `lint.yml` | `cargo clippy -- -D warnings` + `cargo fmt --check` | every push/PR |
| `check.yml` | `cargo check` | every push/PR |
| `docs.yml` | `cargo doc` build (catches broken intra-doc links) | push to main |
| `release.yml` | `uses: thekevinscott/putitoutthere/.github/workflows/release.yml@v0` | push to main |
| `changelog-check.yml` | CHANGELOG.md + MIGRATIONS.md touched (or `skip-changelog:` trailer) | every PR |

```yaml
- uses: actions/checkout@v6
- uses: dtolnay/rust-toolchain@stable
  with:
    components: clippy, rustfmt
- uses: Swatinem/rust-cache@v2
- run: cargo clippy -- -D warnings
```

- **`dtolnay/rust-toolchain`**, not the deprecated `actions-rs/*` actions.
- **`Swatinem/rust-cache`** caches `~/.cargo` and `target/` — meaningful speedup.
- **`-D warnings`** on clippy in CI — warnings block merge.
- **Path filters** so docs-only PRs skip the build.
- **Concurrency** to cancel previous runs on the same ref (see Github).
- **Matrix**: Ubuntu-only for tests. Matrix on OS (Ubuntu, macOS, Windows) only for the per-target binary builds at release.

---

## Release

**Use `putitoutthere`.** Single reusable workflow, single config file, OIDC trusted publishers across crates.io / PyPI / npm. Provenance, retry-with-backoff, tag rollback, registry idempotency are all inside the workflow. CHANGELOG/MIGRATIONS philosophy is cross-cutting — see `repo.md`.

### `putitoutthere.toml`

Repo-root config. A crate-only package:

```toml
[putitoutthere]
version = 1

[[package]]
name          = "my-crate"
kind          = "crates"
crate         = "my-crate"
path          = "."
first_version = "0.0.1"
globs         = ["src/**", "Cargo.toml", "Cargo.lock", "LICENSE"]
```

When the crate is the core of a polyglot CLI it's the first package in the dependency graph — the npm and PyPI wrappers `depends_on` it and publish with the same version. Full three-artifact `putitoutthere.toml` is in `python-supervision.md` / `typescript-supervision.md`.

### Reusable workflow

`.github/workflows/release.yml`:

```yaml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    uses: thekevinscott/putitoutthere/.github/workflows/release.yml@v0
    permissions:
      contents: write
      id-token: write
```

The workflow drives `plan → build → publish → GitHub Release`. Consumer-side YAML stays at the stub above.

### Release trailer

Default cascade bump is `patch`. Override in the merge-commit body:

```
fix: handle empty input

release: minor
```

Grammar: `release: {patch|minor|major|skip} [pkg1, pkg2, ...]`. Last trailer wins. `putitoutthere` owns the version — don't hand-edit `Cargo.toml`.

### Trusted publishers

One-time crates.io setup: publish once via classic `cargo publish`, then enable trusted publishing under `https://crates.io/crates/<crate>/settings`. After that the workflow authenticates via OIDC only — no long-lived registry token in CI.

---

## Docs

**`cargo doc` is the API reference.** `///` doc comments compile to HTML; published crates land on `docs.rs` automatically with no extra config.

- **Doc tests run under `cargo test`** — examples in `///` blocks are verified, so they can't drift from the code.
- **`#![warn(missing_docs)]`** at the crate root makes an undocumented `pub` item a warning — pair with `-D warnings` in CI to make it block merge.
- **`//!` module-level docs** at the top of `lib.rs` and each module — the crate's front page on docs.rs.
- For a richer prose doc *site* (guides, not just API reference), `mdBook` is the standard. Most crates don't need it — `cargo doc` plus a good README is enough.

---

## Ecosystem cheat sheet

Common crates an agent should reach for. If they pick something off-brand for a standard task, ask why.

| Task | De facto crate |
|---|---|
| CLI args | `clap` |
| Serialization | `serde` + `serde_json` / `serde_yaml` / `bincode` |
| Async runtime | `tokio` |
| Error handling (binary) | `anyhow` |
| Error definition (library) | `thiserror` |
| HTTP client | `reqwest` |
| Web framework | `axum` (modern) or `actix-web` (more mature) |
| Database (async) | `sqlx` |
| Database (sync, ORM) | `diesel` |
| Structured logging | `tracing` |
| Data parallelism | `rayon` |
| Python bindings | `pyo3` |
| Node/JS bindings | `napi-rs` |

---

## Pre-review tooling pass

Before any line-by-line read, run these. They mechanically eliminate most smells:

```fish
cargo check         # does it compile?
cargo clippy        # is it idiomatic?
cargo test          # do tests pass?
cargo fmt --check   # is it formatted?
```

If the agent didn't run these, ask it to. If they fail, the agent should fix before you spend reviewer time.

## Reading-a-PR checklist

1. **Tooling pass** — all four green?
2. **`.unwrap()` / `.expect()` / `unsafe`** — scan for these, pause on each.
3. **Function signatures** — `&T` where appropriate, or unnecessarily `T`?
4. **Error context** — every `?` chain has `.with_context(...)` somewhere upstream?
5. **Tests** — inline `#[cfg(test)] mod tests`? Cover the public surface?
6. **`Cargo.toml` changes** — new crates reputable (see ecosystem table)?
7. **Reinvention** — did the agent rebuild something a standard crate provides?
8. **Naming** — `new`/`with_*`/`from`/`try_*` for constructors?
9. **Public API** — `pub` surface intentional (not over-exposed); typed `thiserror` errors in libraries; `#[non_exhaustive]` where the type will grow.
10. **CHANGELOG.md + MIGRATIONS.md** — both touched for any consumer-observable change, or a `skip-changelog:` trailer present (philosophy in `repo.md`).
11. **`putitoutthere.toml`** — `globs` cover every source path that should cascade a release; polyglot CLIs declare `depends_on` correctly.

---

## Memory model in one paragraph

Variables own their values. Values are freed at the closing brace of their owner's scope (compiler inserts `drop()` — deterministic, no GC). You can transfer ownership by *moving* (`let y = x;` makes `y` the owner and `x` unusable), or you can loan a *borrow* via `&` (cheap, compile-time-checked, no ownership transfer). `&T` is read-only; `&mut T` is exclusive read-write. The borrow checker proves at compile time that no borrow outlives its owner and no mutable borrow coexists with any other borrow. Multiple owners require opt-in reference counting (`Rc<T>` for single-threaded, `Arc<T>` for shared across threads).

## Compiler error vocabulary

- "*expected `X`, found `Y`*" — type mismatch. Often a missing `&`, missing `.to_string()`, etc.
- "*no method named `foo` found*" — usually means a trait isn't in scope. Add the `use` for the trait.
- "*cannot borrow `x` as mutable, as it is not declared as mutable*" — add `mut` to the `let`.
- "*value moved here, but borrow occurs later*" — you consumed when you should have borrowed.
- "*does not live long enough*" — a borrow outlives the owner. Restructure or own.
- "*cannot move out of borrowed content*" — you tried to consume something you only have a borrow to.

---

## One-paragraph summary

`rustup`-managed toolchain, `cargo` for build/test/lint, `clippy` as the main supervision tool with `bacon` for watch. Ownership and the borrow checker mean no GC and compile-time-proven memory safety; reading Rust well is mostly reading borrows (`&T` / `&mut T`), `Result` / `Option`, and `?` propagation. Good agent output: typed errors via `thiserror` in libraries, `anyhow` only in binaries, `&str` / `&[T]` parameters over owned, idiomatic `new` / `with_*` / `from` / `try_*` constructors, inline `#[cfg(test)] mod tests`, no `.unwrap()` or `unsafe` outside FFI. The smell tables catch most bad patterns mechanically — reflexive `.clone()`, `Arc<Mutex<T>>`, `Box` everywhere, custom `macro_rules!`. Project conventions parallel the other two language docs: Github is the source of truth, `putitoutthere` drives cross-registry releases from `putitoutthere.toml` and a short reusable workflow, CHANGELOG.md + MIGRATIONS.md update on every consumer-observable change (philosophy in `repo.md`), CI runs clippy/fmt/test as separate jobs with path filters. Every CLI is a Rust crate with `clap` — the Python and Node packages just put the binary on `PATH`, so the crate is the high-stakes package to review. Before any line-by-line read: `cargo check`, `cargo clippy`, `cargo test`, `cargo fmt --check` all green.

# Architecture

One Rust core is the single source of truth. It is re-exposed as **importable,
native-feeling SDKs** in Python (PyO3) and TypeScript (napi) — each binding *is*
that language's SDK, with no separate veneer layer. The CLI is written once in
Rust and exposed through every binding.

```
packages/
  rust/core/   crate `mynewproduct` — logic + idiomatic Rust SDK + the CLI (run_cli) + the binary
  python/      PyO3 cdylib — IS the Python SDK (idiomatic via macros) + .pyi stubs + 1-line CLI entry
  node/        napi cdylib — IS the TS SDK (generated .d.ts) + 1-line CLI entry
```

## Two layers, not three

The idiom lives in the binding, expressed directly via PyO3/napi macros — custom
exception (`WordCountError`), `len()`/`in`, keyword args on the Python side;
`.code`-based errors and array returns on the TS side. There is no hand-written
veneer to keep in sync. Generated artifacts carry the types: a `.pyi` stub for
Python (hand-written for now; should be `pyo3-stub-gen` + a CI freshness diff),
and napi's `index.d.ts` for TypeScript.

## CLI — one implementation

`run_cli(args) -> i32` lives in the core (clap, returns a code, never
`process::exit`). The Rust binary calls it; each binding re-exports it; each
ecosystem's command is a one-line entry point forwarding argv. One implementation
means CLI behavior can't drift between languages.

## Cargo workspace

`default-members = [core]`: a bare `cargo build`/`clippy` builds only the core.
The pyo3/napi binding crates are cdylibs that need their FFI feature
(`extension-module`) to link and fail under a bare cargo (esp. macOS). Scope every
cargo invocation to `-p mynewproduct`. Binding crates carry **zero `#[cfg(test)]`**
(a test binary would link libpython); they're exercised by the per-language tests.

## Tests — three tiers, no overlap

- **Core `#[cfg(test)]`** — logic depth (the only place logic lives).
- **Per-language** (pytest / vitest) — that language's surface: marshalling, the
  error mapping, idiom, the CLI entry. The load-bearing tier.
- No golden-file/conformance suite. Because there is one core, the SDKs can't
  disagree on logic; the per-language tests cover the thin binding relay. (If
  cross-binding assurance is ever wanted, add differential testing, not a curated
  oracle.)

## Versioning

`[workspace.package].version` is the single source; the core surfaces it as
`VERSION`, the bindings as `__version__` / `version()`; maturin reads it for the
wheel. A release-time preflight should assert it matches the planned published
version.

## Release flow

`putitoutthere.toml` declares: crates.io (`mynewproduct` — lib + bin), PyPI
(maturin **abi3-py312** wheel, one wheel for 3.12+), npm (napi addon: top package +
per-triple `optionalDependencies` using napi short-form triples so the loader's
require-names match the published package names). Edits under
`packages/rust/core/**` cascade to the PyPI + npm builds. One npm prerequisite
lives upstream in putitoutthere — see `notes/piot-napi-handoff.md`.

## CI gates

- `rust.yml` / `python.yml` / `node.yml` — per-language lint + test + build, path-filtered.
- `changelog.yml` — `CHANGELOG.md` + `MIGRATIONS.md` on public-API PRs.
- `conventions.yml` — colocated-test enforcement (Python under `packages/python`,
  TS under `packages/node/src`; Rust uses inline `#[cfg(test)]`).
- `docs.yml` — builds + deploys the VitePress site.

## Public-API surface

Per `internals/repo.md`: every exported value/type in each SDK, every CLI flag,
the TS error `.code` set, every observable artifact. Changes require
`CHANGELOG.md` + `MIGRATIONS.md`.

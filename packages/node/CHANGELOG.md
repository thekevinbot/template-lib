# Changelog

All notable changes to this package are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- An **importable TypeScript SDK**: `import { Counter, Entry, WordCountError,
  version } from 'mynewproduct'`. A native veneer (options object, `Entry`
  interface, `Symbol.iterator`, `size`/`has`, `WordCountError extends Error`,
  camelCase) over a napi binding to the shared Rust core. Importable from both ESM
  and CommonJS consumers.

### Changed

- **BREAKING** The package is now a **napi addon** (importable in-process),
  shipped as a top package plus per-platform `optionalDependencies` carrying the
  `.node`. Previously it was a `bin-shim` wrapper that only exec'd a bundled Rust
  binary. The `mynewproduct` CLI remains. See [MIGRATIONS.md](./MIGRATIONS.md).
- Raise the minimum supported Node.js to 22 (`engines.node` `>=20.20.0` →
  `>=22`); Node 20 reached end-of-life on 2026-04-30, so the floor moves to the
  lowest LTS still receiving updates.

### Deprecated

### Removed

- **BREAKING** The `bin-shim` runtime dependency and the bundled-binary
  optionalDependencies (`@mynewproduct/<rust-triple>`) are gone, replaced by napi
  short-form platform packages (`mynewproduct-<napi-triple>`).

### Fixed

# Changelog

All notable changes to this package are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- `mynewproduct` core SDK: `Counter`, `Entry`, `CountError`, `VERSION` — an
  idiomatic Rust word-frequency API, the single source of truth for all three
  language SDKs.
- `mynewproduct-cli` crate: the Rust CLI, now a thin shim over the core SDK.

### Changed

- **BREAKING** The single `mynewproduct` crate (lib + bin) is split into
  `mynewproduct` (library/SDK) and `mynewproduct-cli` (binary). The repo is now a
  Cargo workspace. See [MIGRATIONS.md](./MIGRATIONS.md).

### Deprecated

### Removed

### Fixed

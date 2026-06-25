# Changelog

All notable changes to this package are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- An **importable Python SDK**: `from mynewproduct import Counter, Entry,
  WordCountError, __version__`. A native veneer (frozen `Entry` dataclass,
  generator `__iter__`, `len()`/`in`, keyword args, a typed exception) over a
  PyO3 binding to the shared Rust core.

### Changed

- **BREAKING** The package is now a PyO3 **extension module** (importable),
  built as an **abi3-py312** wheel. Previously it only bundled the Rust binary
  onto `PATH` (`bindings = "bin"`). The `mynewproduct` console script remains.
  See [MIGRATIONS.md](./MIGRATIONS.md).

### Deprecated

### Removed

### Fixed

# Migrations

Upgrade notes for breaking changes. New entries go under `## Unreleased`.
On release, the section is renamed to `## v<OLD> → v<NEW>`.

Each entry has five sections, in order:

1. **Summary** — one paragraph: what changed and why.
2. **Required changes** — before/after for public API. "None" if purely additive.
3. **Deprecations removed** — anything previously warned about that's now gone.
4. **Behavior changes without code changes** — same API, different runtime behavior.
5. **Verification** — commands that confirm the upgrade worked, with expected output.

## Unreleased

### Summary

The project moved from "one Rust binary repackaged through three package
managers" to "one Rust core re-exposed as importable SDKs". The former single
`mynewproduct` crate (library + binary) is split into a library crate
(`mynewproduct`, the SDK) and a binary crate (`mynewproduct-cli`, a thin CLI over
it), under a Cargo workspace. This lets the same core back the PyO3 and napi SDKs
without the CLI's `clap`/`anyhow` deps leaking into library consumers.

### Required changes

- Library users: depend on `mynewproduct` as before; the API gains `Counter`,
  `Entry`, `CountError`, `VERSION`.
- CLI users: the binary now ships from a separate crate.

  ```
  # before
  cargo install mynewproduct
  # after
  cargo install mynewproduct-cli
  ```

### Deprecations removed

None.

### Behavior changes without code changes

None — the CLI's flags and output are unchanged.

### Verification

```bash
cargo add mynewproduct          # SDK is importable
cargo install mynewproduct-cli
mynewproduct --top 2 "a a b"    # => "a\t2"
```

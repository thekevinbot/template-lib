# putitoutthere edits needed for the template-lib SDK restructure

template-lib is moving from "one Rust binary repackaged 3 ways" to "one Rust core +
importable Python/TS SDKs (PyO3 + napi)". The pypi (`build = "maturin"`, `bindings = "pyo3"`)
path works on `@v0` as-is. The **npm `build = "napi"`** path needs one workflow edit, and the
version model needs one confirmation. Both live in `putitoutthere`, not template-lib.

## 1. (BLOCKER) Add a napi per-target build branch to the PUBLIC `release.yml@v0`

`.github/workflows/release.yml` currently has ONE npm build step (~lines 156–170):

```yaml
- if: matrix.kind == 'npm'
  working-directory: ...
  run: |
    # npm ci / pnpm install ...
    npm run build --if-present
```

It does NOT set `TARGET`, install a Rust toolchain, or pass `--target`. So
`napi build --platform` runs once for the host only, writes the `.node` to the package root,
and never produces the per-triple artifacts that `npm-platform.ts` expects under
`artifacts/<name>-<triple>/`. (The internal `e2e-fixture.yml` DOES inject `TARGET` — that's
why napi mode passes e2e but not real releases.)

**Fix:** mirror `e2e-fixture.yml`'s napi rows in `release.yml`. For npm rows whose target is a
real triple (not `main`/`noarch`):

```yaml
- if: matrix.kind == 'npm' && matrix.build == 'napi' && matrix.target != 'main' && matrix.target != 'noarch'
  uses: dtolnay/rust-toolchain@stable
- if: matrix.kind == 'npm' && matrix.build == 'napi' && matrix.target != 'main' && matrix.target != 'noarch'
  working-directory: <pkg.path>
  shell: bash
  env:
    TARGET: ${{ matrix.target }}      # napi short-form, e.g. linux-x64-gnu
  run: |
    # install deps (reuse the existing pnpm/npm detect block)
    npm run build --if-present        # build script: napi build --platform --release --target $TARGET
    # stage to build/<triple>/ so the publisher's artifact glob finds the .node
```

The template's `package.json` build script will be `napi build --platform --release` and read
`$TARGET`. Confirm the staging path matches what `plan.ts` emits as `artifact_path`
(`build/<triple>`) and what `npm-platform.ts` globs.

## 2. (CONFIRM) Version model — wire a release-time assertion

template-lib makes the Rust **workspace version** the single source: `VERSION` /
`__version__` / `version()` all derive from `CARGO_PKG_VERSION`, and `fixtures.json` embeds it.
But piot derives the *release* version independently and `pypi.writeVersion` only LOGS guidance
for dynamic versions. Risk: crate version and the published npm/wheel versions drift.

Need to know: does piot **compute** the next version (from tags/commits) or **read** it from a
manifest? 
- If it reads a manifest: point it at `[workspace.package].version` and we're done.
- If it computes: template-lib's Release should run a preflight that asserts
  `cargo metadata` workspace version == piot's planned version, failing otherwise. We bump
  `[workspace.package].version` by hand each release; the assert prevents skew.

Either way the template side adds the bump discipline; piot just needs to expose its planned
version to a preflight (or accept the manifest as source).

## Not needed
- No changes for pypi: `build = "maturin"` runs `maturin-action command: build` against our
  `pyproject.toml` (`bindings = "pyo3"`, abi3-py312) and the publish side is wheel-agnostic.
- `bundle_cli` is the bin-staging recipe; we do NOT use it.
- TRIPLE_MAP already covers musl + the short-form triples we'll list in `targets`.

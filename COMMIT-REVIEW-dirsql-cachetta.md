# Upstream-drift review: dirsql & cachetta → template-lib

**Generated:** 2026-06-07
**Question asked:** Pull every commit made in `thekevinscott/dirsql` and
`thekevinscott/cachetta` *after* template-lib's most recent commit, then for
each commit answer (a) what changed and (b) whether it's worth bringing back
into this template library.

## Method & scope notes

- **Cutoff** = template-lib's latest commit `fb70f79`
  (*"Document first-publish prereqs…"*, 2026-05-18 13:53 -0400 / `2026-05-18T17:53:43Z`).
- Both repos are **public, MIT-licensed**, and were reachable via direct `git clone`.
  (The GitHub MCP tools in this session are scope-locked to `thekevinbot/template-lib`,
  so `list_commits` on them was denied — plain `git` over the network worked.)
- dirsql is **Rust + Python + TypeScript**; cachetta is **Python + JS/TS**. Both were
  scaffolded *from* this template, so the relevance lens throughout is:
  **does the change improve shared scaffolding / tooling / conventions (backport
  candidate) or is it project-specific feature code (leave it)?**
- **Nothing has been merged or applied.** This is a review only — no template files
  were changed.
- **Filename mapping** (downstream → template) to apply when backporting:
  `rust-test.yml→rust.yml`, `python-test.yml→python.yml`, `ts-test.yml→node.yml`,
  `docs-test.yml→docs.yml`, `changelog-check.yml→changelog.yml`. cachetta also uses
  `packages/javascript` where the template uses `packages/node`.

**Totals:** dirsql ≈ 70 commits, cachetta = 36 commits. Most "No" verdicts are
project feature code or TDD red/green pairs for that project's own behavior.

---

## Consolidated backport candidates (the actionable part)

Ranked roughly by value / cleanliness. Each is a *convention or tooling* change;
when a source commit also carried project-specific code, take only the reusable part.

### Tooling & type-checking
1. **Adopt Astral `ty` for strict Python type-checking** (replaces/supplements `mypy`).
   New typecheck workflow + `[tool.ty]` config + ruff `PGH003` + `py.typed`/PEP 561.
   → dirsql `cd37441`; cachetta `fbacd3d`, and exclude the `setup.py` build shim from ty `5c72508`.
2. **Dedicated `tsc --noEmit` type-check CI job**, decoupled from the build so it fails fast.
   → dirsql `8ae1ea2` (+ wireit `tsc` test dep `27ed637`).
3. **Biome lint hardening** — enable `lint/style/useBlockStatements`, pin
   `javascript.formatter.semicolons: "always"`. → dirsql `adb919a`.
4. **Deterministic lint via pinned `flake8`** (exact pin in pyproject). → cachetta `7553112`.
5. **Unit-test mock-isolation lint** — ESLint `mock-collaborators` rule + in-repo
   `flake8-mock-isolation` plugin + scoped `.flake8`. → cachetta `3090d11`.

### Coverage policy
6. **Gate Rust branch coverage on a pinned nightly** — `cargo llvm-cov --branch` with an
   awk-parsed floor (cargo-llvm-cov has no `--fail-under-branches`). → dirsql `8c7541a`.
7. **100% unit patch-coverage + non-regression floor** — diff-cover gate, vitest/pytest
   coverage config, `Skip-Coverage:` trailer. → cachetta `2753fe6`; 100%-incl-branches `32e20a2`;
   dirsql honest floor bumps + `--cov-branch` + number-free check names `fae6aee`.
8. **Coverage omit convention** — exclude colocated test files (`*_test.py`/`*.test.ts`)
   and only the thin `bin`/launcher shim, not whole modules. → dirsql `5173442`, `fae6aee`.

### Test layout / boundaries
9. **Location-based unit/integration split** — colocated `src/**/*_test.py` &
   `src/**/*.test.ts` are unit; `tests/` is integration; coverage gated by *location* not a marker.
   → cachetta `1982c17`, `29ade9d`, `a2b2e8c`; dirsql colocated layout `95e15f5`.
10. **`internals/` boundary guard** — `check_boundary.py` + a CI workflow enforcing the
    unit/integration boundary. → cachetta `e604d29`.
11. **Keep colocated `*_test.py` out of wheel & sdist** — MANIFEST.in exclusions + setup.py
    shim + coverage omit. → cachetta `f6e9bbd`.
12. **Shared `cli/` directory name** across Python + TS launchers (was `_cli/` & `src/bin/`).
    → dirsql `630bdb0`.

### Packaging / monorepo structure
13. **Ship `docs/` recursively in npm + PyPI** — `sync-docs.sh` recursion + pyproject
    `docs/**/*.md` package-data glob. → cachetta `06c062d`.
14. **Reorganize napi binding into its own crate** under `packages/ts/napi`, pure-TS package
    with `src/` layout + matching CI path-filters / changelog globs / workspace members.
    → dirsql `47ec51b`.
15. **`requires-python >=3.11` floor** in pyproject. → dirsql `853bace`.
16. **pnpm 11 standardization / esbuild build-approval** — `allowBuilds` map in
    `pnpm-workspace.yaml`, drop the pnpm-10 `onlyBuiltDependencies` shim, trigger JS CI on
    `pnpm-workspace.yaml` changes. → cachetta `67e87ad`, `73cac19`, `08afcf8`.

### Release & CI ergonomics
17. **Manual release via `workflow_dispatch` input** (`release_packages` forwarded to the
    putitoutthere reusable workflow). → dirsql `d515dbc`.
18. **putitoutthere `[package.bundle_cli]` conventions** — `crate_path` at the member crate
    (drops the `packages/rust/target` symlink hack that tripped crates.io 413); npm bundle_cli
    declaration for the musl path. → dirsql `9172f22`, `f549360`.
19. **Cache Playwright browsers in docs CI** — `actions/cache@v4` on `~/.cache/ms-playwright`
    keyed on the docs lockfile; + Playwright bump & `pr-monitor` action-source swap to
    `thekevinscott/pr-monitor@v1`. → dirsql `3782550`, `b880a46`.
20. **Pre-integration native-binary build step** — `cargo build --release -p <pkg> --features cli`
    before integration tests. → dirsql `27ed637`, `fc5737e`.

### Agent contract (CLAUDE.md / AGENTS.md) conventions
21. **Docs-update enforcement for public src changes** — a `docs-check` workflow mirroring
    `changelog.yml`, with a `Skip-Docs:` trailer + policy text. → cachetta `b91f53f`.
22. **Assorted AGENTS.md rules worth folding into CLAUDE.md/internals:** "CI must go red for
    the right reason before implementing" (dirsql `925ed94`); rewritten Test Boundaries /
    prefer-mock-over-DI, ban pytest `monkeypatch` (`5173442`, `b23087f`); "coverage floor =
    unit tests only" (`ede7dbf`); "Imports / Manually exercise new features" (`d84eaad`);
    environment-aware remote-session + GitHub-issue workflow notes (cachetta `e7b6a0e`);
    TDD red-first section (cachetta `093728e`).

> **Caveat for the coverage / ty / mock-isolation PRs:** in both repos the reusable gate is
> interleaved with project-specific test backfill. Backport the workflow/config, drop the
> per-project test changes.

---

## dirsql — per-commit verdicts

| sha | subject | verdict |
|---|---|---|
| 9172f22 | fix(release): drop packages/rust/target symlink (crates.io 413) #182 | **Yes** |
| d9d3c89 | docs: consolidate CLI docs into dedicated section | No |
| 8c4ffb3 | docs: trim low-value docs tests | No |
| 5d49e07 | ci: re-trigger precheck after putitoutthere fix | No (no-op) |
| 9735c04 | Merge #181 | No |
| 81ad5d1 | chore(release): cut 0.3.6 | No (version bump) |
| 853bace | fix(py): drop Python 3.10 (requires-python >=3.11) | **Partial** |
| fab7691 | Merge #183 | No |
| 925ed94 | Require CI red for the right reason before implementing | **Yes** (AGENTS.md) |
| 84d6ed6 | test: binary file under glob (RED) | No |
| caa7fec | test: rustfmt the RED test | No |
| ba0922d | Drop `content` from `extract` callback | No (API feature) |
| 9901392 | test: ruff format Python tests | No |
| 140f0ce | test: zero-config serves `files` table (RED) | No |
| 4feecad | Serve default `files` table when no config | No (feature) |
| 1aca957 | Update config.md | No |
| eaff02b | Update server.md | No |
| 6b91f2e | Merge #185 | No |
| d515dbc | feat(ci): manual release via workflow_dispatch input #187 | **Yes** |
| 0bc7240 | Merge #187 | No |
| f549360 | fix(release): [package.bundle_cli] for dirsql-npm (musl) #190 | **Partial** |
| 47ec51b | Reorganize TS package: move napi binding to separate crate #200 | **Partial** |
| 8c7541a | ci(rust): gate branch coverage on nightly #206 | **Yes** |
| fae6aee | test: raise coverage floors honestly (Rust/Py/TS) | **Partial** |
| 0bd9e3c | docs(python): refresh _cli coverage-omit comment | No |
| 86272f5 | Merge #201 | No |
| 4fb8384 | test: red integration tests for config serialization | No |
| bff9284 | feat: language-idiomatic config serialization | No |
| caba7f5 | refactor: serialize config eagerly, drop ready() gate | No |
| 0b52b2f | refactor: tighten _resolve_config / resolveConfig | No |
| 80304de | refactor: extract config resolver to own module | No |
| b5e478f | rename: _resolve.py -> resolve_config.py | No |
| 95e15f5 | test: colocated unit tests for resolve_config | **Partial** (layout) |
| 58d04b5 | docs: trim CHANGELOG/API/PARITY | No |
| 55a2022 | Merge #197 | No |
| 630bdb0 | rename: _cli/ & src/bin/ to shared cli/ #210 | **Partial** |
| 77cd06e | Merge #212 | No |
| 5173442 | test: drop CLI launcher coverage excludes; DI seams + unit tests #211 | **Partial** |
| adb919a | style(ts): enforce useBlockStatements; AGENTS mock>DI | **Yes** |
| b23087f | refactor: drop launcher DI seams; mock.patch.object / vi.mock | **Partial** |
| b298c12 | Merge #214 | No |
| cd37441 | feat(python): strict type-checking with ty + baseline | **Yes** |
| 8ae1ea2 | feat(ts): dedicated tsc --noEmit type-check job | **Yes** |
| 56d0d8f | Merge #215 | No |
| f00c963…5dc9917 | PR #209 `dirsql interpret` subcommand (15 commits) | No, except: |
| ede7dbf | docs(agents): "coverage floor = unit tests only" | **Yes** (AGENTS.md) |
| d84eaad | refactor(cli): relative imports + AGENTS sections | **Yes** (AGENTS.md) |
| 5e94ea4 | Merge #209 | No |
| 098eefd | test(ts): red test for `Table` export | No |
| c8dd2ad | feat(ts): add `Table` class export | No |
| c5f18a3 | Merge #217 | No |
| 27ed637 | test(cli): red tests for native-language config | **Partial** (CI step) |
| fc5737e | feat(cli): Rust binary dispatches --config .{py,js,mjs,cjs} | **Partial** (CI step) |
| be13c40 | Merge #192 | No |
| 89c735c | test: red tests for code review findings | No |
| fddccda | fix(rust): address code review findings | No |
| 4a45ceb | style: cargo fmt | No |
| d50f847 | chore: empty commit to retrigger CI | No (no-op) |
| 7a92192 | Merge #219 | No |
| 3782550 | ci(docs): cache Playwright browsers #221 | **Yes** |
| b880a46 | ci: bump Playwright 1.60.0 + swap pr-monitor source #223 | **Yes** |
| e237d64 | docs(cli): document native-language config files | No |
| 6536c7e | Merge #220 | No |

## cachetta — per-commit verdicts

| sha | subject | verdict |
|---|---|---|
| e7b6a0e | docs: environment-aware agent notes + GitHub-issue workflow | **Partial** |
| 8727a72 | Merge #51 | **Partial** |
| d1ac201 | test(py): failing tests for `/` operator | No |
| 150ab8f | feat(py): `/` operator accepts callables | No |
| 558b30c | Merge #47 | No |
| b91f53f | chore: require docs updates for public src changes #52 | **Partial** (docs-check wf) |
| 67e87ad | fix: approve esbuild builds for pnpm 11 #53 | **Yes** |
| 08afcf8 | ci: trigger JS workflows on pnpm-workspace.yaml #53 | **Yes** |
| 73cac19 | chore: standardize on pnpm 11+, drop pnpm-10 shim #53 | **Yes** |
| 49eca68 | Merge #54 | **Yes** |
| 093728e | test: red integration tests for nested docs packaging #56 | **Partial** |
| 06c062d | fix: ship docs/ recursively in npm + PyPI #56 | **Yes** |
| 6b63dbe | Merge #59 | **Partial** |
| fbacd3d | chore: add strict ty type-checking gate | **Partial** (workflow/config) |
| 434a9aa | Merge #61 | **Partial** |
| 2753fe6 | ci: enforce 100% unit patch coverage + non-regression floor | **Partial** (gate) |
| b90bf0c | Merge #62 | **Partial** |
| 32e20a2 | ci: require 100% unit coverage incl. branches #66 | **Partial** (gate) |
| 3090d11 | test: enforce unit-test mock isolation via lint #70 | **Partial** (lint) |
| 7553112 | chore: pin flake8 for deterministic lint gate | **Yes** |
| 08ab5e3 | Merge #72 | **Yes** |
| 76e9034 | test: red tests for public `hash` helper | No |
| 527774e | feat: expose internal arg-hashing as public `hash()` | No |
| a190b7e | Merge #58 | No |
| f5dcc79 | test: red tests for literal-path semantics | No |
| 0b79bc4 | feat: remove implicit sibling-hash path rewriting | No |
| cc20a4a | test: update slash-operator subfolder tests | No |
| 390e3b0 | Merge #48 | No |
| 1982c17 | ci(python): gate unit coverage on src/ colocated tests | **Yes** |
| 29ade9d | test(python): relocate unit tests into src/ colocation | **Partial** |
| f6e9bbd | build(python): keep colocated *_test.py out of wheel/sdist | **Yes** |
| e604d29 | ci: add internals/ boundary guard | **Yes** |
| a2b2e8c | docs: define unit/integration boundary by location (AGENTS.md) | **Yes** |
| 5c72508 | build(python): exclude setup.py shim from ty | **Yes** |
| cdb0dd3 | Merge #75 | **Partial** |
| e90fbe1 | test: red integration tests for `hashed=True` flag | No |
| ba2fd2d | feat: honor `hashed=True` in _get_path/_getPath | No |
| b5a8ca8 | Merge #73 | No |

---

## Bottom line

There is **no "pull these commits in" merge to do** — dirsql and cachetta are downstream
products, and the bulk of their post-cutoff work is product features (SQL serving, config
serialization, `interpret`, `Table` export — cache `/` operator, `hash()`, `hashed=True`,
literal-path semantics) that does **not** belong in the template.

What *is* worth harvesting is the **~22 scaffolding/convention improvements** above — most
valuably the `ty` + `tsc --noEmit` type-check jobs, the branch-coverage and 100%-unit-coverage
gates, the location-based unit/integration test split with `internals/` boundary guard, the
recursive-docs packaging fix, the pnpm-11/esbuild handling, manual `workflow_dispatch` releases,
and the putitoutthere `bundle_cli` cleanup. These are convergent — both repos independently
hardened type-checking, coverage, and test-layout — which is a strong signal they belong in the
shared template rather than being re-derived per project.

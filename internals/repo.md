# Repo-wide conventions

Cross-cutting rules that apply across all language packages. Language-specific guidance lives under `internals/rust/`, `internals/python/`, and `internals/typescript/`.

## One core, native veneers

All behavior lives in the Rust core (`packages/rust/core`). The Python (PyO3) and TypeScript (napi) packages are *native veneers* over in-process FFI bindings to that core — they reshape it into each language's idiom and **contain no logic**. The binding crates carry **zero `#[cfg(test)]` tests** (a test binary would link libpython); their correctness is proven by `conformance/` (the `fixtures.json` oracle, checked against all three SDKs). If logic creeps into a veneer, you have started a port and reintroduced drift.

The public-API surface therefore spans **all three SDKs**: every exported value/type in Rust, Python, and TypeScript, not just the CLI.

## CHANGELOG + MIGRATIONS

The `CHANGELOG.md` and `MIGRATIONS.md` *files* live at each package root. The philosophy below is global — every language package follows it.

Every PR that changes public API touches both files. Enforced in CI; a `skip-changelog:` trailer bypasses the check for genuinely internal refactors.

**`CHANGELOG.md`** — Keep a Changelog format. New entries land under `## Unreleased`, grouped `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed`. Breaking changes carry a `**BREAKING**` prefix and link to their `MIGRATIONS.md` section. On release, `## Unreleased` is renamed to `## v<OLD> → v<NEW>` and a fresh `## Unreleased` opens.

**`MIGRATIONS.md`** — lives at the package root. New entries land under `## Unreleased`. Each entry has five sections, in order:

1. **Summary** — one paragraph: what changed and why.
2. **Required changes** — before/after for config, CLI flags, function/method arguments, action inputs. "None" if purely additive.
3. **Deprecations removed** — anything previously warned about that's now gone. "None" if nothing was removed.
4. **Behavior changes without code changes** — same API, different runtime behavior (tag format, exit codes, defaults).
5. **Verification** — commands the consumer runs to confirm the upgrade worked, with the expected output.

Public-API surface for the purpose of these files: every exported value/type, every CLI flag, every config key, every observable artifact (tag format, GitHub Release body shape). Internal refactors, test-only changes, and docs-only edits stay out.

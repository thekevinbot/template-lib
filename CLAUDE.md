# Agent contract

This file is the operating contract for AI agents working in this repo.
Conventions, supervision rules, and per-language style live under
`internals/` — start there before making changes.

## Where to read first

- `internals/repo.md` — cross-cutting rules (CHANGELOG / MIGRATIONS philosophy, public-API surface).
- `internals/rust/` — Rust style, testing, shipping, review, code-smells.
- `internals/python/` — Python style, testing, shipping, review, setup.
- `internals/typescript/` — TypeScript style, testing, shipping, review, setup.

## Workflow

- Use `just` for local tasks (`just lint`, `just test`, `just ci`).
- Every PR that changes a public API touches `CHANGELOG.md` and `MIGRATIONS.md`
  in the affected package directory. Enforced by `.github/workflows/changelog.yml`.
  Bypass with a `skip-changelog:` git trailer for genuinely internal refactors.
- Pre-commit hooks (`just hooks` to install) gate formatting, gitleaks, and per-language linters.

## Out of scope

- Don't add unsolicited refactors or hypothetical-future abstractions.
- Don't bypass hooks or CI gates without an explicit reason in the PR body.

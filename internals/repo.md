# Repo-wide conventions

Cross-cutting rules that apply across all language packages. Language-specific guidance lives in `python-supervision.md`, `typescript-supervision.md`, `rust-supervision.md`.

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

## Dependency hygiene

**Never auto-fetch-and-run a package from outside the pinned manifest.** This is
the failure we hit in practice: `npx --yes stryker run` silently downloaded a
deprecated legacy `stryker` (renamed to `@stryker-mutator/core` years ago)
because the bare name still resolves on the registry — then ran it. The fix is
to never resolve on the fly. Declare every tool in a `package.json` /
`pyproject.toml` and run it through a manifest-pinned, lockfile-resolved path:
`pnpm exec` or `npx --no-install` (Node), `uv run` (Python). Never `npx <pkg>`,
`pnpm dlx`, `yarn dlx`, `pnpx`, `npm exec`, `uvx`, or `pipx run` — these fetch
whatever the registry serves for a bare name and execute it.

`scripts/check-no-auto-install.sh` enforces this: it scans committed source and
automation (Node, Python, Rust, shell, CI, justfile) and fails on any such
invocation, catching both the shell form (`npx --yes stryker`) and the
spawn-array form (`['npx','--yes','stryker']`) by flagging any `npx` not pinned
to `--no-install`. It runs at commit time (pre-commit) and in CI
(`.github/workflows/deps.yml`); `just deps-guard` runs it locally. Offline + instant.

Note on "deprecated" specifically: only npm exposes a machine-readable
deprecation flag that an installer surfaces — cargo and pip do not (they have
*yanked*, a different concept). So there is no portable "fail on a declared
deprecated dependency" gate; the durable, cross-ecosystem guarantee is the
auto-fetch ban above. For declared/transitive npm deprecations, GitHub-native
options are Dependabot (security + version updates) or Renovate (npm deprecation
warnings) — neither caught the `npx`-fetch case, which is why the ban is the
load-bearing rule.

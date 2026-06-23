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

We never silently install a deprecated or out-of-manifest package. Two rules,
both enforced by `.github/workflows/deps.yml` and runnable locally via `just`:

1. **Never resolve outside the pinned manifest.** Run only tools declared in a
   `package.json` and installed from the lockfile — `pnpm exec` or
   `npx --no-install`. Auto-fetchers (`pnpm dlx`, `yarn dlx`, `pnpx`,
   `npm exec`, `npx --yes`, bare `npx <pkg>`) download whatever the registry
   currently serves for that name, which is exactly how a renamed/abandoned
   package — a legacy `0.x` left behind after a scoped rename — slips in and
   runs. `scripts/check-no-auto-install.sh` (`just deps-guard`) greps committed
   automation for these and is offline + instant.

2. **Never install a deprecated package.** `scripts/check-no-deprecated-deps.sh`
   (`just deps-check`) resolves every pnpm project in a throwaway dir and fails
   on any deprecation warning. npm/pnpm have no native "fail on deprecated" flag,
   so the gate keys off the resolver's own warning. A genuinely unavoidable
   deprecated *transitive* dep is allow-listed — with a comment justifying it —
   under `pnpm.allowedDeprecatedVersions` in that project's `package.json`, which
   mutes exactly that package and nothing else. An empty allow-list (the default)
   means zero tolerance.

This is structural, not a one-off fix: a deprecated package can only enter the
tree by being declared (caught by review) or auto-fetched (caught by rule 1),
and if declared it must be non-deprecated (caught by rule 2).

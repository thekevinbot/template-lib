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

## CI logic in scripts, not workflow YAML

CI behavior that's more than glue lives in an **executable, tested script**, not inline in workflow or composite-action YAML. An inline `run:` / `actions/github-script` block can't be run locally, linted, or unit-tested — it only executes inside a CI run, where a typo surfaces as a failed job three minutes later. The fix is the move the rest of this repo already makes: turn it into source and give it a colocated test.

**The line.** A `run:` step is fine when it's a few straight-line commands, or a lone guard (`if … then exit; fi` around an early exit). Extract it the moment it grows iteration (`for` / `while` / `until` / `select`), multi-branch dispatch (`case`), text-munging (`awk` / `sed`, chained `grep` pipelines), or simply gets long. The trigger is *logic*, not line count — five sequential `mkdir` / `install` commands stay inline; a three-line `for` loop goes.

**Where it goes.** Extracted scripts live in `.github/scripts/`, each with a colocated test (`foo.py` ↔ `foo_test.py`, the same testing-conventions standard the packages follow) and invoked from a one-line `run:`. Python is the default; the language is open, but it must be executable and testable. The tests run in [`gha-scripts.yml`](../.github/workflows/gha-scripts.yml) and locally via `just gha-test`.

**Enforcement.** [`lint_workflow_scripts.py`](../.github/scripts/lint_workflow_scripts.py) (`just gha-lint`, and a job in `gha-scripts.yml`) scans every workflow and composite action and fails CI on an inline block that crosses the line. It's a pragmatic scanner, not a shell parser — it keys on the unambiguous markers above and favors precision, so a borderline body may slip through. Extract those by judgment anyway; an extracted script is always testable, and the gate stops complaining.

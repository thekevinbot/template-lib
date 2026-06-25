#!/usr/bin/env python3
"""Enforce that public-API changes touch CHANGELOG.md and MIGRATIONS.md.

Extracted from ``.github/workflows/changelog.yml`` so the package-detection
logic is unit-testable instead of frozen in inline shell. The workflow invokes
this as a one-line ``run:`` step, passing the PR's base/head SHAs via env.

A PR must update both ``CHANGELOG.md`` and ``MIGRATIONS.md`` in every
``packages/<pkg>/`` directory whose non-test, non-changelog source changed.
Bypass by adding a ``skip-changelog:`` trailer to any commit on the PR.
"""

from __future__ import annotations

import os
import re
import subprocess

_SKIP_TRAILER = re.compile(r"^skip-changelog:", re.IGNORECASE | re.MULTILINE)
_CHANGELOG_FILES = ("CHANGELOG.md", "MIGRATIONS.md")


def has_skip_trailer(commit_messages: str) -> bool:
    """True if any commit body line starts with ``skip-changelog:``."""
    return bool(_SKIP_TRAILER.search(commit_messages))


def changed_packages(changed: list[str]) -> list[str]:
    """Unique, sorted package names touched under ``packages/<name>/...``."""
    pkgs = {
        parts[1]
        for path in changed
        if len(parts := path.split("/")) >= 2 and parts[0] == "packages"
    }
    return sorted(pkgs)


def _is_exempt(path: str, pkg: str) -> bool:
    """True if ``path`` is a changelog/test file that does not count as code.

    Mirrors the three ``grep -Ev`` exclusions from the original workflow: the
    CHANGELOG/MIGRATIONS files at the package root, colocated ``*.test.*`` /
    ``*.spec.*`` sources, and anything under a test directory.
    """
    p = re.escape(pkg)
    return bool(
        re.fullmatch(rf"packages/{p}/(CHANGELOG|MIGRATIONS)\.md", path)
        or re.fullmatch(rf"packages/{p}/.*\.(test|spec)\.(ts|tsx|js|py|rs)", path)
        or re.match(rf"packages/{p}/(tests?|__tests__)/", path)
    )


def code_touched(changed: list[str], pkg: str) -> bool:
    """True if the package has non-changelog, non-test source changes."""
    prefix = f"packages/{pkg}/"
    return any(
        path.startswith(prefix) and not _is_exempt(path, pkg) for path in changed
    )


def missing_changelog_files(changed: list[str], pkg: str) -> list[str]:
    """The CHANGELOG/MIGRATIONS files not present in the diff for ``pkg``."""
    present = set(changed)
    return [f for f in _CHANGELOG_FILES if f"packages/{pkg}/{f}" not in present]


def _git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], capture_output=True, text=True, check=True
    ).stdout


def main() -> int:
    base, head = os.environ["BASE_SHA"], os.environ["HEAD_SHA"]

    if has_skip_trailer(_git("log", "--format=%B", f"{base}..{head}")):
        print("skip-changelog trailer present; bypassing enforcement.")
        return 0

    changed = [p for p in _git("diff", "--name-only", base, head).splitlines() if p]

    packages = changed_packages(changed)
    if not packages:
        print("No package files touched; nothing to enforce.")
        return 0

    fail = 0
    for pkg in packages:
        if not code_touched(changed, pkg):
            continue
        for f in missing_changelog_files(changed, pkg):
            print(
                f"::error file=packages/{pkg}/{f}::packages/{pkg} has code changes "
                f"but {f} is not updated. Add an entry under '## Unreleased' or "
                f"include a 'skip-changelog:' trailer for genuinely internal refactors."
            )
            fail = 1
    return fail


if __name__ == "__main__":
    raise SystemExit(main())

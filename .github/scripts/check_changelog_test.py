"""Tests for the CHANGELOG/MIGRATIONS enforcement gate."""

from check_changelog import (
    changed_packages,
    code_touched,
    has_skip_trailer,
    missing_changelog_files,
)


def test_skip_trailer_detected():
    assert has_skip_trailer("feat: thing\n\nskip-changelog: internal refactor")


def test_skip_trailer_is_case_insensitive():
    assert has_skip_trailer("Skip-Changelog: yes")


def test_skip_trailer_absent():
    assert not has_skip_trailer("feat: add a public method\n\nbody text")


def test_skip_trailer_must_start_a_line():
    assert not has_skip_trailer("see skip-changelog: in the docs")


def test_changed_packages_unique_and_sorted():
    changed = [
        "packages/python/foo.py",
        "packages/node/src/bar.ts",
        "packages/python/baz.py",
        "README.md",
        "packages",  # too short to name a package
    ]
    assert changed_packages(changed) == ["node", "python"]


def test_changed_packages_none_outside_packages():
    assert (
        changed_packages(["README.md", "docs/x.md", ".github/workflows/ci.yml"]) == []
    )


def test_code_touched_true_for_source():
    assert code_touched(["packages/python/core.py"], "python")


def test_code_touched_false_for_changelog_files():
    assert not code_touched(["packages/python/CHANGELOG.md"], "python")
    assert not code_touched(["packages/python/MIGRATIONS.md"], "python")


def test_code_touched_false_for_dot_test_sources():
    assert not code_touched(["packages/node/src/bar.test.ts"], "node")
    assert not code_touched(["packages/node/src/bar.spec.tsx"], "node")


def test_code_touched_false_for_test_directories():
    assert not code_touched(["packages/python/tests/conftest.py"], "python")
    assert not code_touched(["packages/node/__tests__/x.ts"], "node")


def test_code_touched_ignores_other_packages():
    assert not code_touched(["packages/node/src/bar.ts"], "python")


def test_underscore_python_test_counts_as_code():
    # NB: faithful to the original workflow regex, which exempts dot-style
    # `foo.test.py` but NOT underscore-style `foo_test.py` (this repo's actual
    # Python colocation convention). Flagged to the maintainer as a pre-existing
    # quirk; preserved here so the extraction is behavior-identical.
    assert code_touched(["packages/python/core_test.py"], "python")


def test_missing_changelog_files_lists_absent_ones():
    changed = ["packages/python/core.py", "packages/python/CHANGELOG.md"]
    assert missing_changelog_files(changed, "python") == ["MIGRATIONS.md"]


def test_missing_changelog_files_empty_when_both_present():
    changed = ["packages/python/CHANGELOG.md", "packages/python/MIGRATIONS.md"]
    assert missing_changelog_files(changed, "python") == []

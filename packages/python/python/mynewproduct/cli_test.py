"""Colocated tests for the CLI entry point. The CLI prints from Rust (fd-level), so use capfd."""

import pytest

from . import cli

CORPUS = "the quick brown fox the lazy dog The QUICK fox"


def test_prints_top_n(capfd: pytest.CaptureFixture[str]) -> None:
    assert cli.main(["--top", "3", CORPUS]) == 0
    assert capfd.readouterr().out == "the\t3\nfox\t2\nquick\t2\n"


def test_negative_top_returns_error(capfd: pytest.CaptureFixture[str]) -> None:
    assert cli.main(["--top", "-1", "hello"]) == 1
    assert "n must be >= 0" in capfd.readouterr().err

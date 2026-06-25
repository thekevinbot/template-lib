"""Colocated tests for the CLI entry point. The CLI prints from Rust (fd-level), so use capfd."""

import sys

import pytest

from . import cli

CORPUS = "the quick brown fox the lazy dog The QUICK fox"


def test_prints_top_n(capfd: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sys, "argv", ["mynewproduct", "--top", "3", CORPUS])
    assert cli.main() == 0
    assert capfd.readouterr().out == "the\t3\nfox\t2\nquick\t2\n"


def test_negative_top_returns_error(
    capfd: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(sys, "argv", ["mynewproduct", "--top", "-1", "hello"])
    assert cli.main() == 1
    assert "n must be >= 0" in capfd.readouterr().err

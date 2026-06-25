"""Colocated tests for the public SDK surface (the PyO3 binding, re-exported here)."""

import pytest

import mynewproduct
from mynewproduct import Counter, Entry, WordCountError

CORPUS = "the quick brown fox the lazy dog The QUICK fox"


def loaded() -> Counter:
    c = Counter()
    c.add(CORPUS)
    return c


def test_public_api_is_reexported() -> None:
    for name in ("Counter", "Entry", "WordCountError", "run_cli", "__version__"):
        assert hasattr(mynewproduct, name), name


def test_counts_case_insensitively() -> None:
    c = loaded()
    assert c.total == 10
    assert len(c) == 6
    assert c.count("THE") == 3
    assert c.count("missing") == 0


def test_contains() -> None:
    c = loaded()
    assert "the" in c
    assert "missing" not in c


def test_most_common_tiebreak() -> None:
    assert loaded().most_common(3) == [Entry("the", 3), Entry("fox", 2), Entry("quick", 2)]


def test_entries_full_order() -> None:
    assert [e.word for e in loaded().entries()] == ["the", "fox", "quick", "brown", "dog", "lazy"]


def test_case_sensitive() -> None:
    c = Counter(case_sensitive=True)
    c.add("The the THE")
    assert c.count("the") == 1
    assert len(c) == 3


def test_negative_n_raises_wordcounterror() -> None:
    with pytest.raises(WordCountError):
        loaded().most_common(-1)


def test_repr() -> None:
    assert repr(loaded()) == "Counter(total=10, distinct=6)"

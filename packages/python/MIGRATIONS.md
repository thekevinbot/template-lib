# Migrations

Upgrade notes for breaking changes. New entries go under `## Unreleased`.
On release, the section is renamed to `## v<OLD> → v<NEW>`.

Each entry has five sections, in order:

1. **Summary** — one paragraph: what changed and why.
2. **Required changes** — before/after for public API. "None" if purely additive.
3. **Deprecations removed** — anything previously warned about that's now gone.
4. **Behavior changes without code changes** — same API, different runtime behavior.
5. **Verification** — commands that confirm the upgrade worked, with expected output.

## Unreleased

### Summary

The wheel changed from a *bundled binary* (maturin `bindings = "bin"`, which only
put the `mynewproduct` executable on `PATH`) to a *PyO3 extension module* you can
`import`. It is now an `abi3-py312` wheel (one wheel covers Python 3.12+). The
`mynewproduct` console script is unchanged.

### Required changes

- The package now requires Python **3.12+** (was 3.9+), a consequence of the
  abi3-py312 floor.
- New capability — import the SDK:

  ```python
  from mynewproduct import Counter
  c = Counter().add("the quick brown fox the")
  c.most_common(2)   # [Entry(word='the', count=2), Entry(word='brown', count=1)]
  ```

### Deprecations removed

None.

### Behavior changes without code changes

None — the `mynewproduct` CLI's flags and output are unchanged.

### Verification

```bash
pip install mynewproduct
python -c "import mynewproduct as m; print(m.Counter().add('a a b').most_common(1))"
# [Entry(word='a', count=2)]
mynewproduct --top 2 "a a b"   # => "a\t2"
```

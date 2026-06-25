# Migrations

Upgrade notes for breaking changes. New entries go under `## Unreleased`.
On release, the section is renamed to `## v<OLD> → v<NEW>`.

Each entry has five sections, in order:

1. **Summary** — one paragraph: what changed and why.
2. **Required changes** — before/after for public API. "None" if purely additive.
3. **Deprecations removed** — anything previously warned about that's now gone.
4. **Behavior changes without code changes** — same API, different runtime behavior.
5. **Verification** — commands that confirm the upgrade worked, with expected output.

### Summary

The package changed from a `bin-shim` wrapper that only exec'd a bundled Rust
binary into a **napi addon** you can `import` in-process. It ships as a top
package plus per-platform `optionalDependencies` carrying the `.node`. The
`mynewproduct` CLI is unchanged. The minimum Node.js also moves to 22 (Node 20
reached end-of-life 2026-04-30).

### Required changes

- New capability — import the SDK (ESM or CommonJS):

  ```ts
  import { Counter } from 'mynewproduct';
  const c = new Counter().add('the quick brown fox the');
  c.mostCommon(2); // [{ word: 'the', count: 2 }, { word: 'brown', count: 1 }]
  ```

- Upgrade to Node.js 22+. Installing on Node < 22 triggers an `EBADENGINE`
  warning (and fails under `npm install --engine-strict`).

### Deprecations removed

The `bin-shim` dependency and the `@mynewproduct/<rust-triple>` bundled-binary
optionalDependencies are removed, replaced by napi short-form platform packages.

### Behavior changes without code changes

None — the `mynewproduct` CLI's flags and output are unchanged.

### Verification

```bash
node --version                       # v22.x or newer
npm install mynewproduct
node -e "const { Counter } = require('mynewproduct'); console.log(new Counter().add('a a b').mostCommon(1))"
# [ { word: 'a', count: 2 } ]
npx mynewproduct --top 2 "a a b"     # => "a\t2"
```

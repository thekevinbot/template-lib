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

The package now requires Node.js 24 or newer. CI, the docs build, and the npm
bootstrap workflow already run on Node 24; this aligns the package's declared
`engines.node` (and the dev `@types/node`) with that baseline.

### Required changes

Upgrade your local and CI Node.js to 24 or newer. Installing `darkfactory-cli`
on Node < 24 now triggers an `EBADENGINE` warning (and fails outright under
`npm install --engine-strict`).

### Deprecations removed

None.

### Behavior changes without code changes

None.

### Verification

```
node --version            # v24.x or newer
npx darkfactory --version
```

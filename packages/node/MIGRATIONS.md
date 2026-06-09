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

The package now requires Node.js 22 or newer. Node 20 reached end-of-life on
2026-04-30, so the floor moves up to the lowest LTS still receiving updates.
(CI itself runs on Node 24.)

### Required changes

Upgrade to Node.js 22 or newer. Installing `darkfactory-cli` on Node < 22 now
triggers an `EBADENGINE` warning (and fails outright under
`npm install --engine-strict`).

### Deprecations removed

None.

### Behavior changes without code changes

None.

### Verification

```
node --version            # v22.x or newer
npx darkfactory --version
```

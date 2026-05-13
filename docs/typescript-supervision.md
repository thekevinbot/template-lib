# TypeScript Agent-Supervision Cheatsheet

*Synthesised from a multi-repo audit (UpscalerJS, GBNF, skillet, dirsql), 2026-05-13. Goal: recognise good TypeScript when an agent writes it, and catch the patterns that signal the agent has cargo-culted rather than thought.*

Where the audit repos disagree, **UpscalerJS wins** (real production library, hand-curated). GBNF is used as a tie-breaker and for dual-language patterns. skillet and dirsql are heavily LLM-touched — useful as foils, not as templates.

---

## Toolchain (one-time)

```fish
# Node + pnpm. Forbid npm/yarn at the package level.
volta install node@20      # or fnm / asdf — Node 20 LTS is the floor
corepack enable             # or `npm i -g pnpm`; pnpm 8+
```

Per-repo `preinstall` should fail-fast if someone runs the wrong tool:

```json
"scripts": { "preinstall": "npx only-allow pnpm" }
```

Engines pinned in root `package.json`:

```json
"engines": { "node": ">=20.0", "pnpm": ">=8" }
```

## Commands you'll use

| Command | Purpose | When |
|---|---|---|
| `pnpm install` | Install workspace deps | Setup / lockfile change |
| `pnpm run build` | Build current package | Local verification |
| `pnpm -r run build` | Build every workspace package | Pre-publish, post-pull |
| `pnpm --filter <pkg> run <task>` | Run task in one package | Targeted work |
| `pnpm exec tsc --noEmit` | Type-check, no output | **Inner loop** — fastest |
| `pnpm exec vitest` | Run tests (watch by default) | Verifying |
| `pnpm exec vitest run` | One-shot test run | CI parity |
| `pnpm exec eslint .` | Lint | Pre-commit |
| `pnpm exec prettier --check .` | Format check | Pre-commit |
| `pnpm dlx <cli>` | One-off CLI exec | Like `npx` but uses pnpm store |

Never use `npm` or `yarn` in a pnpm repo. The lockfiles aren't interchangeable, and `npm install` will silently rewrite resolution. The only exception worth knowing about: `npm publish --provenance` is the only way to get build provenance attestations as of 2026 — projects that publish with provenance use `npm publish` at release time only (see dirsql `publish.yml`).

## Watch mode

For larger packages, run vitest in watch and a parallel `tsc --watch --noEmit` in another pane. There is no single bundled watcher in idiomatic TS the way `bacon` is in Rust — you compose your own from `vitest`, `tsc -w`, and (rarely) `concurrently` / `nodemon` if you need to chain.

---

## Monorepo shape

The dominant pattern across all four audit repos is **pnpm workspaces orchestrated by [wireit](https://github.com/google/wireit)**, with no Lerna/Nx/Turbo/changesets. Wireit lives in the root `package.json` under a `"wireit"` key, with each script declared `"wireit"` in `"scripts"`:

```json
{
  "scripts": {
    "build": "wireit"
  },
  "wireit": {
    "build": {
      "dependencies": ["./packages/foo:build", "./packages/bar:build"]
    }
  }
}
```

Workspace declaration (`pnpm-workspace.yaml`):

```yaml
packages:
  - 'packages/**'
  - 'internals/**'
  - 'docs'
  - '!**/tmp/**'
  - '!**/node_modules/**'
```

Conventions worth adopting:

- **Real library packages live in `packages/`.** Private tooling/build/test helpers go in `internals/` and are marked `"private": true`.
- **Examples are outside the workspace.** They depend on `"<package>": "latest"` (the published npm artifact), turning them into smoke-test consumers. **Trade-off**: they then aren't typechecked in your CI — UpscalerJS lives with that risk. If you want them checked, add a separate `typecheck-examples` job that does a clean install of the published version.
- **Internal cross-package deps use `"workspace:*"`**, not version numbers. pnpm rewrites these at publish time.
- **No root `package.json` is also valid.** GBNF deliberately omits it; pnpm-workspace.yaml is enough. UpscalerJS keeps one because it hosts the wireit orchestration. Either works.
- **Don't use Lerna / Nx / Turborepo unless you have a reason.** pnpm + wireit covers the build-graph and filtered-tasks needs that those tools sell, with a fraction of the config surface.

`concurrency` in GitHub Actions:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

This cancels the previous CI run on the same ref. Cheap, always wanted.

---

## Per-package layout

Canonical shape (`packages/<name>/`):

```
src/
  index.ts            # public entry — re-exports only
  <feature>.ts
  <feature>.test.ts   # colocated unit tests, *.test.ts
dist/                 # emitted, never committed
test/                 # optional — package-level integration only
package.json
tsconfig.json         # extends root
README.md
CHANGELOG.md
```

If the package targets multiple environments (browser/node/worker), split source into subdirs and ship one `tsconfig.<env>.<format>.json` per output:

```
src/
  shared/             # platform-agnostic core; unit tests here
  browser/
    esm/index.ts
    umd/index.ts
  node/
    cjs/index.ts
```

`package.json` exports:

```json
{
  "type": "module",
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/esm/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/esm/index.d.ts",
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js"
    },
    "./node": {
      "types": "./dist/node/index.d.ts",
      "require": "./dist/node/index.js"
    }
  },
  "files": ["dist", "LICENSE", "CHANGELOG.md"],
  "sideEffects": false
}
```

Things worth getting right:

- **`"type": "module"`** — ESM-first. Ship a CJS build via `"require"` conditional if downstream is mixed.
- **Subpath exports for environments** (`./node`, `./node-gpu`, `./worker`). Don't conditionally `require('tfjs-node')` at runtime to pick an env — let the consumer's import path do it.
- **Per-subpath `types`** — the `"types"` condition inside each exports entry. Otherwise tools fall back to legacy resolution and find the wrong `.d.ts`.
- **`"files"` whitelist** — `["dist", ...]`, never an unbounded set. Stops `.env`, `tmp/`, `coverage/` accidentally getting published.
- **`"sideEffects": false`** — declares the package tree-shakeable. **UpscalerJS doesn't set this** (an audit gap). Set it. If the package *does* have side-effects (CSS imports, polyfills), set `"sideEffects": ["./dist/styles.css"]` listing exactly what.
- **`peerDependencies`** for required-by-consumer-anyway packages (React, Vue, tfjs). Match the version with a `devDependency` so the package is buildable in isolation.

Test colocation (`src/foo.ts` + `src/foo.test.ts`) is the default. Per-environment tests use the suffix (`foo.browser.test.ts`, `foo.node.test.ts`) so vitest configs can include/exclude by glob. **Don't** create `__tests__/` directories per source dir — that's a Jest convention TS has largely moved past.

---

## TypeScript configuration

Thin root, layered per package. The root sets *strictness*, packages set *outputs*:

Root `tsconfig.json`:

```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

Per-package `tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["./src/**/*.ts"],
  "exclude": ["node_modules", "dist", "./src/**/*.test.ts"]
}
```

For multi-output packages, add `tsconfig.<env>.<format>.json` that extends the package config:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "target": "ES2020",
    "outDir": "./dist/node"
  },
  "include": ["./src/node/**/*.ts", "./src/shared/**/*.ts"]
}
```

A separate `tsconfig.eslint.json` is common — lint includes test files, build doesn't.

**Project references (`"references"`, `composite: true`)** are technically the right tool for multi-package monorepos, but UpscalerJS and GBNF *don't* use them. They rely on wireit's dependency graph and built `dist/` outputs. The trade-off: project references make `tsc -b` work as one command, but require careful `composite: true` config and slower incremental setup. Wireit-orchestrated builds are simpler in practice. **Pick one, not both.**

`strict: true` is non-negotiable. If you need to disable a specific strict flag (rare — `strictPropertyInitialization` for class-based ORM models is a real case), do it once at root with a comment, not scattered per file.

---

## Build pipeline

Decision tree:

- **App / single-output**: `tsc` direct, or `tsup` (esbuild wrapper, near-zero config).
- **Library, ESM-only**: `tsc` direct. Don't reach for bundlers when you don't need them.
- **Library, ESM + CJS**: `tsc` per format (two configs, two `outDir`s).
- **Library, ESM + CJS + UMD**: `tsc` for ESM/CJS, then `rollup` for UMD. UpscalerJS does it this way.
- **Library, multi-environment + bundler-tested**: Vite is reasonable; vite-plugin-dts emits `.d.ts`. GBNF uses this.

UMD chain when you need browser-globals support (`<script>` tag CDN usage):

```fish
tsc -p tsconfig.browser.umd.json     # TS → intermediate JS
rollup -c rollup.config.mjs          # bundle into single file
uglifyjs upscaler.js -o upscaler.min.js --compress --mangle --source-map
```

Externals matter. The `rollup.config.mjs` pattern for UMD with externals:

```js
export default {
  external: ['@tensorflow/tfjs', '@upscalerjs/default-model'],
  output: {
    globals: {
      '@tensorflow/tfjs': 'tf',
      '@upscalerjs/default-model': 'UpscalerDefaultModel'
    }
  }
};
```

Drive global-name mapping from a sidecar `umd-names.json` (data, not magic). Same trick UpscalerJS uses.

**`prepublishOnly` should run the full pipeline**:

```json
"prepublishOnly": "pnpm lint && pnpm test && pnpm build && pnpm validate:build"
```

A `validate:build` script that asserts every artifact named in `"exports"` exists is cheap insurance. It catches the case where the build "succeeded" but emitted nothing because `include` was wrong.

---

## Testing

**Default to Vitest.** Mocha+chai is legacy. Jest is fine but slower and has worse ESM ergonomics. **Don't run both** — UpscalerJS has both in `devDependencies` and it's confusing; Vitest is what's actually called.

Per-package config (`vite.config.ts`):

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.browser.test.ts', 'src/**/*.playwright.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 }
    }
  }
});
```

Multi-environment: one config per env (`vite.browser.ts`, `vite.node.ts`), referenced by the test scripts:

```json
"scripts": {
  "test:browser": "vitest run --config vite.browser.ts",
  "test:node": "vitest run --config vite.node.ts"
}
```

**Playwright is for actual-browser tests only** — Canvas, WebGL, real navigation. The pattern UpscalerJS uses: `*.playwright.browser.test.ts` suffix, separate config, included from CI only. Vitest's `browser` mode can replace Playwright for *some* cases, but not Canvas / WebGPU.

**Integration tests** at repo-root `test/integration/` consume the *built* artifact, not the source. UpscalerJS runs the same suite against webpack / esbuild / umd / node outputs. This catches bundler-specific breaks (a regression in how rollup names a UMD global, for example) that source-only tests miss. **Worth replicating for any library that publishes to npm.**

**Mocking**: prefer **factory injection** over `vi.mock`. Pass dependencies as constructor args; tests pass fakes:

```ts
// src/shared/upscaler.ts
export function getUpscaler<T extends TF, Input>({
  tf, loadModel, getImageAsTensor, tensorAsBase64,
}: Internals<T, Input>) {
  class Upscaler {
    constructor(opts: UpscalerOptions) { /* ... */ }
    upscale(input: Input) { /* uses tf, loadModel, ... */ }
  }
  return Upscaler;
}

// src/browser/index.ts
import * as tf from '@tensorflow/tfjs';
import { loadModel } from './loadModel.browser';
export default getUpscaler({ tf, loadModel, /* ... */ });

// src/shared/upscaler.test.ts
import { getUpscaler } from './upscaler';
const Upscaler = getUpscaler({ tf: fakeTf, loadModel: fakeLoadModel, /* ... */ });
```

`vi.mock` is fine when you must, but factory injection avoids the per-file mock plumbing and works identically in every test runner.

---

## Lint + format

**ESLint + Prettier.** Biome is faster and is what dirsql uses — but it has worse plugin coverage and no shared ecosystem with the rest of the world's `@typescript-eslint/*` rules. **Don't use Biome on a new TS project unless you've decided you can live without `@typescript-eslint/no-floating-promises`.**

Minimal `.eslintrc.cjs`:

```js
module.exports = {
  env: { browser: true, node: true, es2022: true },
  ignorePatterns: ['dist/', '**/*.generated.ts'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { project: './tsconfig.eslint.json', sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-floating-promises': 'error',
    'curly': ['error', 'all'],
    'comma-dangle': ['error', 'always-multiline']
  }
};
```

`.prettierrc`:

```json
{ "printWidth": 80, "trailingComma": "all", "singleQuote": true }
```

`eslint-config-prettier` disables conflicting rules. Prettier owns layout, ESLint owns correctness. **Don't fight prettier** — if `printWidth` annoys you, change it once at root.

**Pre-commit hooks**: UpscalerJS deliberately has none and enforces lint via CI. skillet uses pre-push (not pre-commit) so commits are cheap. Either is fine; per-commit hooks that block trivial WIP commits are net-negative. **What matters is that CI fails on lint errors.**

Eligible source files for lint should include test files. The `*.generated.ts` glob is the standard escape hatch for codegen output.

---

## Public API design

**Barrels with explicit named re-exports.** Not `export * from './foo'` at every level — that's how things accidentally become public.

```ts
// src/index.ts
export { Upscaler } from './upscaler';
export { AbortError } from './errors';
export type { ModelDefinition, UpscalerOptions } from './types';
```

Type exports are explicit `export type` — supports `isolatedModules` and `verbatimModuleSyntax`.

**Class vs function**: if the public API is "construct a thing and call methods on it", use a class. If it's "call a function", use a function. UpscalerJS uses both: `Upscaler` is `default`-exported as a class; internal `getUpscaler` is a named factory function.

**Default export vs named export**: default for the "primary thing", named for everything else. Both is fine. Pure-named is also fine (and friendlier to refactor tools). What matters is consistency within one package.

**JSDoc for hidden API**: `@hidden` (typedoc) or `@internal` (TS — gated by `--stripInternal`). UpscalerJS uses `@hidden` so typedoc skips it in the generated docs:

```ts
class Upscaler {
  /** @hidden */
  _opts: UpscalerOptions;

  /** Upscale an image and return base64 PNG. */
  upscale(input: Input): Promise<string> { /* ... */ }
}
```

Underscored field names + `@hidden` is the strongest convention. `private` keyword still emits to `.d.ts`; `#private` (real private) is fine but breaks reflection in ways some consumers care about.

**Don't ship a `Proxy` wrapper just to enable test mocking** (dirsql does this in `packages/ts/ts/index.ts`). Factory injection or DI in the constructor is cleaner. A `Proxy` over your public API is high-magic plumbing that future maintainers won't understand.

---

## Versioning + release

**Use changesets** for libraries with separately-versioned packages. UpscalerJS doesn't (it lockstep-versions everything with a custom `update:version` script + `git commit --no-verify`) — that's a maintenance liability you don't need to inherit.

For lockstep (every package always the same version), changesets has a `fixed` config. For independent versions, changesets handles dependency-bump propagation automatically.

**Publishing via OIDC / Trusted Publishing**, not API tokens. Both npm and PyPI support this since 2024. The GitHub Actions setup:

```yaml
permissions:
  id-token: write  # OIDC
  contents: write  # tag/push
- run: pnpm publish --provenance --access public
```

`--provenance` gives published packages a build attestation visible on npmjs.com. The dirsql release workflow uses `npm publish --provenance` because pnpm's wrapper of provenance was still flaky as of 2026 (re-verify if revisiting); skillet/UpscalerJS don't ship provenance.

**Retry on flaky publish, rollback the tag if publish fails:**

```yaml
- name: Publish
  run: |
    for i in 1 2 3; do
      npm publish --provenance --access public && exit 0
      sleep 15
    done
    exit 1
- name: Rollback tag on failure
  if: failure() && steps.tag.outputs.created == 'true'
  run: git push --delete origin "v${{ steps.version.outputs.new_version }}"
```

**Nightly auto-patch releases** (dirsql, skillet do this) are aggressive for sub-1.0 libraries — easy to publish noise on every README touch. For a library taking shape, prefer manual `workflow_dispatch` minor releases and on-merge patch releases gated by changeset files.

---

## Docs

**Docusaurus 2** for richer doc sites (multi-version, search, plugin ecosystem). **VitePress** for simpler ones (Vite-native, faster, less to configure). UpscalerJS uses Docusaurus; GBNF uses an internal `docoddity`. For a new project, VitePress unless you actually need Docusaurus features.

**API reference is generated, not hand-written.** typedoc + `typedoc-plugin-markdown` + `docusaurus-plugin-typedoc` reads JSDoc and emits Markdown. typedoc respects `@hidden`/`@internal`. Don't hand-maintain API docs — they will drift the day after you write them.

**Per-package metadata under a namespaced key in `package.json`** is the load-bearing pattern (UpscalerJS uses `"@upscalerjs": { ... }`):

```json
"@yourproject": {
  "title": "Pretty Display Name",
  "guide": { "frontmatter": { "category": "core" } }
}
```

The doc generator reads this. Single source of truth (the package's own `package.json`), no sidecar YAML.

**Code groups for multi-language libraries** (VitePress `::: code-group`, Docusaurus `<Tabs>`). When you do this, **set up a test that the code samples actually run**, or they will drift. dirsql's TS docs systematically lie about an async API the code doesn't implement — that's what happens without sample tests.

---

## CI/CD

`.github/workflows/` shape across the audit repos:

| Workflow | Purpose | Trigger |
|---|---|---|
| `test.yml` | Unit + integration | every push/PR |
| `lint.yml` | ESLint + Prettier | every push/PR |
| `typecheck.yml` | `tsc --noEmit` | every push/PR |
| `docs.yml` | Build + deploy docs | push to main, `docs/**` |
| `release.yml` | Publish to npm | manual or tag |
| `changelog.yml` | Enforce changelog touched | every PR |

Composite action for repeated setup (`.github/actions/setup-pnpm/action.yml`):

```yaml
- uses: pnpm/action-setup@v4
  with: { version: 8, run_install: false }
- uses: actions/setup-node@v4
  with: { node-version: 20, cache: 'pnpm' }
- run: pnpm install --frozen-lockfile
```

**Path filters** to skip irrelevant workflows:

```yaml
on:
  push:
    paths: ['packages/foo/**', 'pnpm-lock.yaml', '.github/workflows/foo.yml']
```

**Concurrency** to cancel previous runs on the same ref (already shown above).

**Matrix**: in 2026, Node 20 is the LTS floor. Matrix on Node 20 + 22 if your dep tree spans them. Don't matrix on OS unless you have OS-specific behaviour — pure-JS tests on Ubuntu only is fine; if you ship native bindings, you need Mac/Windows runners too.

**Coverage uploads via Codecov / Coveralls**: nice-to-have, not gating. UpscalerJS treats it as informational. skillet enforces a per-package 85-90% floor in CI — that's only worth doing if you have a real bug-resistance argument.

---

## Native bindings (napi-rs)

If the package wraps a Rust crate via napi-rs:

- **Don't hand-roll `napi_sys` unsafe FFI.** dirsql's `packages/ts/src/lib.rs` has ~360 lines of hand-rolled unsafe napi-sys for JS callback handling — napi-rs's `napi::bindgen_prelude::Function` and `napi::Env::execute_tokio_future` cover this. The hand-rolled version pattern-matched "FFI = unsafe" rather than "what does napi-rs provide".
- **Configure `napi.triples`** in `package.json`. Empty triples (dirsql) means there is no cross-platform prebuilt distribution.
- **Use `optionalDependencies` for per-platform `@org/<triple>` packages**, with a runtime resolver. `bin-shim` is one such resolver; napi-rs's own toolchain does the same out of the box.
- **chmod 0o755 on the binary after staging** (the EACCES failure mode: `actions/upload-artifact@v4` strips per-file exec bits; `fs.copyFileSync` defaults to 0644). Either chmod in your build script *after* artifact-download (not before upload), or chmod defensively at spawn-time in the shim.

---

## Code smells / red flags in agent output

### Critical (almost always wrong)

| Smell | Why it's bad | What to ask |
|---|---|---|
| `any` in non-test code | Defeats the type system | "What's the actual type? If unknown, use `unknown` + narrow." |
| `as any` cast | Same | Same |
| `@ts-ignore` / `@ts-expect-error` without explanation | Hiding a real error | "What is the underlying error? Fix it or document the exception." |
| `eslint-disable` without specific rule + reason | Hiding a real complaint | Same |
| `vi.mock` of internal modules | Couples tests to implementation; reads as "tests pass via mocks lying" | "Could this be factory injection?" |
| `Promise<void>` without `await` (`no-floating-promises` fires) | Silent error-swallowing | "Why is this not awaited? If fire-and-forget, mark it `void p`." |
| `Proxy` wrapping the public API | High-magic test plumbing | "Why not factory injection?" |
| `as unknown as Foo` | Lying twice | Same as `as any` |

### Style smells (often wrong)

| Smell | Why it's bad |
|---|---|
| `export *` at every barrel level | Internal helpers leak into public API |
| `default export` mixed with named exports inconsistently | Refactor tools struggle; consumer imports are inconsistent |
| `interface Foo {}` vs `type Foo = {}` mixed randomly | Pick one per role (`interface` for nominal/extensible shapes, `type` for unions/utility) |
| `enum` (not `const enum`) for string flags | Generates runtime code, breaks tree-shaking; use string-literal unions |
| `Object.assign({}, foo, bar)` | Use spread: `{ ...foo, ...bar }` |
| `Array.from({ length: n })` for ranges | Idiomatic, but if it appears five times, make a `range` helper |
| `for (let i = 0; i < arr.length; i++)` over `for (const x of arr)` | Indexed loop when iteration suffices |
| `JSON.parse(JSON.stringify(x))` for deep clone | Use `structuredClone(x)` (Node 17+, all modern browsers) |
| `String("" + x)` or `"" + x` for coercion | Use `String(x)` |
| `.then(() => {}, () => {})` to swallow errors | Use `try/await`; surface or annotate |
| Magic numbers / strings | `const MAX_RETRIES = 3;` |
| `let x` that's never reassigned | Use `const`. ESLint catches it. |
| `Foo<any>` generic param | Defeats the generic. Either narrow it or remove the generic. |
| Files with only `export *` re-exports nested deeper than 2 levels | Barrel ladders — usually means the package is structured wrong |
| `private` class fields without an underscore prefix mixed with public unprefixed | Pick a convention; UpscalerJS uses `_field` + `@hidden` |
| `class` with only static methods | Make it a module of functions |
| Lazy / dynamic `import()` for code that's always needed | The lazy import was an LLM "performance" gesture; static import is fine |

### Subtle smells

- **No `"sideEffects"` field** in package.json — tree-shaking is degraded. Set it.
- **`exports` map without `"types"` per condition** — consumers find the wrong `.d.ts`. UpscalerJS and GBNF both have this gap. Fix when you copy.
- **Inline tests in random directories** — `*.test.ts` should be colocated next to the file under test, not in a parallel `__tests__/` directory.
- **`@ts-nocheck` at top of a file** — same as `any` for the whole file. Strong red flag.
- **`as const` everywhere there's a literal** — sometimes right; if every literal in a file has `as const` cast, the author was learning the pattern, not using it deliberately.
- **`type` aliases of built-in primitives** (`type ID = string`) — only useful if `ID` later becomes a branded type; otherwise it's noise.
- **CommonJS-only output (`"type": "commonjs"`)** when there's no clear consumer-environment reason — dirsql does this. ESM is the default in 2026.
- **`require('./some.json')`** — use `import` with `assert { type: 'json' }` or read with `fs.readFile` (since the import assertion API changed once). Native JSON imports are still in flux; if it must work everywhere, read with `fs`.

### When `any` is legitimate

- Bridging to genuinely untyped external code (truly stale `@types/...` package, ad-hoc third-party JS).
- Inside a generic helper that intentionally accepts anything (`function tap<T>(x: T): T { console.log(x as any); return x; }`).
- One narrow place at a boundary where you've documented the assumption. Comment with the constraint.

If `any` appears outside these cases, treat it as a strong red flag.

---

## Ecosystem cheat sheet

Standard tooling. If the agent picks something off-brand for one of these tasks, ask why.

| Task | De facto choice |
|---|---|
| Package manager | `pnpm` |
| Test runner | `vitest` (or `jest` if legacy) |
| Real-browser tests | `playwright` |
| Build (library) | `tsc` direct, or `tsup` |
| Build (multi-format library) | `tsc` + `rollup` for UMD |
| Build (app) | `vite` |
| Type checker | `tsc` (`tsc --noEmit`) |
| Linter | `eslint` + `@typescript-eslint/*` |
| Formatter | `prettier` |
| Docs | `vitepress` (simple) / `docusaurus` (rich) |
| API reference | `typedoc` (+ `typedoc-plugin-markdown`) |
| Versioning | `changesets` |
| HTTP client | `undici` (Node) / `fetch` (universal — built-in since Node 18) |
| Schema validation | `zod` |
| Date | `date-fns` or `temporal-polyfill` (Temporal once it lands) |
| Logger | `pino` |
| CLI args | `commander` / `yargs` / `cac` (smaller) |
| Async iteration | native `for await ... of`; `async-iterator-stream` only if needed |
| Rust bindings | `napi-rs` |
| Python bindings | (you're in the wrong file) |

---

## Pre-review tooling pass

Before reading a line:

```fish
pnpm install
pnpm run build              # does it compile?
pnpm exec tsc --noEmit      # does it type-check?
pnpm test                   # do tests pass?
pnpm exec eslint .          # is it linted?
pnpm exec prettier --check . # is it formatted?
```

If the agent didn't run these, ask. If they fail, the agent should fix before you read.

## Reading-a-PR checklist

1. **Tooling pass** — all five green?
2. **`any` / `@ts-ignore` / `as any`** — scan for these, pause on each.
3. **`vi.mock` of internal code** — could this be factory injection?
4. **Floating promises** — `@typescript-eslint/no-floating-promises` enabled and passing?
5. **`exports` map** — does it have `types` per condition? `sideEffects` set?
6. **Barrel files** — explicit named exports, or a too-broad `export *`?
7. **Tests** — colocated `*.test.ts`, exercising the public surface?
8. **`package.json` changes** — new deps reputable (see ecosystem table)? `"files"` whitelist not expanded?
9. **Reinvention** — did the agent rebuild something standard? (date math, deep clone, schema validation, retry-with-backoff)
10. **Public API** — `default` vs named consistent? `@hidden`/`@internal` on internals?

---

## Type-system idiom reference

| Pattern | Meaning |
|---|---|
| `T extends U` (in `extends` clause) | Generic constraint: `T` must be assignable to `U` |
| `T extends U ? A : B` | Conditional type |
| `keyof T` | Union of `T`'s keys (as string-literal types) |
| `T[K]` | Index access — the type of `T`'s `K` property |
| `Partial<T>` | All fields optional |
| `Required<T>` | All fields required (strip `?`) |
| `Readonly<T>` | All fields readonly |
| `Pick<T, K>` | Subset by keys |
| `Omit<T, K>` | Complement of `Pick` |
| `Record<K, V>` | Object with keys of `K`, values of `V` |
| `ReturnType<F>` | Return type of function-type `F` |
| `Parameters<F>` | Tuple of param types |
| `Awaited<P>` | Unwrap `Promise<T>` to `T` |
| `as const` | Treat literal as its narrowest literal type |
| `satisfies T` | Type-check against `T` *without* widening — preserves the literal type |
| `infer X` (in conditional type) | Bind a name to an inferred position |
| `T & U` | Intersection type |
| `T \| U` | Union type |
| `unknown` | "Anything, but must be narrowed before use" (the safe `any`) |
| `never` | "Cannot happen" — return type of throwing/looping-forever functions |
| `void` | Function return that's discarded (different from `undefined` in callback positions) |
| `#field` | Real private (runtime-enforced) class field |
| `readonly field: T` | TS-only immutability in class/object types |

**`satisfies` is the modern alternative to `as`.** It checks assignability without widening:

```ts
// `as` widens — `colors.red` is now `string`, not `'#ff0000'`
const colors = { red: '#ff0000', blue: '#0000ff' } as { [k: string]: string };

// `satisfies` checks but doesn't widen — `colors.red` stays `'#ff0000'`
const colors = { red: '#ff0000', blue: '#0000ff' } satisfies Record<string, string>;
```

When you see `as` in agent output, the right question is "could this be `satisfies`?" — `as` is type-asserting (trust me), `satisfies` is type-checking (verify).

---

## Common type errors

- *"Type 'X' is not assignable to type 'Y'"* — structural mismatch. Read the message all the way down; the cause is usually nested.
- *"Property 'foo' does not exist on type 'X'"* — either a missing field, or a discriminated union you haven't narrowed.
- *"Object is possibly 'undefined'"* — null/undefined narrowing. Use `?.`, `??`, or an early return.
- *"Type 'Promise<X>' is not assignable to type 'X'"* — missing `await`.
- *"Argument of type 'X' is not assignable to parameter of type 'never'"* — exhaustiveness check is failing; you have a union member the function doesn't handle.
- *"Cannot find module 'foo' or its corresponding type declarations"* — missing dep, or missing `@types/foo`, or your `moduleResolution` is wrong.
- *"This expression is not callable"* — usually a union of incompatible function shapes; narrow first.

---

## Notes on what *not* to copy

These are recurring patterns from the audit repos that look reasonable on first read but don't survive scrutiny:

- **`Proxy`-wrapped public API for test mocking** (dirsql). Use factory injection.
- **Hand-rolled napi-sys unsafe FFI** (dirsql). Use napi-rs's high-level Function/Env API.
- **Three duplicate `.eslintrc.js`** files in subdirectories (UpscalerJS). Define once, import.
- **Deprecated package shells in `packages/`** with one-line "this is deprecated" README (UpscalerJS `core/`, `upscalerjs-models/`, `upscalerjs-wrapper/`). Either remove (with an `EOL` marker on the npm version) or move out of the workspace.
- **`scripts/` directory at repo root containing only a log file** (UpscalerJS). The real scripts live in `internals/scripts/`. Pick one location.
- **Lockstep manual version bumps via `--no-verify` git commits** (UpscalerJS, dirsql). Use changesets.
- **`type: "commonjs"` packages with no clear consumer reason** (dirsql). ESM-first.
- **Empty `tests/` or `python/` directories at repo root from a previous layout** (dirsql). Delete.
- **Mixed `npm install` in CI workflows of a pnpm repo** (dirsql `publish.yml`). Stick to one.
- **README that says `pip install x`** for a project that internally forbids pip (skillet). Public-facing inconsistency.
- **More than 4 `tsconfig.<thing>.json` per package** (UpscalerJS has 6+). Use one base + per-output overrides, not one per concern.
- **Empty `napi.triples` `{}`** (dirsql) — the prebuilt-binary distribution that napi-rs orchestrates depends on this being populated.
- **Inline `with patch(...)`** in tests (cross-language idiom) — use fixtures.

---

## One-paragraph summary

ESM-first packages, exports map with per-condition types, `pnpm` + `wireit`, `tsc` for the build (rollup only when you need UMD), Vitest for tests with factory injection over `vi.mock`, ESLint + Prettier without bikeshedding, typedoc-generated API ref, `changesets` for versioning, OIDC publish with provenance, and CI that runs lint + typecheck + test as separate parallel jobs with path filters. `any` is a smell; `unknown` is its safer cousin; `satisfies` replaces most `as` casts. Tests run against the *built* artifact, not just source, because that's what consumers install. The whole stack composes from small, single-purpose tools — when an agent reaches for Lerna, Nx, Turborepo, Biome, or a custom `Proxy` wrapper, ask why before agreeing.

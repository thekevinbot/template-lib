# TypeScript guide

- Node 24
- pnpm

Engines pinned in root `package.json`:

```json
"engines": { "node": ">=24.0", "pnpm": ">=11" }
```


## Common Libraries

- vitest for testing
- eslint
- prettier
- tsc & tsx

Never use `npm` or `yarn` in a pnpm repo. The lockfiles aren't interchangeable, and `npm install` will silently rewrite resolution. The only exception worth knowing about: `npm publish --provenance` is the only way to get build provenance attestations as of 2026 — projects that publish with provenance use `npm publish` at release time only.

## Watch mode

For larger packages, run vitest in watch and a parallel `tsc --watch --noEmit` in another pane. There is no single bundled watcher in idiomatic TS the way `bacon` is in Rust — you compose your own from `vitest`, `tsc -w`, and (rarely) `concurrently` / `nodemon` if you need to chain.

---

## Monorepo shape

The dominant pattern across all four audit repos is **pnpm workspaces orchestrated by [wireit](https://github.com/google/wireit)**. Wireit lives in the root `package.json` under a `"wireit"` key, with each script declared `"wireit"` in `"scripts"`:

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
  - 'docs'
  - '!**/tmp/**'
  - '!**/node_modules/**'
```

Conventions worth adopting:

- **Real library packages live in `packages/`.** Private tooling/build/test helpers go in `internals/` and are marked `"private": true`.
- **Internal cross-package deps use `"workspace:*"`**, not version numbers. pnpm rewrites these at publish time.

## Github

Github is the source of truth.

### Github Actions

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
dist/                 # emitted, gitignored
test/integration      # integration tests. _Never_ integration test the CLI, only the TS SDK. Mock third party dependencies
test/e2e              # e2e tests. Generally should test the CLI if one is available. No mocking. Not executed by CI
package.json
tsconfig.json         # extends root
README.md
CHANGELOG.md
MIGRATIONS.md
putitoutthere.toml
```


`package.json` exports:

```json
{
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "LICENSE", "CHANGELOG.md", "MIGRATIONS.md"],
  "sideEffects": false
}
```

Things worth getting right:

- **`"type": "module"`** — ESM-only. No dual CJS build.
- **`"files"` allowlist** — `["dist", ...]`. Explicit allowlist keeps `.env`, `tmp/`, `coverage/` out of the published tarball.

Test colocation (`src/foo.ts` + `src/foo.test.ts`) is the default.

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

A separate `tsconfig.eslint.json` is common — lint includes test files, build doesn't.

**Do not use project references (`"references"`, `composite: true`)**. They rely on wireit's dependency graph and built `dist/` outputs. The trade-off: project references make `tsc -b` work as one command, but require careful `composite: true` config and slower incremental setup.

`strict: true` is non-negotiable. If you need to disable a specific strict flag (rare — `strictPropertyInitialization` for class-based ORM models is a real case), do it once at root with a comment, not scattered per file.

---

## Testing

**Default to Vitest.**

Per-package config (`vite.config.ts`):

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 }
    }
  }
});
```

**Integration tests** at `test/integration/` consume the *built* artifact, not source. Catches breaks (export-map drift, missing files, bad shebang on bin scripts) that source-only tests miss.

**Mocking**: use **factory injection**. Pass dependencies as constructor args; tests pass fakes:

```ts
// src/widget.ts
export function getWidget({ load, run }: Deps) {
  class Widget {
    constructor(opts: WidgetOptions) { /* ... */ }
    execute(input: Input) { /* uses load, run */ }
  }
  return Widget;
}

// src/index.ts
import { load } from './load';
import { run } from './run';
export const Widget = getWidget({ load, run });

// src/widget.test.ts
import { getWidget } from './widget';
const Widget = getWidget({ load: fakeLoad, run: fakeRun });
```

Factory injection works identically in every test runner and keeps the test plumbing visible at the call site.

---

## Lint + format

**ESLint + Prettier.** `@typescript-eslint/no-floating-promises` is the highest-value rule — keep it enabled.

Minimal `.eslintrc.cjs`:

```js
module.exports = {
  env: { node: true, es2022: true },
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

`eslint-config-prettier` disables conflicting rules. Prettier owns layout, ESLint owns correctness. Configure `printWidth` once at root and move on.

**Pre-commit hooks**: per-commit hooks that block trivial WIP commits are net-negative. Pre-push or none at all is fine. **What matters is that CI fails on lint errors.**

Lint should include test files. The `*.generated.ts` glob is the standard escape hatch for codegen output.

---

## Public API design

**Barrels with explicit named re-exports.** Not `export * from './foo'` at every level — that's how things accidentally become public.

```ts
// src/index.ts
export { Widget } from './widget';
export { AbortError } from './errors';
export type { ModelDefinition, WidgetOptions } from './types';
```

Type exports are explicit `export type` — supports `isolatedModules` and `verbatimModuleSyntax`.

**Class vs function**: if the public API is "construct a thing and call methods on it", use a class. If it's "call a function", use a function. Mixing — a default-exported class that wraps an internal named factory function — is fine.

**Default export vs named export**: default for the "primary thing", named for everything else. Pure-named is also fine, and friendlier to refactor tools. What matters is consistency within one package.

**JSDoc for hidden API**: `@hidden` (typedoc) or `@internal` (TS — gated by `--stripInternal`). Pick one and stick with it:

```ts
class Widget {
  /** @hidden */
  _opts: WidgetOptions;

  /** Public method documented for consumers. */
  run(input: Input): Promise<Output> { /* ... */ }
}
```

Underscored field names + `@hidden` is the strongest convention. `private` keyword still emits to `.d.ts`; `#private` (real private) is fine but breaks reflection in ways some consumers care about.

For test-friendly classes, expose dependencies via the constructor (factory injection / DI) so tests can pass fakes without runtime mocking.

---

## Versioning + release

**Use `putitoutthere`.** Single reusable workflow, single config file, OIDC trusted publishers across crates.io / PyPI / npm. Versions derive from git tags. Provenance, retry-with-backoff, tag rollback, registry idempotency are all handled inside the workflow.

### `putitoutthere.toml`

Repo-root config. The schema is prescriptive — every field below appears in every config; defaults stay implicit.

```toml
[putitoutthere]
version = 1

[[package]]
name       = "my-lib"
kind       = "npm"
path       = "."
globs      = ["src/**/*.ts", "package.json", "pnpm-lock.yaml", "tsconfig.json", "tsconfig.build.json", "README.md"]
access     = "public"
tag_format = "v{version}"
```

`globs` cascade-trigger a release on any commit touching a matching file. Single-package repos use `tag_format = "v{version}"`; multi-package repos let the default `"{name}-v{version}"` stand.

### Reusable workflow

`.github/workflows/release.yml`:

```yaml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    uses: thekevinscott/putitoutthere/.github/workflows/release.yml@v0
    permissions:
      contents: write
      id-token: write
```

The workflow drives `plan → build → publish → GitHub Release` end-to-end. Consumer-side YAML stays at the seven-line stub above.

### Release trailer

Default cascade bump is `patch`. Override in the merge-commit body:

```
fix: handle empty token lists

release: minor
```

Grammar: `release: {patch|minor|major|skip} [pkg1, pkg2, ...]`. Last trailer wins. Optional package list scopes the bump.

### Trusted publishers

One-time registry setup per package. The reusable workflow only authenticates via OIDC — long-lived registry tokens stay out of the workflow.

- **npm**: bootstrap one version with `NODE_AUTH_TOKEN`, then enable **Require trusted publisher** under `https://www.npmjs.com/package/<name>/access`. Delete the bootstrap token after.
- **PyPI**: under `https://pypi.org/manage/project/<name>/settings/publishing/`, add the GitHub publisher (owner, repo, workflow filename, optional environment). Brand-new projects use a pending publisher.
- **crates.io**: publish once via classic `cargo`, then enable trusted publishing under `https://crates.io/crates/<crate>/settings`.

Each per-platform sub-package (`my-cli-x86_64-unknown-linux-gnu`, etc.) gets its own registration — a policy on the umbrella package does not cover its platform packages.


### Polyglot Rust core

When the package ships a Rust CLI consumed via Node, declare the npm wrapper as `build = "bundled-cli"` and point `depends_on` at the crate. See [CLI architecture](#cli-architecture) for the full three-artifact shape (Rust crate + npm wrapper + PyPI wheel) and the launcher script.

The workflow publishes the umbrella npm package plus a per-platform sub-package per target; `optionalDependencies` pin the sub-packages so `npm install -g` resolves exactly one.

---

## Docs

**Docusaurus 2** for richer doc sites (multi-version, search, plugin ecosystem). **VitePress** for simpler ones (Vite-native, faster, less to configure). For a new project, VitePress unless you actually need Docusaurus features.

**Generate the API reference from JSDoc.** typedoc + `typedoc-plugin-markdown` + `docusaurus-plugin-typedoc` reads JSDoc and emits Markdown. typedoc respects `@hidden`/`@internal`. Generated docs stay in sync with the source.

**Per-package metadata under a namespaced key in `package.json`** is the load-bearing pattern:

```json
"@yourproject": {
  "title": "Pretty Display Name",
  "guide": { "frontmatter": { "category": "core" } }
}
```

The doc generator reads this. Single source of truth (the package's own `package.json`), no sidecar YAML.

**Code groups for multi-language libraries** (VitePress `::: code-group`, Docusaurus `<Tabs>`). When you do this, **set up a test that the code samples actually run**, or they will drift. Docs that systematically lie about an async API the code doesn't implement is what happens without sample tests.

---

## CI/CD

`.github/workflows/` shape:

| Workflow | Purpose | Trigger |
|---|---|---|
| `test.yml` | Unit + integration | every push/PR |
| `lint.yml` | ESLint + Prettier | every push/PR |
| `typecheck.yml` | `tsc --noEmit` | every push/PR |
| `docs.yml` | Build + deploy docs | push to main, `docs/**` |
| `release.yml` | `uses: thekevinscott/putitoutthere/.github/workflows/release.yml@v0` | push to main |
| `changelog-check.yml` | CHANGELOG.md + MIGRATIONS.md touched (or `skip-changelog:` trailer) | every PR |

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

**Matrix**: Node 20 is the LTS floor as of 2026. Matrix on Node 20 + 22 if your dep tree spans them. Pure-JS code matrices on Node version, Ubuntu only. Native bindings matrix on OS (Ubuntu, macOS, Windows) for wheel builds; Ubuntu-only for tests.

**Coverage uploads via Codecov / Coveralls**: nice-to-have, not gating. A per-package floor (85-90%) enforced in CI is only worth doing if you have a real bug-resistance argument.

---

## Native bindings (napi-rs)

If the package wraps a Rust crate via napi-rs:

- **Use napi-rs's high-level API.** `napi::bindgen_prelude::Function` and `napi::Env::execute_tokio_future` cover callback handling and async work without writing unsafe FFI.
- **Configure `napi.triples`** in `package.json` for the cross-platform prebuilt distribution.
- **Use `optionalDependencies` for per-platform `@org/<triple>` packages**, with a runtime resolver. napi-rs's toolchain does this out of the box.
- **chmod 0o755 on the binary after staging.** `actions/upload-artifact@v4` strips per-file exec bits; `fs.copyFileSync` defaults to 0644. Either chmod in your build script *after* artifact-download (not before upload), or chmod defensively at spawn-time in the shim.

---

## CLI architecture

**Every CLI is a Rust binary.** The TS package wraps it; so does the Python package. Argument parsing, validation, exit codes, the whole runtime lives in the crate. The wrappers exist to put the binary on `PATH` through the language's native install path.

Why: cross-platform distribution is a solved problem in Rust (single static binary per target), `clap` is the strongest CLI framework in any ecosystem, and one source of truth keeps argument grammar, help text, and error messages identical across `pip install` and `npm install -g`.

Layout:

```
my-tool/
  packages/
    rust/              # binary crate — Cargo.toml, src/main.rs (clap App)
      Cargo.toml
      src/
    node/              # npm wrapper, kind = "npm", build = "bundled-cli"
      package.json
      bin/my-tool.js   # launcher; resolves the per-platform sub-package binary
      src/
    python/            # PyPI wrapper, kind = "pypi", build = "maturin", bundle_cli
      pyproject.toml
      src/my_tool/
        __init__.py
        _binary/
          __init__.py  # entrypoint — execs the staged binary
  putitoutthere.toml
  CHANGELOG.md
  MIGRATIONS.md
  LICENSE
```

The TS launcher:

```js
#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { platform, arch } = process;

const triples = {
  'linux-x64':    'x86_64-unknown-linux-gnu',
  'linux-arm64':  'aarch64-unknown-linux-gnu',
  'darwin-x64':   'x86_64-apple-darwin',
  'darwin-arm64': 'aarch64-apple-darwin',
  'win32-x64':    'x86_64-pc-windows-msvc',
};

const triple = triples[`${platform}-${arch}`];
if (!triple) {
  console.error(`my-tool: unsupported platform ${platform}-${arch}`);
  process.exit(1);
}
const pkg = `@my-org/${triple}`;
const binary = require.resolve(
  `${pkg}/bin/my-tool${platform === 'win32' ? '.exe' : ''}`,
);
const result = spawnSync(binary, process.argv.slice(2), { stdio: 'inherit' });
process.exit(result.status ?? 1);
```

`putitoutthere.toml` for the polyglot release:

```toml
[putitoutthere]
version = 1

[[package]]
name          = "my-tool-rust"
kind          = "crates"
crate         = "my-tool-cli"
path          = "packages/rust"
first_version = "0.0.1"
globs         = ["packages/rust/**", "LICENSE"]

[[package]]
name          = "my-tool-py"
kind          = "pypi"
pypi          = "my-tool"
path          = "packages/python"
first_version = "0.0.1"
build         = "maturin"
depends_on    = ["my-tool-rust"]
globs         = ["packages/python/**", "packages/rust/**", "LICENSE"]
targets = [
  "x86_64-unknown-linux-gnu",
  "aarch64-unknown-linux-gnu",
  "x86_64-apple-darwin",
  "aarch64-apple-darwin",
  "x86_64-pc-windows-msvc",
]

[[package]]
name          = "my-tool-npm"
kind          = "npm"
npm           = "my-tool-cli"
path          = "packages/node"
first_version = "0.0.1"
build         = [{ mode = "bundled-cli", name = "@my-org/{triple}" }]
depends_on    = ["my-tool-rust"]
globs         = ["packages/node/**", "packages/rust/**", "LICENSE"]
targets = [
  "x86_64-unknown-linux-gnu",
  "aarch64-unknown-linux-gnu",
  "x86_64-apple-darwin",
  "aarch64-apple-darwin",
  "x86_64-pc-windows-msvc",
]
```

A change to `packages/rust/` cascades through the dependency graph: the crate publishes first, then the npm family and PyPI wheels with the same version. Each handler's first move is `isPublished` — already-shipped targets skip cleanly, so re-runs are safe.

Tests live where their subject lives. The crate's logic is tested in Rust (`cargo test`). The wrappers ship a single happy-path e2e per command — drive the actual binary in a subprocess, assert on output. CLI grammar is defined once, in `clap`.

---

## What good TS code looks like

Positive checklist for reviewing agent output:

- **Types**: every public function, method, and exported value has explicit types. `unknown` at boundaries, narrowed before use. Generic params constrained to the narrowest workable shape.
- **`satisfies` over `as`**: literal types stay literal; checks happen at definition.
- **Awaited promises**: every `Promise` is either `await`ed, returned, or explicitly marked `void p` for fire-and-forget. `@typescript-eslint/no-floating-promises` enforces this.
- **Explicit barrels**: `export { Name } from './file'` at each level; the public surface is intentional.
- **Subpath types**: each conditional entry in `exports` has its own `"types"`.
- **`sideEffects: false`** on side-effect-free packages; otherwise an explicit allowlist.
- **Colocated tests**: `src/foo.ts` + `src/foo.test.ts`. Integration tests at repo root consume the built artifact.
- **Factory injection** for testable classes: dependencies passed via the constructor; tests pass fakes.
- **Modern idioms**: `structuredClone` for deep copy, spread for object merge, `for ... of` for iteration, string-literal unions over runtime enums, `const` by default.
- **Real privacy where it matters**: `#private` or `_field` + `@hidden` consistently within a class.
- **`tsc --noEmit`, eslint, prettier, vitest** all green before review.

---

## Ecosystem cheat sheet

Standard tooling. If the agent picks something off-brand for one of these tasks, ask why.

| Task | De facto choice |
|---|---|
| Package manager | `pnpm` |
| Test runner | `vitest` |
| Build (library) | `tsc` direct, or `tsup` |
| Type checker | `tsc` (`tsc --noEmit`) |
| Linter | `eslint` + `@typescript-eslint/*` |
| Formatter | `prettier` |
| Docs | `vitepress` (simple) / `docusaurus` (rich) |
| API reference | `typedoc` (+ `typedoc-plugin-markdown`) |
| Versioning + release | `putitoutthere` |
| HTTP client | native `fetch` (built-in since Node 18); `undici` for advanced cases |
| Schema validation | `zod` |
| Date | `date-fns` or `temporal-polyfill` |
| Logger | `pino` |
| CLI args (inside a Rust core) | `clap` |
| CLI args (TS-only utility, no Rust core) | `commander` / `cac` |
| Async iteration | native `for await ... of` |
| Rust bindings | `napi-rs` |

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
2. **Types** — public surface fully typed; `unknown` at boundaries, narrowed before use.
3. **Tests** — colocated `*.test.ts`, exercising the public surface; factory injection where dependencies need to be swapped.
4. **`exports` map** — `types` per condition, `sideEffects` set correctly.
5. **Barrels** — explicit named re-exports at the public boundary.
6. **`package.json` changes** — new deps match the ecosystem table; `"files"` allowlist scoped to `dist`, `CHANGELOG.md`, `MIGRATIONS.md`.
7. **Reuse over reinvention** — date math, deep clone, schema validation, retry-with-backoff all come from the ecosystem table.
8. **Public API surface** — `default` vs named consistent; `@hidden` / `@internal` on the rest.
9. **CHANGELOG.md + MIGRATIONS.md** — both touched for any consumer-observable change, or a `skip-changelog:` trailer present.
10. **`putitoutthere.toml`** — `globs` cover every source path that should cascade; polyglot CLIs declare `depends_on` on the Rust crate.

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

`satisfies` is type-checking (verify), `as` is type-asserting (trust me). Prefer `satisfies` for literal-preserving checks.

---

## Common type errors

- *"Type 'X' is not assignable to type 'Y'"* — structural mismatch. Read the message all the way down; the cause is usually nested.
- *"Property 'foo' does not exist on type 'X'"* — either a missing field, or a discriminated union to narrow.
- *"Object is possibly 'undefined'"* — null/undefined narrowing. Use `?.`, `??`, or an early return.
- *"Type 'Promise<X>' is not assignable to type 'X'"* — missing `await`.
- *"Argument of type 'X' is not assignable to parameter of type 'never'"* — exhaustiveness check failing; a union member the function doesn't handle.
- *"Cannot find module 'foo' or its corresponding type declarations"* — missing dep, missing `@types/foo`, or `moduleResolution` mismatched.
- *"This expression is not callable"* — usually a union of incompatible function shapes; narrow first.

---

## One-paragraph summary

ESM-only Node packages, exports map with per-condition types, `pnpm` + `wireit`, `tsc` for the build, Vitest with factory injection for testable classes, ESLint + Prettier, typedoc-generated API ref, `putitoutthere` for cross-registry releases driven by `putitoutthere.toml` and a seven-line reusable workflow, CHANGELOG.md + MIGRATIONS.md updated on every consumer-observable change, and CI that runs lint + typecheck + test as separate parallel jobs with path filters. CLIs ship as a Rust crate with TS and Python wrappers — `clap` parses, the crate runs, the wrappers put the binary on `PATH`. `unknown` at boundaries with narrowing; `satisfies` for literal-preserving type checks. Tests run against the *built* artifact, not just source, because that's what consumers install. Small, single-purpose tools composed together — the stack stays legible.

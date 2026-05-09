# darkfactory (TypeScript)

TypeScript SDK for [darkfactory](https://github.com/thekevinscott/darkfactory). Shells out to the Rust binary.

## Install

```
pnpm add darkfactory
cargo install darkfactory   # required: provides the binary on PATH
```

Override binary path with `DARKFACTORY_BIN=/abs/path`.

## Usage

```ts
import { run } from 'darkfactory';

const result = run(['--help']);
console.log(result.stdout);
```

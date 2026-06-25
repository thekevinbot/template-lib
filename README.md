# Template Lib

A template for shipping **one Rust core** as **importable, native-feeling SDKs**
in Rust, Python, and TypeScript — each with a thin CLI over its own SDK, and
API parity enforced by a conformance suite.

The example kernel is a word-frequency `Counter` (a stateful API with iteration
and a typed error) — the smallest surface that still exercises every veneer
concern. Replace it with your own logic; keep the structure.

```
import { Counter } from 'mynewproduct';   // TS
from mynewproduct import Counter           # Python
use mynewproduct::Counter;                 // Rust
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the design and [AGENTS.md](./AGENTS.md)
for the contributor/agent contract.

## Build & verify locally

```bash
# Rust core + CLI
just rust-test
cargo run -q -p mynewproduct-cli -- --top 3 "the quick brown fox the lazy dog"

# Python SDK (PyO3, abi3-py312)
just py-venv && just py-develop && just py-test

# TS SDK (napi)
just node-install && just node-build && just node-test

# Parity across all three
just golden && just conformance
```

All three CLIs produce identical output:

```bash
cargo run -q -p mynewproduct-cli -- --top 3 "the quick brown fox the lazy dog The QUICK fox"
packages/python/.venv/bin/mynewproduct --top 3 "the quick brown fox the lazy dog The QUICK fox"
node packages/node/dist/cli.js --top 3 "the quick brown fox the lazy dog The QUICK fox"
# the   3
# fox   2
# quick 2
```

## The one discipline

If logic ever creeps into a veneer, you've started a port and reintroduced
drift. Keep behavior in `packages/rust/core`; keep veneers and CLIs as
presentation. `conformance/conformance.py` is what catches a violation.

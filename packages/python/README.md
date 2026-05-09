# darkfactory (Python)

Python SDK for [darkfactory](https://github.com/thekevinscott/darkfactory). Shells out to the Rust binary.

## Install

```
pip install darkfactory
cargo install darkfactory   # required: provides the binary on PATH
```

Override binary path with `DARKFACTORY_BIN=/abs/path`.

## Usage

```python
from darkfactory import run

result = run(["--help"])
print(result.stdout)
```

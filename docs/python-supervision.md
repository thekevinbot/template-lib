# Python guide

- Python 3.12+
- uv

Python floor pinned in `pyproject.toml`:

```toml
[project]
requires-python = ">=3.12"
```


## Common Libraries

- pytest + pytest-describe + pytest-asyncio for testing
- ruff for lint + format
- ty (or mypy / pyright) for type checking
- hatchling + hatch-vcs for pure-Python build
- maturin for PyO3-Rust build
- just for task running
- bandit for security scanning

**Never `pip`.** Not even `uv pip` (it's a compatibility shim). Not even `python -m pip`. The `uv add` / `uv sync` / `uv run` triad replaces it. `uv run` invokes commands inside the project venv against the lockfile — no manual `source .venv/bin/activate` needed.

## Watch mode

```fish
uv run pytest-watcher .
```

There's no monolithic watcher like Rust's `bacon`; compose your own from `pytest-watcher` (asyncio-aware) and a parallel `ty --watch` if you want type-check feedback in another pane.

---

## Github

Github is the source of truth.

### Github Actions

`concurrency` to cancel previous runs on the same ref:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Cheap, always wanted.

---

## Project shape

Flat layout:

```
myproject/
  myproject/
    __init__.py
    core.py
    core_test.py             # colocated unit test
    cli/
      __init__.py
      main.py
  tests/
    conftest.py
    integration/             # cross-module, mock third-party deps
    e2e/                     # CLI invocation, no mocking, not run by CI
  docs/
  scripts/
  pyproject.toml
  uv.lock
  justfile
  putitoutthere.toml
  README.md
  CHANGELOG.md
  MIGRATIONS.md
  LICENSE
```

For PyO3 / maturin packages: Rust source in `src/`, Python source in `python/` (or wherever `tool.maturin.python-source` points), tests in `tests/`:

```
myproject/
  src/                       # Rust (PyO3) source
    lib.rs
  python/
    myproject/
      __init__.py            # re-exports from compiled _myproject
  tests/
  pyproject.toml             # build-backend = "maturin"
```

`__init__.py` should be **the thinnest possible** public-API surface. Re-export named items, set `__all__`, don't import heavy deps eagerly:

```python
"""myproject - one-line description."""

from myproject.errors import MyError, ValidationError
from myproject._version import __version__

__all__ = ["MyError", "ValidationError", "__version__"]
```

For libraries that ship optional heavy subsystems (numpy, torch, etc.), use **PEP 562 lazy imports** to keep `import myproject` cheap:

```python
# myproject/__init__.py
_LAZY: dict[str, str] = {
    "evaluate": "myproject.eval",
    "tune": "myproject.tune",
}

def __getattr__(name: str):
    if name in _LAZY:
        import importlib
        module = importlib.import_module(_LAZY[name])
        value = getattr(module, name)
        globals()[name] = value
        return value
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
```

**One-public-callable-per-file**: each `.py` exports a single function/class named to match the filename (`get_rate_color.py` → `get_rate_color()`). Multi-callable files get promoted to subpackages with one file per callable. Exempt: `types.py`, `models.py`, `errors.py`, `__init__.py`, `conftest.py`, `dataclasses.py`.

---

## pyproject.toml

```toml
[build-system]
requires = ["hatchling>=1.20", "hatch-vcs>=0.4"]
build-backend = "hatchling.build"

[project]
name = "myproject"
dynamic = ["version"]
description = "One-line description."
readme = "README.md"
requires-python = ">=3.12"
license = "MIT"
authors = [{ name = "Author", email = "author@example.com" }]
keywords = ["..."]
classifiers = [
  "Development Status :: 4 - Beta",
  "Programming Language :: Python :: 3.12",
  "Programming Language :: Python :: 3.13",
  "License :: OSI Approved :: MIT License",
]
dependencies = [
  "pyyaml>=6.0",
  "rich>=13.0",
]

[project.optional-dependencies]
dev = [
  "ruff>=0.8",
  "pytest>=8.0",
  "pytest-asyncio>=0.24",
  "pytest-describe>=2.0",
  "pytest-cov>=4.0",
  "pytest-watcher>=0.4",
  "ty>=0.0.1a7",          # or "mypy>=1.10"
  "bandit>=1.7",
]

[project.scripts]
myproject = "myproject.cli.main:main"

[project.urls]
Homepage = "https://github.com/org/myproject"
Documentation = "https://myproject.dev"
Issues = "https://github.com/org/myproject/issues"

[tool.hatch.version]
source = "vcs"

[tool.hatch.build.targets.wheel]
packages = ["myproject"]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "W", "F", "I", "B", "C4", "C90", "UP", "ARG", "SIM", "PTH", "PLR", "RUF"]
ignore = []

[tool.ruff.lint.mccabe]
max-complexity = 10

[tool.ruff.lint.pylint]
max-args = 8
max-statements = 50

[tool.ruff.lint.per-file-ignores]
"*_test.py" = ["PLR2004", "PLR0915", "C901"]
"tests/**/*.py" = ["PLR2004", "PLR0915", "C901"]

[tool.ruff.lint.isort]
known-first-party = ["myproject"]

[tool.ruff.format]
quote-style = "double"

[tool.pytest.ini_options]
testpaths = ["myproject", "tests"]
python_files = ["*_test.py", "test_*.py"]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "function"

[tool.coverage.run]
branch = true
source = ["myproject"]
omit = ["*_test.py", "tests/*"]

[tool.coverage.report]
fail_under = 85
exclude_lines = [
  "pragma: no cover",
  "raise NotImplementedError",
  "if TYPE_CHECKING:",
]

[tool.bandit]
skips = ["B101"]            # assert_used — fine in tests
```

Things worth getting right:

- **Build backend**: `hatchling` for pure-Python, `maturin` for PyO3.
- **Dynamic version from VCS tags** (`hatch-vcs`). No hardcoded version, no `__version__ = "0.1.0"` to update. Wheel version comes from `git describe`.
- **`requires-python = ">=3.12"`** — lets you use PEP 695 generics (`def f[T](x: T) -> T:`) and `int | None` everywhere without `from __future__ import annotations`.
- **`[project.scripts]`** for CLI entry points — not `console_scripts` (legacy).
- **`[project.urls]`** populated. PyPI shows these on the project page.
- **`asyncio_mode = "auto"`** — every test is async-aware automatically. Drops the `@pytest.mark.asyncio` boilerplate.

**uv stays implicit via `uv.lock`** — add a `[tool.uv]` block only when you need to override its defaults.

---

## Type hints

**Python 3.12+ syntax, no `__future__`.**

```python
def process(items: list[Item], *, max_retries: int = 3) -> dict[str, int]:
    ...

# PEP 695 generics (3.12+)
def first[T](items: list[T]) -> T | None:
    return items[0] if items else None

# Class generics
class Cache[K, V]:
    def __init__(self) -> None:
        self._store: dict[K, V] = {}

# Type alias
type UserId = int
type JSON = None | bool | int | float | str | list["JSON"] | dict[str, "JSON"]
```

Use `T | None` not `Optional[T]`. Use `list[T]` not `List[T]`. Use `dict`, `tuple`, `set` lowercase. The capital-letter typing-module aliases are legacy.

**Mark the package typed**:

```
myproject/
  py.typed         # empty file; tells type checkers the package has inline hints
```

Then `force-include` it in the wheel build (if hatchling needs hinting):

```toml
[tool.hatch.build.targets.wheel]
packages = ["myproject"]
include = ["myproject/py.typed"]
```

**dataclass for internal data, Pydantic at boundaries.**

```python
# Internal data shape — dataclass
from dataclasses import dataclass

@dataclass
class IterationResult:
    eval_idx: int
    iteration: int
    response: str
    passed: bool
    cached: bool = False

# LLM / network / user-input boundary — Pydantic
from pydantic import BaseModel, Field, ConfigDict

class Judgment(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    passed: bool = Field(alias="pass", description="...")
    reasoning: str = Field(default="", description="...")
```

Pydantic's validation cost is paid only where validation is *useful* (parsing JSON from a model, validating user-supplied YAML). Internal data structures pay nothing.

**`Protocol` for structural typing**, **`TypeVar` is mostly obsolete** in 3.12+ (PEP 695 generics replace it).

```python
from typing import Protocol

class Loader(Protocol):
    def load(self, name: str) -> bytes: ...
```

**Import from `typing` only the names you use.** `Literal`, `Final`, `ClassVar`, `Annotated` each have real uses; pull them in deliberately.

**Type checker**: `ty` (Astral, alpha as of 2026), `mypy` (mature, stable), or `pyright` (Microsoft, fast). **Pick one and run it in CI.** For a library shipping to PyPI right now, mypy is the safest pick — `mypy --strict` finds the most footguns.

**Hints carry the public API contract.** Every public function and method has them; documentation explains *why*, not *what*.

---

## Tests

**pytest, with `pytest-describe` for BDD-flavour grouping and `pytest-asyncio` for async.**

```python
# myproject/core_test.py
import pytest
from myproject.core import process

def describe_process():
    def describe_when_items_is_empty():
        def it_returns_empty_dict():
            assert process([]) == {}

    def describe_when_items_has_duplicates():
        def it_counts_each_item():
            result = process(["a", "a", "b"])
            assert result == {"a": 2, "b": 1}

    @pytest.mark.parametrize("items,expected", [
        ([], {}),
        (["a"], {"a": 1}),
        (["a", "a"], {"a": 2}),
    ])
    def it_handles_various_inputs(items, expected):
        assert process(items) == expected
```

Naming convention: **`foo.py` ↔ `foo_test.py` colocated**. The legacy `test_foo.py` prefix also works (pytest discovers both with `python_files = ["*_test.py", "test_*.py"]`).

**Why colocated**: the test file sits next to its subject. Move the source file, the test moves with it. The directory hierarchy is the source hierarchy.

**`tests/` directory** holds integration tests, e2e tests, and shared fixtures. Unit tests live next to source.

**Async tests** — `asyncio_mode = "auto"` removes the `@pytest.mark.asyncio` decorator boilerplate:

```python
async def it_awaits_the_thing():
    result = await my_async_function()
    assert result == expected
```

With `asyncio_mode = "auto"`, async tests are picked up automatically. Reserve `@pytest.mark.asyncio` for the one-off case where you need a non-default loop scope or marker.

**Fixtures** in `conftest.py`. Prefer fixtures over inline `with patch(...)`:

```python
# tests/conftest.py
import pytest
from pathlib import Path

@pytest.fixture
def tmp_dir(tmp_path: Path) -> Path:
    return tmp_path

@pytest.fixture
def mock_external_api(mocker):
    api = mocker.patch("myproject.external.fetch")
    api.return_value = {"status": "ok"}
    return api
```

For mocking a streaming external service (LLM client, network stream), build a fixture that exposes `set_response`, `set_error`, `set_responses` so each test configures the mock declaratively.

**Coverage** with `pytest-cov`, `branch=true`, `fail_under` set per project — 85 is a reasonable floor; aiming for 100 forces tests for trivia.

---

## Async / sync discipline

**Default to async.**

- **`asyncio` only.**
- **Bounded concurrency via `asyncio.Semaphore`**:

  ```python
  sem = asyncio.Semaphore(parallel)
  async def run_one(t):
      async with sem:
          return await do_thing(t)
  results = await asyncio.gather(*(run_one(t) for t in tasks))
  ```

- **Fully consume async generators** — drain to completion rather than early-`break` or early-`return`. anyio's CancelScope errors under `asyncio.gather` come from leaving generators partially consumed. Drain the generator and defer exceptions:

  ```python
  result, deferred_error = None, None
  async for message in stream:
      if deferred_error is not None:
          continue   # drain the generator
      try:
          result = process(message)
      except Exception as e:
          deferred_error = e
  if deferred_error is not None:
      raise deferred_error
  ```

  Only relevant when aggregating multiple async iterators.

- **Sync-from-async** bridge — running a coroutine from sync code when there's already an event loop running. Use a fresh `ThreadPoolExecutor`:

  ```python
  def run_sync(coro):
      try:
          loop = asyncio.get_running_loop()
      except RuntimeError:
          return asyncio.run(coro)
      with ThreadPoolExecutor(max_workers=1) as pool:
          return pool.submit(asyncio.run, coro).result()
  ```

- **Sync core, async wrapper** is the right architecture for libraries that wrap I/O. Keep pure-computation code sync; add an async surface only when there's real I/O to overlap.

**Async hygiene**:

- An `async def` body actually `await`s something. If it doesn't, drop the `async`.
- Library code leaves the event loop to the caller. `asyncio.run` lives at the program entrypoint.
- Sleep is `await asyncio.sleep(n)` inside `async def`.
- Blocking I/O moves through `asyncio.to_thread` — or use the async client (`httpx.AsyncClient`, `aiofiles`).

---

## CLI

**Every CLI is a Rust binary.** The Python package is a thin wrapper that puts the binary on `PATH` through `pip install`. Argument parsing (clap), validation, exit codes, the whole runtime lives in the crate. Same goes for the npm sibling.

Why: one source of truth for argument grammar, help text, and error messages across `pip install` and `npm install -g`. `clap` is the strongest CLI framework available, cross-platform static binaries solve distribution, and the wrapper layer stays minimal.

### Layout

```
my-tool/
  packages/
    rust/              # binary crate — Cargo.toml, src/main.rs (clap App)
      Cargo.toml
      src/
    node/              # npm wrapper sibling (see typescript-supervision.md)
    python/            # this package
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

### `pyproject.toml`

```toml
[build-system]
requires = ["maturin>=1.5"]
build-backend = "maturin"

[project]
name = "my-tool"
dynamic = ["version"]
requires-python = ">=3.12"

[project.scripts]
my-tool = "my_tool._binary:entrypoint"

[tool.maturin]
python-source = "src"
include = ["src/my_tool/_binary/**"]
```

### Launcher

`src/my_tool/_binary/__init__.py`:

```python
import os
import sys
from pathlib import Path


def entrypoint() -> None:
    here = Path(__file__).parent
    binary = here / ("my-tool.exe" if os.name == "nt" else "my-tool")
    if not binary.exists():
        sys.stderr.write(f"my-tool binary not found at {binary}\n")
        sys.exit(1)
    os.execv(binary, [str(binary), *sys.argv[1:]])
```

`os.execv` replaces the Python process — no orphaned interpreter, signals route directly to the binary.

### `putitoutthere.toml`

Three-artifact shape:

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
# (npm sibling package omitted — see typescript-supervision.md)
```

`putitoutthere` cross-compiles the binary per target, stages it into `src/my_tool/_binary/` before maturin runs, and ships one wheel per platform. `pip install my-tool` on any platform gets a working CLI on PATH with no Rust toolchain required.

### Testing

The crate's logic is tested in Rust (`cargo test`). The Python wrapper ships a single happy-path e2e per command — drive the actual binary in a subprocess and assert against output:

```python
import subprocess

def it_runs_the_tool(tmp_path):
    result = subprocess.run(
        ["my-tool", "run", "--input", str(tmp_path / "in.json")],
        capture_output=True,
        text=True,
        check=True,
    )
    assert "done" in result.stdout
```

### Pure-Python utilities

For a small Python-only utility that isn't worth a Rust core (script, internal tool, ad-hoc batch job): `cyclopts` for type-driven multi-command CLIs, `click`/`typer` as mature alternatives, `argparse` for one-shot scripts. Anything that's going to be installed by more than a handful of people gets the Rust shape.

---

## Lint + format

**`ruff` for both.** One tool handles formatting, import sorting, and lint, faster than the legacy three-tool pipeline.

```toml
[tool.ruff]
line-length = 100        # 100 is reasonable; 88 (black default) is defensible
target-version = "py312"

[tool.ruff.lint]
select = [
  "E",    # pycodestyle errors
  "W",    # pycodestyle warnings
  "F",    # pyflakes
  "I",    # isort (import sorting)
  "B",    # flake8-bugbear (likely bugs)
  "C4",   # flake8-comprehensions
  "C90",  # mccabe complexity
  "UP",   # pyupgrade (modernise syntax)
  "ARG",  # unused-argument
  "SIM",  # flake8-simplify
  "PTH",  # use pathlib
  "PLR",  # pylint refactor (incl. complexity)
  "RUF",  # ruff-specific
]
```

Enable rule groups deliberately. The set above is a reasonable starting point. `D` (pydocstyle) is rarely worth the friction it adds.

**Per-file ignores for tests** (`PLR2004` magic numbers, `PLR0915` too-many-statements, `C901` too-complex are all OK in tests):

```toml
[tool.ruff.lint.per-file-ignores]
"*_test.py" = ["PLR2004", "PLR0915", "C901"]
"tests/**/*.py" = ["PLR2004", "PLR0915", "C901"]
```

**Type checker in CI** — `ty check myproject/` or `mypy myproject/` as a separate job. Type errors block merge.

**Security**: `bandit` is fine to run in CI. Tell it to skip `B101` (assert-used) for tests. Scope the per-file `# nosec B603,B607` annotations rather than blanket-skipping subprocess rules globally.

**`docformatter`**: optional. If you maintain Google-style docstrings, it formats them; if not, skip.

---

## Public API design

**Docstrings**: short, *why*-oriented. Let the signature carry the structure:

```python
def parse(content: str, *, strict: bool = False) -> Document:
    """Parse a document, raising on the first ambiguity if strict.

    The non-strict mode is forgiving for back-compat; new callers should set
    strict=True to surface schema drift early.
    """
```

When the type hints carry the structure, the prose carries the rationale.

**API reference via `mkdocs-material` + `mkdocstrings`** for new projects; `sphinx` + `sphinx-autodoc` is the mature alternative. Both render docstrings to HTML.

**Exception hierarchy** — define a flat tree at `myproject/errors.py`, re-export from `__init__.py`:

```python
# myproject/errors.py
class MyProjectError(Exception):
    """Base exception for myproject."""

class ValidationError(MyProjectError):
    """A user input failed schema validation."""

class NotFoundError(MyProjectError):
    """The requested resource does not exist."""
```

```python
# myproject/__init__.py
from myproject.errors import MyProjectError, ValidationError, NotFoundError
__all__ = ["MyProjectError", "ValidationError", "NotFoundError", "__version__"]
```

Give each failure mode its own exception variant. One variant per condition (lock-poison, init-failure, not-ready) keeps `except` clauses precise.

**Class-with-`__call__` vs function**: prefer a function for one-shot behaviour; a class for stateful workflows. Intermediate variables read better in Python than chained pipelines (`process(data).then(...).then(...)`).

**Avoid built-in names for fields and variables** (`type`, `id`, `list`, `dict`, `input`, `format`). Use `kind`/`type_` and `key`/`id_` so the built-in stays usable in scope.

---

## Configuration

**Minimal.** A library should take a config object (or kwargs) at instantiation. Settings systems (`pydantic-settings`, `dynaconf`) belong in apps, not libraries.

For application-level config, the minimum:

```python
# myproject/config.py
import os
from pathlib import Path

PROJECT_DIR = Path(os.environ.get("MYPROJECT_DIR", str(Path.home() / ".myproject")))
CACHE_DIR = PROJECT_DIR / "cache"
```

If you reach for `pydantic-settings`, you're past minimum. That's fine — verify the project needs typed env-var loading with validation, not just `os.environ.get`.

**Ship `.env.example` and `.gitignore` the real `.env`.** Document the variables the example carries; the real `.env` stays out of the repo.

---

## Repo orchestration

**`justfile`** for contributor commands.

```make
default: ci

lint:
    uv run ruff check .

format:
    uv run ruff format .

format-check:
    uv run ruff format --check .

typecheck:
    uv run ty check myproject/

test-unit:
    uv run pytest myproject/ -x -q

test-integration:
    uv run pytest tests/integration/ -x -q

test-e2e:
    uv run pytest tests/e2e/ -x -q

test-cov:
    uv run pytest --cov=myproject --cov-report=term-missing --cov-fail-under=85

ci:
    #!/usr/bin/env bash
    set -euo pipefail
    just lint &
    just format-check &
    just typecheck &
    wait
    just test-unit
    just test-cov

clean:
    rm -rf dist/ build/ .pytest_cache/ .ruff_cache/ .coverage htmlcov/

build:
    uv build
```

Run lint/format-check/typecheck in parallel before tests. Meaningful speedup.

**Pre-push (not pre-commit)** if you want client-side enforcement. Pre-commit hooks on every commit are net-negative — they slow down WIP commits and people learn to `--no-verify`. Pre-push runs once before the push, after you've reorganised commits. Install via `just hooks`:

```fish
#!/bin/sh
# scripts/hooks/pre-push
just ci
```

---

## CI/CD

`.github/workflows/` layout:

| File | Purpose |
|---|---|
| `test.yml` | `uv run pytest` matrix on Python 3.12, 3.13 |
| `lint.yml` | `uv run ruff check` + `ruff format --check` |
| `typecheck.yml` | `uv run ty check` (or mypy) |
| `security.yml` | `bandit -r myproject` |
| `coverage.yml` | `pytest --cov --cov-fail-under=85` |
| `docs.yml` | Build + deploy mkdocs/sphinx site |
| `changelog-check.yml` | CHANGELOG.md + MIGRATIONS.md touched (or `skip-changelog:` trailer) |
| `release.yml` | `uses: thekevinscott/putitoutthere/.github/workflows/release.yml@v0` |

**Use `astral-sh/setup-uv@v7`**, not `actions/setup-python`. uv installs and pins Python itself:

```yaml
- uses: actions/checkout@v6
- uses: astral-sh/setup-uv@v7
  with:
    python-version: "3.12"
    enable-cache: true
- run: uv sync --frozen
- run: uv run pytest
```

**Path filters** on every workflow so docs-only PRs don't run the test matrix:

```yaml
on:
  push:
    paths:
      - "myproject/**"
      - "tests/**"
      - "pyproject.toml"
      - "uv.lock"
      - ".github/workflows/test.yml"
```

**Matrix sparingly.** Python 3.12 + 3.13 is enough; cross-OS only if you have native code or filesystem-specific behaviour. For PyO3 packages, matrix OS for wheel builds, Ubuntu-only for tests.

**Concurrency cancel previous runs**:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

---

## CHANGELOG + MIGRATIONS

Every PR that changes public API touches both files. Enforced in CI; a `skip-changelog:` trailer bypasses the check for internal refactors.

**`CHANGELOG.md`** — Keep a Changelog format. New entries under `## Unreleased`, grouped `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed`. Breaking changes carry a `**BREAKING**` prefix and link to the `MIGRATIONS.md` section. On release, `## Unreleased` is renamed to `## v<OLD> → v<NEW>` and a fresh `## Unreleased` opens.

**`MIGRATIONS.md`** — single file at the repo root. New entries under `## Unreleased`. Each entry has five sections, in order:

1. **Summary** — one paragraph: what changed and why.
2. **Required changes** — before/after for config, CLI flags, kwargs, action inputs. "None" if purely additive.
3. **Deprecations removed** — anything previously warned about that's now gone. "None" if nothing was removed.
4. **Behavior changes without code changes** — same API, different runtime behavior (tag format, exit codes, defaults).
5. **Verification** — commands the consumer runs to confirm the upgrade worked, with expected output.

Public-API surface: every exported value/type, every CLI flag, every config key, every observable artifact (tag format, GitHub Release body shape). Internal refactors, test-only changes, docs-only edits stay out.

---

## Release flow

**Use `putitoutthere`.** Single reusable workflow, single config file, OIDC trusted publishers across PyPI / crates.io / npm. Versions derive from git tags via `hatch-vcs`. Provenance, retry-with-backoff, tag rollback, registry idempotency are all inside the workflow.

### `putitoutthere.toml`

Repo-root config. Prescriptive schema — every package declares the same fields; defaults stay implicit.

```toml
[putitoutthere]
version = 1

[[package]]
name       = "my-lib"
kind       = "pypi"
path       = "."
globs      = ["myproject/**/*.py", "pyproject.toml", "uv.lock"]
build      = "hatch"            # or "maturin" for PyO3 packages
tag_format = "v{version}"
```

For maturin packages, declare `targets`:

```toml
[[package]]
name    = "my-lib"
kind    = "pypi"
path    = "."
globs   = ["src/**", "python/**", "pyproject.toml"]
build   = "maturin"
targets = [
  "x86_64-unknown-linux-gnu",
  "aarch64-unknown-linux-gnu",
  "x86_64-apple-darwin",
  "aarch64-apple-darwin",
  "x86_64-pc-windows-msvc",
]
```

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

The workflow drives `plan → build → publish → GitHub Release`. Consumer-side YAML stays at the seven-line stub above. `SETUPTOOLS_SCM_PRETEND_VERSION` handoff for `hatch-vcs` dynamic-version builds is set inside the workflow.

### Release trailer

Default cascade bump is `patch`. Override in the merge-commit body:

```
fix: handle empty token lists

release: minor
```

Grammar: `release: {patch|minor|major|skip} [pkg1, pkg2, ...]`. Last trailer wins. Optional package list scopes the bump.

### Trusted publishers

One-time registry setup per package — OIDC only.

- **PyPI**: under `https://pypi.org/manage/project/<name>/settings/publishing/`, add the GitHub publisher (owner, repo, workflow filename, optional environment). Brand-new projects use a pending publisher.
- **crates.io** (when the package ships a Rust core): publish once via classic `cargo`, then enable trusted publishing under `https://crates.io/crates/<crate>/settings`.
- **npm** (when the package has a TS wrapper sibling): bootstrap one version with `NODE_AUTH_TOKEN`, then **Require trusted publisher** under `https://www.npmjs.com/package/<name>/access`.

---

## What good Python code looks like

- **Typed public surface**: every public function, method, and exported value has explicit hints. The signature is the contract.
- **Native 3.12+ syntax**: `list[T]`, `dict[K, V]`, `T | None`, PEP 695 generics (`def first[T](xs: list[T]) -> T | None`). Type aliases via `type Foo = ...`.
- **Specific exception handling**: each `except` names a concrete exception class and either re-raises with context, logs, or converts to a documented return value. A one-line comment explains the conversion.
- **`subprocess.run([...], shell=False)`** for process invocation. `json.loads` / `ast.literal_eval` for structured-data parsing. `pathlib.Path` for filesystem.
- **Default args are immutable**: `items: list[T] | None = None`, then `items = items if items is not None else []` inside the function.
- **Identity comparison for sentinels**: `is None`, `is True`, `is False` — or just truthiness (`if x:`, `if not x:`, `if not xs:`).
- **`for i, item in enumerate(items):`** and `for k, v in d.items():` over index-by-range.
- **f-strings** for interpolation. Always.
- **Explicit `__all__`** in every `__init__.py`. Heavy-dep subpackages loaded via PEP 562 `__getattr__`.
- **Slotted, frozen dataclasses where the data is immutable**: `@dataclass(frozen=True, slots=True)`. Catches typo-assignments and saves memory.
- **`Protocol` for structural typing** over inheritance. PEP 695 generics over `TypeVar` on 3.12+.
- **`cast(T, x)` carries a comment** explaining the unverified assumption.
- **Docstrings start with the verb** ("Parse a document and ..."), describe *why*, and let the signature carry the types.
- **Env vars read through a small config module** with documented defaults, not scattered `os.environ["FOO"]`.
- **`uv run pytest`, `ruff check`, `ruff format --check`, `ty check`** all green before review.

---

## PyO3 bindings

When the Python package wraps a Rust crate via PyO3 + maturin:

- **The binding wraps the Rust *SDK***, not the core directly. If you find yourself reimplementing scanner-loops, watcher-loops, or domain logic in the PyO3 binding, you've drifted — that work belongs in the SDK crate, which both bindings (Python, JS) consume.
- **`extension-module` feature** in `Cargo.toml`, gated by `[features]` so the crate can also build as a plain rlib for testing:

  ```toml
  [features]
  extension-module = ["pyo3/extension-module"]
  [dependencies]
  pyo3 = { version = "0.22", default-features = false, features = ["macros"] }
  ```

- **`module-name = "myproject._mycore"`** with the `_`-prefix convention. The Python package re-exports from the compiled extension.
- **Preserve type info across the FFI boundary** — convert Rust types to Python types deliberately:

  ```rust
  fn convert_value(py: Python, v: &Value) -> PyResult<PyObject> {
      // bool BEFORE int — Python's bool is a subclass of int
      match v {
          Value::Bool(b) => Ok(b.into_py(py)),
          Value::Int(i) => Ok(i.into_py(py)),
          Value::String(s) => Ok(s.into_py(py)),
          // ...
      }
  }
  ```

  The `bool`-before-`int` ordering matters for Python's subtype rules.

- **Map Rust error variants to specific Python exception types** at the boundary, so Python consumers can `except` precisely:

  ```rust
  match err {
      DbError::SchemaMismatch(msg) => SchemaMismatchError::new_err(msg),
      DbError::NotFound(name) => NotFoundError::new_err(format!("not found: {name}")),
      _ => PyRuntimeError::new_err(err.to_string()),
  }
  ```

  Stringifying every error means Python consumers see a generic `RuntimeError` and can't catch specifics.

- **Ship typed stubs** if the public API is non-trivial. Either inline `.pyi` files or maturin-generated stubs.
- **`py.typed` marker** in the Python source dir so type checkers know the package is typed.

---

## Ecosystem cheat sheet

| Task | De facto choice |
|---|---|
| Package manager | `uv` |
| Build (pure Python) | `hatchling` (+ `hatch-vcs`) |
| Build (PyO3 native) | `maturin` |
| Test runner | `pytest` |
| Test grouping | `pytest-describe` |
| Async tests | `pytest-asyncio` (`asyncio_mode = "auto"`) |
| Type checker | `mypy` (mature) / `pyright` / `ty` (alpha) |
| Linter + formatter | `ruff` |
| Security | `bandit` |
| CLI (production tool) | Rust crate with `clap`, Python wrapper via `maturin` + `bundle_cli` |
| CLI args (pure-Python utility) | `cyclopts` / `click` / `typer` |
| HTTP client (sync) | `httpx` (or `requests` if legacy) |
| HTTP client (async) | `httpx.AsyncClient` / `aiohttp` |
| Schema validation | `pydantic` (v2) |
| Settings | `pydantic-settings` (apps only) |
| Date/time | `whenever` (modern) / stdlib `datetime` |
| Logging | `structlog` / stdlib `logging` |
| Concurrency primitives | stdlib `asyncio` / `concurrent.futures` |
| Plotting | `matplotlib` (slow defaults) / `plotly` (interactive) |
| Numerics | `numpy`, `polars` (preferred over pandas for new projects) |
| Docs | `mkdocs` + `mkdocs-material` + `mkdocstrings` |
| Versioning (in-package) | `hatch-vcs` (VCS-derived) |
| Release orchestration | `putitoutthere` (reusable workflow + `putitoutthere.toml`) |
| Pre-commit | `pre-commit` framework — but prefer pre-push |

---

## Pre-review tooling pass

Before reading a line:

```fish
uv sync
uv run pytest -x -q
uv run ruff check .
uv run ruff format --check .
uv run ty check myproject/    # or mypy
```

If the agent didn't run these, ask. If they fail, the agent should fix before you read.

## Reading-a-PR checklist

1. **Tooling pass** — all five green?
2. **Type hints on public API** — every public function/method has explicit hints; any `Any` carries a one-line reason.
3. **Exception handling** — every `except` either re-raises, logs, or has a one-line comment explaining the conversion to data.
4. **Async correctness** — `await asyncio.sleep` and async clients inside `async def`; `gather` over bounded `Semaphore`.
5. **Docstrings** — present on public surface; *why*-oriented; signature carries the structure.
6. **Tests** — colocated `*_test.py` or in `tests/`; pytest-describe structure; fixtures over inline `with patch(...)`.
7. **`pyproject.toml` changes** — new deps reputable (see ecosystem table)? In the right group (`dev` vs runtime)?
8. **Reuse over reinvention** — date parsing, retry-with-backoff, schema validation, CLI args all come from stdlib or established packages.
9. **`__init__.py`** — explicit `__all__`; heavy deps loaded through PEP 562 lazy attribute access where appropriate.
10. **Native 3.12+ syntax** — `list[T]`, `T | None`, PEP 695 generics; `from __future__ import annotations` only where the project floor demands it.
11. **CHANGELOG.md + MIGRATIONS.md** — both touched for any consumer-observable change, or a `skip-changelog:` trailer present.
12. **`putitoutthere.toml`** — `globs` cover every source path that should cascade; CLI packages declare `depends_on` on the Rust binary crate and carry a `[package.bundle_cli]` table.
13. **CLI shape** — if the PR adds a user-facing CLI, the binary is a Rust crate with the Python wrapper exec-ing into it; argument parsing lives in `clap`, not Python.

---

## Common type errors

- *"Incompatible types in assignment (expression has type X, variable has type Y)"* — narrowing failed; check the union members.
- *"Item 'None' of 'X | None' has no attribute 'foo'"* — narrow with `if x is None: return` or `assert x is not None`.
- *"Argument 1 to 'f' has incompatible type 'list[X]'; expected 'Sequence[X]'"* — `Sequence` is read-only; usually means `f` should take `Iterable` or `Sequence` and the caller is passing the wrong thing.
- *"Returning Any from function declared to return X"* — likely an upstream `Any` leaked in; cast at the boundary or fix the upstream.
- *"Missing return statement"* — exhaustiveness gap; some control-flow path doesn't return.
- *"Unexpected keyword argument 'foo'"* — kwargs mismatch; check `**kwargs` consumers downstream.
- *"X has no attribute '__call__'"* — you're calling something that isn't callable; structural typing failure.

---

## One-paragraph summary

uv-managed venv, `hatchling` (or `maturin`) build backend, dynamic version from VCS tags, `requires-python = ">=3.12"`, native 3.12+ syntax with PEP 695 generics and `T | None`, type-check with mypy/pyright/ty in CI, ruff for lint and format with a focused rule set, pytest with `pytest-describe` and `asyncio_mode = "auto"`, dataclasses for internal data and Pydantic at boundaries, single flat exception hierarchy, lazy `__init__.py` for libraries with heavy optional deps, `putitoutthere` for cross-registry releases driven by `putitoutthere.toml` and a seven-line reusable workflow, CHANGELOG.md + MIGRATIONS.md updated on every consumer-observable change, mkdocs-material + mkdocstrings for docs, justfile for contributor commands with parallel lint/format/typecheck. CLIs ship as a Rust crate with TS and Python wrappers — `clap` parses, the crate runs, `bundle_cli` stages a per-platform binary into each wheel so `pip install` lands a working command on `PATH`. The qualities to reinforce are typed public surfaces, specific exception handling, non-blocking async, and reuse of stdlib facilities (paths via `pathlib`, retry via `tenacity`, schema via `pydantic`).

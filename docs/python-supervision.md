# Python Agent-Supervision Cheatsheet

*Synthesised from a multi-repo audit (skillet, GBNF-Python, dirsql-Python), 2026-05-13. Goal: recognise good Python when an agent writes it, and catch the patterns that signal cargo-cult rather than design.*

Source-of-truth weighting: **GBNF is the conservative reference** (smaller, less opinionated, fewer LLM-touched files). **skillet is the prescriptive reference** for libraries with strong intentional structure (one-callable-per-file, lazy init, async-disciplined). **dirsql is the foil** — most of its Python surface shows what to *avoid* (no type hints on public API, `Args:`/`Returns:` docstring drift, untyped `_async.py`).

---

## Toolchain (one-time)

```fish
curl -LsSf https://astral.sh/uv/install.sh | sh
# uv ships its own Python; no pyenv/asdf needed for basic use.
uv python install 3.12       # or 3.13 — 3.12 is the floor for this canon
```

**Never `pip`.** Not even `uv pip` (it's a compatibility shim; use `uv` proper). Not even `python -m pip`. The `uv add` / `uv sync` / `uv run` triad replaces it.

| Tool | Purpose |
|---|---|
| `uv` | Package manager, virtualenv, Python install |
| `ruff` | Lint + format (replaces flake8, isort, black) |
| `ty` (or `mypy`/`pyright`) | Type checker |
| `pytest` + `pytest-asyncio` + `pytest-describe` | Tests |
| `hatchling` + `hatch-vcs` | Build backend (for pure-Python) |
| `maturin` | Build backend (for PyO3-Rust extensions) |
| `just` | Task runner (replaces Makefile) |
| `bandit` | Security scanner |

## Commands you'll use

| Command | Purpose | When |
|---|---|---|
| `uv add <pkg>` | Add runtime dep | Avoid editing `pyproject.toml` by hand |
| `uv add --dev <pkg>` | Add dev dep | Tests, linters, etc. |
| `uv sync` | Install all deps in `.venv/` | Setup, after `git pull` |
| `uv run <cmd>` | Run in venv | Everything — `uv run pytest`, `uv run ruff` |
| `uv run pytest` | Run tests | Verifying |
| `uv run pytest -x -q` | Fail fast, quiet | Inner loop |
| `uv run ruff check .` | Lint | Pre-commit |
| `uv run ruff format .` | Format | Pre-commit |
| `uv run ty check <pkg>/` | Type-check | Pre-commit |
| `uv build` | Build wheel + sdist | Pre-publish |
| `uv publish --trusted-publishing always` | Publish to PyPI via OIDC | Release |

`uv run` is the right way to invoke anything that lives in the venv. Don't activate the venv manually; it sidesteps `uv`'s lockfile guarantees.

## Watch mode

```fish
uv run pytest-watcher .
# or, if just shelling:
uv run ptw --runner "uv run pytest -x -q"
```

skillet uses `pytest-watcher` (modern, asyncio-aware). There's no monolithic watcher like Rust's `bacon`; compose your own.

---

## Project shape

**Flat layout vs src layout** — both are valid; skillet uses flat, GBNF uses flat, the PEP 621 / packaging.python.org recommendation is src. The benefit of src-layout is that local imports can't accidentally use uninstalled code. The benefit of flat is one fewer level of nesting. **Pick one per project and stay consistent.**

Flat layout:

```
myproject/
  myproject/                 # the package
    __init__.py
    core.py
    core_test.py             # colocated unit test
    cli/
      __init__.py
      main.py
  tests/
    conftest.py
    integration/             # cross-module / fixture-heavy tests
    e2e/                     # end-to-end / CLI-invocation tests
  docs/
  scripts/
  pyproject.toml
  uv.lock
  justfile
  README.md
  CHANGELOG.md
  CONTRIBUTING.md
  RELEASING.md
  LICENSE
```

src-layout:

```
myproject/
  src/
    myproject/
      __init__.py
      core.py
  tests/
    test_core.py
  pyproject.toml
```

For PyO3 / maturin packages, the convention is **mixed**: Rust source in `src/`, Python source in `python/` (or wherever `tool.maturin.python-source` points), tests in `tests/`:

```
myproject/
  src/                       # Rust (PyO3) source
    lib.rs
  python/
    myproject/
      __init__.py            # re-exports from compiled _myproject
      _async.py
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

For libraries that ship optional heavy subsystems (numpy, DSPy, torch), use **PEP 562 lazy imports** to keep `import myproject` cheap:

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

skillet uses this. It's the canonical pattern for "the top-level import shouldn't pull torch".

**One-public-callable-per-file** is skillet's strongest convention. Each `.py` exports a single function/class named to match the filename (`get_rate_color.py` → `get_rate_color()`). Multi-callable files get promoted to subpackages with one file per callable. Exempt: `types.py`, `models.py`, `errors.py`, `__init__.py`, `conftest.py`, `dataclasses.py`. **This pattern is opinionated and not universally adopted** — GBNF doesn't enforce it. Worth adopting when the codebase has clear "one function = one unit of work" structure; not worth fighting if the agent's natural style is to group small related helpers.

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

- **Build backend**: `hatchling` for pure-Python, `maturin` for PyO3, `setuptools` only if you have a specific reason. Don't use `flit` for new libraries — hatchling is the de facto standard.
- **Dynamic version from VCS tags** (`hatch-vcs`). No hardcoded version, no `__version__ = "0.1.0"` to update. The wheel's version comes from `git describe`.
- **`requires-python = ">=3.12"`** — the floor that lets you use PEP 695 generics (`def f[T](x: T) -> T:`) and `int | None` union syntax everywhere without `from __future__ import annotations`.
- **`[project.optional-dependencies] dev = [...]`** — *or* `[dependency-groups] dev = [...]` (newer PEP 735 form, what uv prefers). Either works; the dep-groups form is newer.
- **`[project.scripts]`** for CLI entry points — not `console_scripts` (legacy).
- **`[project.urls]`** populated. PyPI shows these on the project page.
- **`asyncio_mode = "auto"`** — every test is automatically async-aware. No `@pytest.mark.asyncio` boilerplate. **skillet uses this; dirsql still decorates every test individually** — the dirsql way is noisier and not necessary.

**No `[tool.uv]` block** — uv is implicit via `uv.lock`. Don't add config you don't need.

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

**dataclass for internal data, Pydantic at boundaries.** skillet's clean separation:

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

**Don't litter `from typing import ...`** with every utility — `Literal`, `Final`, `ClassVar`, `Annotated` each have real uses; pulling them in when not used reads as cargo cult.

**Type checker**: `ty` (Astral, in alpha 2026) or `mypy` (mature, stable) or `pyright` (Microsoft, fast, used by Pylance). All three find different bugs. **Pick one and run it in CI.** skillet uses `ty`; that's a bet on Astral's velocity. For a library shipping to PyPI right now, mypy is the safest pick — `mypy --strict` finds the most footguns.

**No type hints on public API is a red flag.** dirsql's `python/dirsql/_async.py` is fully untyped — `def __init__(self, root, *, tables, ignore=None):`. The README documents types in prose. This is the failure mode to avoid.

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

Naming convention: **`foo.py` ↔ `foo_test.py` colocated**. This is skillet's enforced convention. The legacy `test_foo.py` prefix also works (pytest discovers both with `python_files = ["*_test.py", "test_*.py"]`).

**Why colocated**: the test file is right next to its subject. Move the source file, the test moves with it. No `tests/test_subpackage/test_module.py` ladder.

**`tests/` directory** holds integration tests, e2e tests, and shared fixtures. Unit tests live next to source.

**Async tests** — `asyncio_mode = "auto"` removes the `@pytest.mark.asyncio` decorator boilerplate:

```python
async def it_awaits_the_thing():
    result = await my_async_function()
    assert result == expected
```

dirsql decorates *every* test with `@pytest.mark.asyncio` even when the test isn't actually async — that's a smell. Set `asyncio_mode = "auto"` and drop the decorator.

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

skillet's `mock_claude_query` fixture is a good reference for "mock an external service that streams" — it exposes `set_response`, `set_structured_response`, `set_error`, `set_responses` so each test configures the mock declaratively. Worth replicating for any test that mocks a streaming LLM/network client.

**TDD orientation**: skillet's `.claude/CLAUDE.md` prescribes outside-in (E2E → integration → unit). That's a real choice; for most projects it's enough to keep unit + integration in equilibrium and write tests *before or with* the code, not after.

**Coverage** with `pytest-cov`, `branch=true`, `fail_under` set per project (85 is a reasonable floor). Don't enforce 100 — it forces you to test trivia.

---

## Async / sync discipline

**Default to sync.** Add async only where you have actual concurrent I/O.

When you do go async:

- **`asyncio` only.** Don't mix `anyio`/`trio` unless you specifically need their structured-concurrency model. If a dependency uses anyio internally (e.g., the Claude Agent SDK does), handle it where it crosses your boundary — don't propagate.
- **Bounded concurrency via `asyncio.Semaphore`**:

  ```python
  sem = asyncio.Semaphore(parallel)
  async def run_one(t):
      async with sem:
          return await do_thing(t)
  results = await asyncio.gather(*(run_one(t) for t in tasks))
  ```

- **Fully consume async generators** — don't `break` or `return` early without exhausting them. anyio's CancelScope errors under `asyncio.gather` come from this. skillet's `query_structured` defers exceptions:

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

  Worth knowing about; only relevant when you're aggregating multiple async iterators.

- **Sync-from-async** bridge — running a coroutine from sync code when there's already an event loop running. skillet uses a fresh `ThreadPoolExecutor`:

  ```python
  def run_sync(coro):
      try:
          loop = asyncio.get_running_loop()
      except RuntimeError:
          return asyncio.run(coro)
      with ThreadPoolExecutor(max_workers=1) as pool:
          return pool.submit(asyncio.run, coro).result()
  ```

- **Sync core, async wrapper** is the right architecture for libraries that wrap I/O. dirsql gets this right: the core is sync, each language adds its own async surface. Don't force async into a pure-computation library "in case".

**Async smells**:

- `async def f(): return value` with no `await` inside — the function isn't actually async; remove the `async`.
- `asyncio.run(thing())` in library code (not at the program entrypoint) — caller should drive the loop.
- `time.sleep` inside an async function — should be `await asyncio.sleep`.
- Blocking I/O (`open(...).read()`, `requests.get`) inside `async def` — wrap in `asyncio.to_thread`.

---

## CLI

**`cyclopts`** (skillet) for type-driven CLIs is the modern pick; `click` and `typer` are the mature alternatives. **`argparse`** is fine for small CLIs; pull in a framework only when you have multiple subcommands.

skillet's pattern with cyclopts:

```python
# myproject/cli/main.py
from typing import Annotated
from pathlib import Path
from cyclopts import App, Parameter

app = App(name="myproject", help="...")

@app.command
async def run(
    name: str,
    config: Annotated[Path | None, Parameter(name="config")] = None,
    *,
    parallel: Annotated[int, Parameter(name=["--parallel", "-p"])] = 3,
):
    """One-line description. Examples: ..."""
    from myproject.cli.commands.run import run_command  # lazy import — keeps `--help` fast
    await run_command(name, config=config, parallel=parallel)

def main() -> None:
    app()
```

Patterns worth keeping:

- **Lazy imports inside each command**. `--help` should not trigger an import of every subcommand's transitive dependencies.
- **Subcommands as separate files** under `cli/commands/<verb>/<verb>.py` with a `_command` suffix on the function. Keeps `cli/main.py` small.
- **Rich for output formatting** — `rich.console.Console` and `rich.live.Live` for streaming displays. Print directly only for one-line "did the thing" output.
- **`Annotated[T, Parameter(...)]`** rather than positional `cyclopts` decorators stacked.

**Testing CLIs**: use `curtaincall` or the framework's built-in `CliRunner` (click) / `CliApp.invoke` (cyclopts). For e2e, drive the actual binary in a subprocess with `subprocess.run` and assert against output. Don't unit-test the CLI shell — test the underlying functions, then a single happy-path e2e per command.

---

## Lint + format

**`ruff` for both.** Don't run `black` + `isort` + `flake8` separately — `ruff format` and `ruff check` cover all three, faster.

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

Don't blindly enable every rule group. The above is skillet's, and it's reasonable. `D` (pydocstyle) is annoying and rarely worth it.

**Per-file ignores for tests** (`PLR2004` magic numbers, `PLR0915` too-many-statements, `C901` too-complex are all OK in tests):

```toml
[tool.ruff.lint.per-file-ignores]
"*_test.py" = ["PLR2004", "PLR0915", "C901"]
"tests/**/*.py" = ["PLR2004", "PLR0915", "C901"]
```

**Type checker in CI** — `ty check myproject/` or `mypy myproject/` as a separate job. Don't let type errors land.

**Security**: `bandit` is fine to run in CI. Tell it to skip `B101` (assert-used) for tests. Scope the per-file `# nosec B603,B607` annotations rather than blanket-skipping subprocess rules globally.

**`docformatter`**: optional. If you maintain Google-style docstrings, it formats them; if not, skip.

---

## Public API design

**Docstrings**: short, *why*-oriented. **Skip `Args:` / `Returns:` / `Raises:` sections** — they're statically analysable from type hints and they rot. skillet's `.claude/CLAUDE.md` is explicit:

```python
def parse(content: str, *, strict: bool = False) -> Document:
    """Parse a document, raising on the first ambiguity if strict.

    The non-strict mode is forgiving for back-compat; new callers should set
    strict=True to surface schema drift early.
    """
```

When the type hints carry the structure, the prose carries the rationale.

**Don't ship `pydoc`-generated API reference.** Use `sphinx` + `sphinx-autodoc` or `mkdocs-material` + `mkdocstrings`. Both read docstrings and emit HTML. For new projects, `mkdocs-material` + `mkdocstrings` is the lower-friction pick.

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

Don't reuse one exception for unrelated failure modes. dirsql's `DirSqlError::Lock(String)` is overloaded for `PoisonError`, init failure, and "ready not called" — three different conditions in one variant is a smell.

**Class-with-`__call__` vs function**: prefer a function for one-shot behaviour; a class for stateful workflows. Functional pipelines (`process(data).then(...).then(...)`) read poorly in Python; just use intermediate variables.

**Don't shadow built-ins** (`type`, `id`, `list`, `dict`, `input`, `format`). Especially `type` and `id` — common LLM-introduced bugs.

---

## Configuration

**Minimal.** A library should take a config object (or kwargs) at instantiation. Settings systems (`pydantic-settings`, `dynaconf`) belong in apps, not libraries.

For application-level config, skillet's minimum:

```python
# myproject/config.py
import os
from pathlib import Path

PROJECT_DIR = Path(os.environ.get("MYPROJECT_DIR", str(Path.home() / ".myproject")))
CACHE_DIR = PROJECT_DIR / "cache"
```

If you reach for `pydantic-settings`, you're past minimum. That's fine; just verify the project needs typed env-var loading with validation, not just `os.environ.get`.

**Don't commit `.env`.** If a `.env.example` is useful, ship that and `.gitignore` the real `.env`. (skillet has a `.env` at the root that doesn't appear to be loaded by code — typical LLM-leftover.)

---

## Repo orchestration

**`justfile`** for contributor commands. `Makefile` is fine if your team prefers it; `just` is friendlier on modern macOS/Windows and lives in dev-deps as `rust-just`.

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

skillet's `ci` recipe runs lint/format-check/typecheck *in parallel* before tests. That's a meaningful speedup; copy it.

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
| `changelog.yml` | Fail PR if `CHANGELOG.md` not touched (skip-label respected) |
| `publish.yml` | OIDC publish to PyPI on tag |

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

**Matrix sparingly.** Python 3.12 + 3.13 is enough; cross-OS only if you have native code or filesystem-specific behaviour. skillet matrices only on Python version, Ubuntu only; dirsql matrices on OS for wheel builds but only Ubuntu for tests.

**Concurrency cancel previous runs**:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

---

## Release flow

**Trusted publishing (OIDC).** No API tokens.

```yaml
# .github/workflows/publish.yml
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: write
    steps:
      - uses: actions/checkout@v6
      - uses: astral-sh/setup-uv@v7
      - run: uv build
      - name: Publish to PyPI
        run: |
          for i in 1 2 3; do
            uv publish --trusted-publishing always --check-url https://pypi.org/simple/ && exit 0
            sleep 15
          done
          exit 1
      - name: Rollback tag on failure
        if: failure() && steps.tag.outputs.created == 'true'
        run: git push --delete origin "v${{ steps.version.outputs.new_version }}"
```

skillet's pattern:

- **Version from VCS tags** via `hatch-vcs`.
- **Dual release strategies**: nightly cron *or* immediate on push, controlled by a repo variable. `[no-release]` commit override skips a release.
- **Retry-with-backoff** on `uv publish`.
- **Rollback the tag** if publish fails — important; otherwise re-running creates a duplicate tag.
- **CHANGELOG.md** in Keep-a-Changelog format, with `[Unreleased]` section. The `changelog.yml` workflow enforces that every PR touches it (or has a `skip-changelog` label).

For PyO3 / native packages, matrix the wheel build across `ubuntu-latest`, `macos-latest` (Intel + ARM), `windows-latest`. Use `PyO3/maturin-action`. The actual `publish` step still uses `uv publish` (or `maturin upload`).

**Don't nightly-publish on every README touch.** dirsql's release workflow triggers `publish_pypi=true` on `docs_changed=true` — this means a doc PR can ship a wheel. Scope the trigger to *code* changes; doc changes ship docs, not packages.

---

## Code smells / red flags in agent output

### Critical (almost always wrong)

| Smell | Why it's bad | What to ask |
|---|---|---|
| Public function with no type hints | The public API is the contract | "What are the types?" |
| `except Exception:` with no re-raise / no logging | Swallows errors silently | "What errors do we actually expect?" |
| `except: pass` (bare except) | Catches `KeyboardInterrupt`, `SystemExit` too | Same |
| `from foo import *` in non-`__init__.py` | Pollutes the namespace | "Which names do you need?" |
| `os.system(...)` / `os.popen(...)` | Shell injection prone, deprecated | "Use `subprocess.run([...], shell=False)`" |
| `eval(...)` / `exec(...)` on data | Code injection | "What's the actual structure? Use `json.loads` / `ast.literal_eval`" |
| `pickle.load(...)` of untrusted data | Arbitrary code execution | "Where is the data from?" |
| `time.sleep(n)` in `async def` | Blocks the event loop | "Should be `await asyncio.sleep(n)`" |
| `requests.get(...)` in `async def` | Blocks the event loop | "Use `aiohttp` / `httpx.AsyncClient`" |
| Mutable default arg (`def f(items=[]):`) | Shared across calls | "Use `items: list[T] | None = None`; default inside" |

### Style smells (often wrong)

| Smell | Why it's bad |
|---|---|
| `from typing import List, Dict, Tuple, Optional` | Use built-in `list`, `dict`, `tuple`, `T \| None` (3.9+/3.10+) |
| `if x == None:` | Use `if x is None:` |
| `if x == True:` / `if x == False:` | Use `if x:` / `if not x:` |
| `len(x) == 0` | Use `not x` |
| `lambda x: x.attr` repeatedly | `operator.attrgetter("attr")` is faster and clearer |
| `for i in range(len(items)):` | `for i, item in enumerate(items):` |
| `dict.keys()` in `for k in d.keys():` | Just `for k in d:` |
| `dict.get(k, None)` | Default is already `None`; just `dict.get(k)` |
| `os.path.join`, `os.path.exists` | Use `pathlib.Path`. (`PTH` ruff rule catches this.) |
| `open(path, "r").read()` | Doesn't close file; use `Path(path).read_text()` or `with open(...)` |
| `.format(...)` / `%`-format | Use f-strings |
| `Args:`/`Returns:`/`Raises:` sections in docstrings | Static analysers cover this; write *why*, not *what* |
| `assert isinstance(x, T)` for type-narrowing in non-test code | The assertion vanishes under `-O`; use a real check |
| `try/except/pass` on a specific exception with no comment | What was it hiding? Either re-raise or document |
| `from x.y.z.a.b.c import thing` (6+ levels) | Likely a layout problem; surface modules expose imports |
| `Optional[X]` (typing module) | Use `X \| None` |
| Bare `int`/`str` field named "id" / "type" | Shadows built-ins. Use `id_`, `type_`, or rename the field. |
| Empty `tests/e2e/` directory referenced by `justfile` | Stale recipe. (dirsql does this.) |
| Three-argument `super().__init__()` that's actually two-argument | Trying to look Python-2-compatible |
| `class Foo(object):` | The `(object)` is a Python 2 holdover |
| `__init__.py` with re-exports but no `__all__` | Unclear public API surface |

### Subtle smells

- **`from __future__ import annotations`** on a 3.12+ project — only needed if you intentionally want PEP 563-style lazy evaluation. Otherwise it's noise.
- **`Any` everywhere** — same critique as TypeScript's `any`. Use `object` or narrow types.
- **`TypeVar` instead of PEP 695 generics on 3.12+** — old syntax, works, but isn't idiomatic.
- **`cast(T, x)`** without a comment — what's the unverified assumption?
- **`@dataclass(frozen=True)`** missing `slots=True` — `slots=True` is a cheap memory win and catches typos on field assignment.
- **`__init__.py` that imports its whole subtree eagerly** for a library with heavy deps — should use PEP 562 lazy imports.
- **`Args:`/`Returns:` sections with `Raises:` that's lying** — common LLM drift; the function actually raises something else.
- **Comments above the function that re-state what the function does** — agent's interpretation of "good documentation".
- **Per-function docstrings that begin "This function..."** — start with the verb: "Parse a document and ..."
- **Plain `os.environ["FOO"]`** without a default and without surface-level docs — implicit required env var.

---

## PyO3 bindings (cross-language)

When the Python package wraps a Rust crate via PyO3 + maturin:

- **The binding wraps the Rust *SDK***, not the Rust core directly. If you find yourself reimplementing scanner-loops, watcher-loops, or domain logic in the PyO3 binding, you've drifted. dirsql's PyO3 binding (858 lines) reimplements orchestration that already exists in `dirsql-sdk` — that's exactly the anti-pattern to avoid.
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

  This is from dirsql's PyO3 binding and worth keeping — the `bool`-before-`int` ordering matters for Python's subtype rules.

- **Don't downgrade structured errors to `PyRuntimeError::new_err(format!("{}", e))`** at the boundary. Map Rust error variants to specific Python exception types. dirsql throws all errors away as strings — Python consumers see generic `RuntimeError`. The right pattern:

  ```rust
  match err {
      DbError::SchemaMismatch(msg) => SchemaMismatchError::new_err(msg),
      DbError::NotFound(name) => NotFoundError::new_err(format!("not found: {name}")),
      _ => PyRuntimeError::new_err(err.to_string()),
  }
  ```

- **Ship typed stubs** if the public API is non-trivial. Either inline `.pyi` files or maturin-generated stubs. dirsql ships no `.pyi`.
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
| CLI args | `cyclopts` / `click` / `typer` |
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
| Versioning | `hatch-vcs` (VCS-derived) |
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
2. **Type hints on public API** — every public function/method has hints; no `Any` without justification.
3. **Exception handling** — every `except` either re-raises, logs, or has a one-line comment explaining the conversion to data.
4. **Async correctness** — no `time.sleep` / blocking I/O in `async def`; `gather` over bounded `Semaphore`.
5. **Docstrings** — present on public surface; *why*-oriented; no `Args:`/`Returns:` sections.
6. **Tests** — colocated `*_test.py` or in `tests/`; pytest-describe structure; fixtures over inline `with patch(...)`.
7. **`pyproject.toml` changes** — new deps reputable (see ecosystem table)? In the right group (`dev` vs runtime)?
8. **Reinvention** — did the agent rebuild something stdlib or popular-package provides? (date parsing, retry-with-backoff, schema validation, CLI args.)
9. **`__init__.py`** — explicit `__all__`; doesn't eagerly import heavy deps if PEP 562 lazy is in play.
10. **No `from __future__ import annotations`** on a 3.12+ project unless deliberate.

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

## Notes on what *not* to copy

These are recurring patterns from the audit repos that look reasonable on first read but don't survive scrutiny:

- **Untyped public API** with type info in prose (dirsql `_async.py`). Hints are the contract.
- **`Args:`/`Returns:`/`Raises:` sections** in docstrings, especially when they drift from the actual signature (dirsql, parts of skillet).
- **`@pytest.mark.asyncio` on every test** when `asyncio_mode = "auto"` would remove the decorator (dirsql).
- **Empty `tests/e2e/` directory referenced from `justfile`** (dirsql). Either build it or remove the recipe.
- **`AGENTS.md` duplicating user-global Claude config** verbatim (dirsql 227-line AGENTS.md, ~70% duplicate of `~/.claude/CLAUDE.md`). Subdir-scoped agent docs should be subdir-specific.
- **Three-layer `python/dirsql/_dirsql.cpython-*.so`** orphan files committed to the repo (dirsql). `.gitignore` should catch built extensions.
- **`SUMMARY.md` from a scoping conversation** still present months after scope was resolved (dirsql).
- **README marketing block-quotes** in the "Why" section (skillet). Functional but generic.
- **Empty subpackages** like `skillet/gaps/` (only `__pycache__/`). Dead module from removed feature.
- **`.coverage` SQLite file committed** to git (skillet). Should be gitignored.
- **`__pycache__/` directories committed**. `.gitignore` is too narrow or stale.
- **README install instructions saying `pip install`** for a project that internally forbids pip (skillet). Either document `uv add` alongside, or accept that PyPI consumers will use pip.
- **`# noqa: PLR0913` on real functions** that take 10 args (skillet `eval`, `evaluate`). Either the threshold is right (and the function is doing too much), or the threshold is wrong. Pick one.
- **Architectural principle in `ARCHITECTURE.md` that the code contradicts** (dirsql: "never reimplement core logic in a binding" — three bindings reimplement core logic). The doc is aspirational, not descriptive. Either fix the code or update the doc.

---

## One-paragraph summary

uv-managed venv, `hatchling` (or `maturin`) build backend, dynamic version from VCS tags, `requires-python = ">=3.12"`, native 3.12+ syntax with PEP 695 generics and `T | None`, type-check with mypy/pyright/ty in CI, ruff for lint and format with a focused rule set, pytest with `pytest-describe` and `asyncio_mode = "auto"`, dataclasses for internal data and Pydantic at boundaries, single flat exception hierarchy, lazy `__init__.py` for libraries with heavy optional deps, OIDC publish to PyPI with retry-and-rollback, mkdocs-material + mkdocstrings for docs, justfile for contributor commands with parallel lint/format/typecheck. The dominant red flags are untyped public APIs, `Args:` docstring drift, blocking I/O in `async def`, swallowed `Exception`, and reimplementation of stdlib facilities (path joins, retry loops, deep-clone). When an agent reaches for `from __future__ import annotations`, `Optional`/`List`/`Dict`, or `@pytest.mark.asyncio` on every test, ask whether the project's Python floor lets them go without.

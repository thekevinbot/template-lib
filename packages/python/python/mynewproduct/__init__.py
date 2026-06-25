"""mynewproduct — idiomatic Python SDK over a shared Rust core.

Re-export barrel. The SDK itself is the compiled PyO3 binding (`._mynewproduct`); this module
just gives it a stable public name. No logic lives here.
"""

from ._mynewproduct import Counter, Entry, WordCountError, __version__, run_cli

__all__ = ["Counter", "Entry", "WordCountError", "run_cli", "__version__"]

"""Thin shim: replaces the current process with the `darkfactory` Rust binary."""

from __future__ import annotations

import os
import shutil
import sys

_BIN = "darkfactory"


def _main() -> None:
    target = os.environ.get("DARKFACTORY_BIN") or shutil.which(_BIN)
    if not target:
        sys.exit(
            f"`{_BIN}` not on PATH. Install with `cargo install darkfactory` "
            "or set DARKFACTORY_BIN."
        )
    os.execv(target, [target, *sys.argv[1:]])

"""Python SDK for darkfactory. Shells out to the Rust binary."""

from __future__ import annotations

import os
import shutil
import subprocess

DEFAULT_BIN = "darkfactory"


def _resolve_bin() -> str:
    override = os.environ.get("DARKFACTORY_BIN")
    if override:
        return override
    found = shutil.which(DEFAULT_BIN)
    if not found:
        raise FileNotFoundError(
            f"`{DEFAULT_BIN}` not on PATH. Install with `cargo install darkfactory`, "
            "or set DARKFACTORY_BIN to the absolute binary path."
        )
    return found


def run(args: list[str]) -> subprocess.CompletedProcess[str]:
    """Run darkfactory with the given args. Returns CompletedProcess."""
    return subprocess.run(
        [_resolve_bin(), *args],
        capture_output=True,
        text=True,
        check=False,
    )


__all__ = ["run"]

"""Console-script entry point — forwards argv into the one Rust CLI implementation."""

import sys

from ._mynewproduct import run_cli


def main() -> int:
    return run_cli(sys.argv[1:])


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env bash
# Guard: committed code must never auto-fetch-and-run a package from outside the
# pinned manifest.
#
# This is the failure we actually hit: `npx --yes stryker run` silently
# downloaded a DEPRECATED legacy `stryker` (renamed to @stryker-mutator/core
# years ago) because the bare name still resolves on the registry -- then ran
# it. The fix is to never resolve on the fly: declare the tool in the manifest
# and run it through a lockfile-pinned path (`pnpm exec` / `npx --no-install`,
# or `uv run`), which runs only what's installed, or fails loudly.
#
# Banned (fetch-and-run an undeclared tool):
#   npx <pkg>  (unless --no-install/--offline)   pnpm dlx / yarn dlx / pnpx
#   npm exec / npm x                             uvx <tool> / pipx run
# Allowed: npx --no-install, pnpm exec, plain `pip install` / `cargo build`.
#
# A line carrying the marker `deps-guard:ignore` is skipped (explicit, reviewable
# escape hatch). Scans committed source + automation (not markdown, not
# node_modules, not this script). Catches the shell-string form AND the
# spawn-array form (['npx','--yes',...]) by flagging any npx not pinned to
# --no-install.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

mapfile -t files < <(
  git ls-files \
    | grep -Ev '(^|/)node_modules/' \
    | grep -E '\.(ts|tsx|js|mjs|cjs|py|rs|sh|ya?ml)$|(^|/)justfile$|(^|/)package\.json$' \
    | grep -vx 'scripts/check-no-auto-install.sh' \
    | while IFS= read -r f; do [ -e "$f" ] && printf '%s\n' "$f"; done
)
[ "${#files[@]}" -eq 0 ] && { echo "ok: nothing to scan"; exit 0; }

skip='deps-guard:ignore'
# Tools that always fetch-and-run something undeclared.
always='(\bpnpm[[:space:]]+dlx\b|\byarn[[:space:]]+dlx\b|\bpnpx\b|\bnpm[[:space:]]+exec\b|\bnpm[[:space:]]+x[[:space:]]|\buvx[[:space:]]+[^-[:space:]]|\bpipx[[:space:]]+run\b)'

hits=""
a=$(grep -nHE "$always" "${files[@]}" | grep -vF "$skip" || true)
[ -n "$a" ] && hits+="$a"$'\n'
# Any npx not pinned to --no-install; ignore the `.cmd`/`.exe` shim names that
# show up in comments.
b=$(grep -nHE '\bnpx\b' "${files[@]}" \
      | grep -vE 'npx\.(cmd|exe)' \
      | grep -vE -- '--no-install|--offline|--prefer-offline' \
      | grep -vF "$skip" || true)
[ -n "$b" ] && hits+="$b"$'\n'

if [ -n "${hits//[$'\n']/}" ]; then
  echo "::error::Auto-fetch-and-run of an out-of-manifest package found. Declare the"
  echo "tool in the manifest and run it with 'pnpm exec' / 'npx --no-install'."
  printf '%s' "$hits" | sed '/^$/d; s/^/    /'
  exit 1
fi
echo "ok: no auto-fetch-and-run invocations in committed code"

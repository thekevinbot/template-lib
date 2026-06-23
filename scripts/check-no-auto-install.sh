#!/usr/bin/env bash
# Guard: committed automation must never auto-fetch a package from outside the
# pinned manifest.
#
# Auto-fetchers (`pnpm dlx`, `yarn dlx`, `pnpx`, `npm exec`, and `npx` without
# `--no-install`) download whatever the registry currently serves for a bare
# name. That is exactly how a renamed/abandoned package silently slips in and
# runs — e.g. a legacy `0.x` left behind after a scoped rename. The pinned way
# to run a tool is `pnpm exec` or `npx --no-install`, which only execute a
# binary already installed from the lockfile.
#
# This is a deliberately precise grep: it flags the unambiguous auto-fetch forms
# and shell-style `npx <pkg>`, while leaving `npx --no-install` and `pnpm exec`
# alone. Markdown docs and node_modules are not scanned; neither is this script.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

mapfile -t files < <(
  git ls-files \
    | grep -Ev '(^|/)node_modules/' \
    | grep -E '\.(sh|mjs|cjs|js|ya?ml)$|(^|/)justfile$|(^|/)package\.json$' \
    | grep -vx 'scripts/check-no-auto-install.sh'
)

# pnpm dlx | yarn dlx | pnpx | npm exec | npm x <a> | npx --yes/-y | npx <pkg>
banned='(\bpnpm[[:space:]]+dlx\b|\byarn[[:space:]]+dlx\b|\bpnpx\b|\bnpm[[:space:]]+exec\b|\bnpm[[:space:]]+x[[:space:]]|\bnpx[[:space:]]+(--yes|-y)\b|\bnpx[[:space:]]+[^-[:space:]])'

if [ "${#files[@]}" -gt 0 ] && hits=$(grep -nHE "$banned" "${files[@]}"); then
  echo "::error::Auto-fetching package install found. Pin the tool in a manifest"
  echo "and run it with 'pnpm exec' or 'npx --no-install'. Offending lines:"
  printf '%s\n' "$hits" | sed 's/^/    /'
  exit 1
fi

echo "ok: no auto-fetching install invocations in committed automation"

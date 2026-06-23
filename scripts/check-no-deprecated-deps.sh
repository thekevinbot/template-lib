#!/usr/bin/env bash
# Guard: no pnpm project may resolve a deprecated package that is not explicitly
# allow-listed under "pnpm.allowedDeprecatedVersions" in its package.json.
#
# Neither npm nor pnpm has a native "fail on deprecated dependency" flag, so we
# resolve each project in a throwaway directory (lockfile-only — no node_modules)
# and treat any surviving "deprecated" warning as a violation. pnpm's
# allowedDeprecatedVersions mutes reviewed exceptions, so a clean resolve means
# "nothing deprecated got installed that a human didn't sign off on".
#
# Resolving touches the registry, so this needs network. The throwaway dir keeps
# the working tree clean (no lockfile/node_modules are written into the repo).
set -euo pipefail
repo_root="$(git rev-parse --show-toplevel)"

mapfile -t manifests < <(
  git -C "$repo_root" ls-files \
    | grep -E '(^|/)package\.json$' \
    | grep -Ev '(^|/)node_modules/'
)

status=0
for manifest in "${manifests[@]}"; do
  dir="$repo_root/$(dirname "$manifest")"
  work="$(mktemp -d)"
  cp "$dir/package.json" "$work/package.json"
  [ -f "$dir/pnpm-lock.yaml" ] && cp "$dir/pnpm-lock.yaml" "$work/pnpm-lock.yaml"
  [ -f "$dir/.npmrc" ] && cp "$dir/.npmrc" "$work/.npmrc"

  log="$work/resolve.log"
  if ! pnpm --dir "$work" install --lockfile-only --no-frozen-lockfile >"$log" 2>&1; then
    echo "::error::pnpm failed to resolve $manifest"
    sed 's/^/    /' "$log"
    status=1
    rm -rf "$work"
    continue
  fi

  if grep -iq 'deprecated' "$log"; then
    echo "::error::$manifest resolves deprecated package(s) not allow-listed in pnpm.allowedDeprecatedVersions:"
    grep -i 'deprecated' "$log" | sed 's/^/    /'
    status=1
  else
    echo "ok: $manifest — no deprecated packages"
  fi
  rm -rf "$work"
done

exit "$status"

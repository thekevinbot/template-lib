import { spawnSync } from 'node:child_process';

const DEFAULT_BIN = 'darkfactory';

function resolveBin() {
  return process.env.DARKFACTORY_BIN ?? DEFAULT_BIN;
}

export function run(args) {
  const result = spawnSync(resolveBin(), args, { encoding: 'utf8' });
  if (result.error) {
    throw new Error(
      `failed to spawn darkfactory binary: ${result.error.message}. ` +
        'install via `cargo install darkfactory` or set DARKFACTORY_BIN.',
    );
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

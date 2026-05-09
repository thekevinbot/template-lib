import { spawnSync, type SpawnSyncReturns } from 'node:child_process';

const DEFAULT_BIN = 'darkfactory';

function resolveBin(): string {
  return process.env['DARKFACTORY_BIN'] ?? DEFAULT_BIN;
}

export interface RunResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export function run(args: readonly string[]): RunResult {
  const result: SpawnSyncReturns<string> = spawnSync(resolveBin(), args, {
    encoding: 'utf8',
  });
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

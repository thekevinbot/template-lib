import { defaultSpawner } from '../defaults/spawner.js';
import { defaultStderr } from '../defaults/stderr.js';
import { resolveBinary } from '../resolve/binary.js';
import type { MainOpts } from '../types.js';

export function main(
  argv: readonly string[] = process.argv.slice(2),
  opts: MainOpts = {},
): number {
  const resolveBin = opts.resolveBin ?? (() => resolveBinary());
  const spawn = opts.spawn ?? defaultSpawner;
  const writeErr = opts.stderr ?? defaultStderr;

  let binPath: string;
  try {
    binPath = resolveBin();
  } catch (err) {
    writeErr(`${(err as Error).message}\n`);
    return 1;
  }
  const result = spawn(binPath, argv);
  if (result.error) throw result.error;
  return result.status ?? 1;
}

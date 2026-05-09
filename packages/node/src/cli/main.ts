import { defaultSpawner } from '../defaults/spawner.js';
import { defaultStderr } from '../defaults/stderr.js';
import { resolveBinary } from '../resolve/binary.js';
import type { MainOpts } from '../types.js';

export async function main(
  argv: readonly string[] = process.argv.slice(2),
  opts: MainOpts = {},
): Promise<number> {
  const resolveBin = opts.resolveBin ?? resolveBinary;
  const spawn = opts.spawn ?? defaultSpawner;
  const writeErr = opts.stderr ?? defaultStderr;

  try {
    return await spawn(resolveBin(), argv);
  } catch (err) {
    writeErr(`${(err as Error).message}\n`);
    return 1;
  }
}

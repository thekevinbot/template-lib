import { defaultSpawner } from '../defaults.js';
import { resolveBinary } from '../resolve/binary.js';
import type { MainOpts } from '../types.js';

export async function main(
  argv: readonly string[] = process.argv.slice(2),
  {
    resolveBin = resolveBinary,
    spawn = defaultSpawner,
  }: MainOpts = {},
): Promise<number> {
  return spawn(resolveBin(), argv);
}

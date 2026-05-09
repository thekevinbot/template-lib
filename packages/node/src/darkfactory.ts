import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { createRequire } from 'node:module';

export type Resolver = (id: string) => string;
export type Spawner = (
  cmd: string,
  args: readonly string[],
) => SpawnSyncReturns<Buffer>;
export type ErrorWriter = (msg: string) => void;

export const defaultResolver = (): Resolver =>
  createRequire(import.meta.url).resolve;

export const defaultSpawner: Spawner = (cmd, args) =>
  spawnSync(cmd, [...args], { stdio: 'inherit' });

export const defaultStderr: ErrorWriter = (msg) => {
  process.stderr.write(msg);
};

export interface ResolveOpts {
  platform?: NodeJS.Platform;
  arch?: string;
  env?: NodeJS.ProcessEnv;
  resolver?: Resolver;
}

export function resolveBinary(opts: ResolveOpts = {}): string {
  const platform = opts.platform ?? process.platform;
  const arch = opts.arch ?? process.arch;
  const env = opts.env ?? process.env;
  const resolver = opts.resolver ?? defaultResolver();
  const ext = platform === 'win32' ? '.exe' : '';
  const platformPkg = `@darkfactory/${platform}-${arch}`;
  try {
    return resolver(`${platformPkg}/bin/darkfactory${ext}`);
  } catch {
    if (env.DARKFACTORY_BIN) return env.DARKFACTORY_BIN;
    throw new Error(
      `darkfactory: no prebuilt binary for ${platform}-${arch}. ` +
        `expected optional dependency ${platformPkg} to provide one. ` +
        'fix: rerun `npm install darkfactory`, set DARKFACTORY_BIN=/abs/path, ' +
        'or run `cargo install darkfactory`.',
    );
  }
}

export interface MainOpts {
  resolveBin?: () => string;
  spawn?: Spawner;
  stderr?: ErrorWriter;
}

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

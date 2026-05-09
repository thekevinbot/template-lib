import type { SpawnSyncReturns } from 'node:child_process';

export type Resolver = (id: string) => string;

export type Spawner = (
  cmd: string,
  args: readonly string[],
) => SpawnSyncReturns<Buffer>;

export type ErrorWriter = (msg: string) => void;

export interface ResolveOpts {
  platform?: NodeJS.Platform;
  arch?: string;
  env?: NodeJS.ProcessEnv;
  resolver?: Resolver;
}

export interface MainOpts {
  resolveBin?: () => string;
  spawn?: Spawner;
  stderr?: ErrorWriter;
}

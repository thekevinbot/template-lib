export type Resolver = (id: string) => string;

export type Spawner = (
  cmd: string,
  args: readonly string[],
) => Promise<number>;

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

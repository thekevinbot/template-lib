export type Resolver = (id: string) => string;

export type Spawner = (
  cmd: string,
  args: readonly string[],
) => Promise<number>;

export interface ResolveOpts {
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
  resolver?: Resolver;
}

export interface MainOpts {
  resolveBin?: () => string;
  spawn?: Spawner;
}

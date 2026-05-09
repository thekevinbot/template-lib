import { describe, it, expect, vi } from 'vitest';
import type { SpawnSyncReturns } from 'node:child_process';
import {
  resolveBinary,
  main,
  defaultResolver,
  defaultSpawner,
  defaultStderr,
} from '../src/darkfactory.js';

const ok = (status: number | null = 0): SpawnSyncReturns<Buffer> =>
  ({
    pid: 1,
    output: [],
    stdout: Buffer.alloc(0),
    stderr: Buffer.alloc(0),
    status,
    signal: null,
  }) as SpawnSyncReturns<Buffer>;

describe('resolveBinary', () => {
  it('resolves the per-platform optional dep on linux/x64', () => {
    const resolver = vi.fn((id: string) => `/abs/${id}`);
    const path = resolveBinary({
      platform: 'linux',
      arch: 'x64',
      env: {},
      resolver,
    });
    expect(resolver).toHaveBeenCalledWith(
      '@darkfactory/linux-x64/bin/darkfactory',
    );
    expect(path).toBe('/abs/@darkfactory/linux-x64/bin/darkfactory');
  });

  it('appends .exe on win32', () => {
    const resolver = vi.fn((id: string) => `/abs/${id}`);
    resolveBinary({ platform: 'win32', arch: 'x64', env: {}, resolver });
    expect(resolver).toHaveBeenCalledWith(
      '@darkfactory/win32-x64/bin/darkfactory.exe',
    );
  });

  it('falls back to DARKFACTORY_BIN when resolver throws', () => {
    const resolver = vi.fn(() => {
      throw new Error('not found');
    });
    const path = resolveBinary({
      platform: 'linux',
      arch: 'x64',
      env: { DARKFACTORY_BIN: '/custom/bin' },
      resolver,
    });
    expect(path).toBe('/custom/bin');
  });

  it('throws when neither optional dep nor env present', () => {
    const resolver = vi.fn(() => {
      throw new Error('not found');
    });
    expect(() =>
      resolveBinary({ platform: 'linux', arch: 'arm64', env: {}, resolver }),
    ).toThrow(/no prebuilt binary for linux-arm64/);
  });

  it('uses process.platform/arch/env defaults when called bare', () => {
    expect(() => resolveBinary()).toThrow(/no prebuilt binary/);
  });
});

describe('main', () => {
  it('spawns the resolved binary with argv and propagates exit code', () => {
    const resolveBin = vi.fn(() => '/abs/darkfactory');
    const spawn = vi.fn(() => ok(0));
    const code = main(['--help'], { resolveBin, spawn });
    expect(spawn).toHaveBeenCalledWith('/abs/darkfactory', ['--help']);
    expect(code).toBe(0);
  });

  it('returns 1 and writes the message when resolveBin throws', () => {
    const resolveBin = vi.fn(() => {
      throw new Error('boom');
    });
    const stderr = vi.fn();
    const spawn = vi.fn();
    const code = main([], { resolveBin, spawn, stderr });
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith('boom\n');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('rethrows when spawn returns an error', () => {
    const resolveBin = vi.fn(() => '/abs/darkfactory');
    const err = new Error('ENOENT');
    const spawn = vi.fn(() => ({ ...ok(null), error: err }));
    expect(() => main([], { resolveBin, spawn })).toThrow(err);
  });

  it('returns 1 when spawn status is null', () => {
    const resolveBin = vi.fn(() => '/abs/darkfactory');
    const spawn = vi.fn(() => ok(null));
    expect(main([], { resolveBin, spawn })).toBe(1);
  });

  it('propagates non-zero exit codes', () => {
    const resolveBin = vi.fn(() => '/abs/darkfactory');
    const spawn = vi.fn(() => ok(2));
    expect(main(['bad-arg'], { resolveBin, spawn })).toBe(2);
  });

  it('uses default resolveBin when none supplied', () => {
    const spawn = vi.fn(() => ok(0));
    const stderr = vi.fn();
    const code = main([], { spawn, stderr });
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalled();
  });

  it('uses default argv when none supplied', () => {
    const resolveBin = vi.fn(() => '/abs/darkfactory');
    const spawn = vi.fn(() => ok(0));
    expect(main(undefined, { resolveBin, spawn })).toBe(0);
  });
});

describe('defaults', () => {
  it('defaultResolver returns a function that resolves Node built-ins', () => {
    const r = defaultResolver();
    expect(typeof r('node:fs')).toBe('string');
  });

  it('defaultSpawner runs a real command and returns its status', () => {
    const result = defaultSpawner(process.execPath, ['-e', 'process.exit(0)']);
    expect(result.status).toBe(0);
  });

  it('defaultStderr writes to process.stderr', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    defaultStderr('hello');
    expect(spy).toHaveBeenCalledWith('hello');
    spy.mockRestore();
  });
});

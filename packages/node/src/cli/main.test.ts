import { describe, it, expect, vi } from 'vitest';
import type { SpawnSyncReturns } from 'node:child_process';
import { main } from './main.js';

const ok = (status: number | null = 0): SpawnSyncReturns<Buffer> =>
  ({
    pid: 1,
    output: [],
    stdout: Buffer.alloc(0),
    stderr: Buffer.alloc(0),
    status,
    signal: null,
  }) as SpawnSyncReturns<Buffer>;

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

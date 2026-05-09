import { describe, it, expect, vi } from 'vitest';
import { main } from './main.js';

describe('main', () => {
  it('spawns the resolved binary with argv and propagates exit code', async () => {
    const resolveBin = vi.fn(() => '/abs/darkfactory');
    const spawn = vi.fn(async () => 0);
    const code = await main(['--help'], { resolveBin, spawn });
    expect(spawn).toHaveBeenCalledWith('/abs/darkfactory', ['--help']);
    expect(code).toBe(0);
  });

  it('returns 1 and writes the message when resolveBin throws', async () => {
    const resolveBin = vi.fn(() => {
      throw new Error('boom');
    });
    const stderr = vi.fn();
    const spawn = vi.fn();
    const code = await main([], { resolveBin, spawn, stderr });
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith('boom\n');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('returns 1 and writes the message when spawn rejects', async () => {
    const resolveBin = vi.fn(() => '/abs/darkfactory');
    const spawn = vi.fn(async () => {
      throw new Error('ENOENT');
    });
    const stderr = vi.fn();
    const code = await main([], { resolveBin, spawn, stderr });
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith('ENOENT\n');
  });

  it('propagates non-zero exit codes', async () => {
    const resolveBin = vi.fn(() => '/abs/darkfactory');
    const spawn = vi.fn(async () => 2);
    expect(await main(['bad-arg'], { resolveBin, spawn })).toBe(2);
  });

  it('uses default resolveBin when none supplied', async () => {
    const spawn = vi.fn(async () => 0);
    const stderr = vi.fn();
    const code = await main([], { spawn, stderr });
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalled();
  });

  it('uses default argv when none supplied', async () => {
    const resolveBin = vi.fn(() => '/abs/darkfactory');
    const spawn = vi.fn(async () => 0);
    expect(await main(undefined, { resolveBin, spawn })).toBe(0);
  });

  it('uses default spawn when none supplied', async () => {
    const resolveBin = vi.fn(() => process.execPath);
    const code = await main(['-e', 'process.exit(0)'], { resolveBin });
    expect(code).toBe(0);
  });
});

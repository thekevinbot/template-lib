import { describe, it, expect, vi } from 'vitest';
import { main } from './main.js';

vi.mock('../resolve/binary.js', () => ({
  resolveBinary: () => '/mocked/default/darkfactory',
}));

describe('main', () => {
  it('spawns the resolved binary with argv and propagates exit code', async () => {
    const resolveBin = vi.fn(() => '/abs/darkfactory');
    const spawn = vi.fn(async () => 0);
    const code = await main(['--help'], { resolveBin, spawn });
    expect(spawn).toHaveBeenCalledWith('/abs/darkfactory', ['--help']);
    expect(code).toBe(0);
  });

  it('rejects when resolveBin throws', async () => {
    const resolveBin = vi.fn(() => {
      throw new Error('boom');
    });
    const spawn = vi.fn();
    await expect(main([], { resolveBin, spawn })).rejects.toThrow('boom');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('rejects when spawn rejects', async () => {
    const resolveBin = vi.fn(() => '/abs/darkfactory');
    const spawn = vi.fn(async () => {
      throw new Error('ENOENT');
    });
    await expect(main([], { resolveBin, spawn })).rejects.toThrow('ENOENT');
  });

  it('propagates non-zero exit codes', async () => {
    const resolveBin = vi.fn(() => '/abs/darkfactory');
    const spawn = vi.fn(async () => 2);
    expect(await main(['bad-arg'], { resolveBin, spawn })).toBe(2);
  });

  it('uses default resolveBin when none supplied', async () => {
    const spawn = vi.fn(async () => 0);
    const code = await main([], { spawn });
    expect(spawn).toHaveBeenCalledWith('/mocked/default/darkfactory', []);
    expect(code).toBe(0);
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

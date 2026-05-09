import * as _binary from '../resolve/binary.js';
import { resolveBinary } from '../resolve/binary.js';
import * as _defaults from '../defaults.js';
import { defaultSpawner } from '../defaults.js';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { main } from './main.js';

vi.mock('../resolve/binary.js', async () => {
  const actual = (await vi.importActual(
    '../resolve/binary.js',
  )) as typeof _binary;
  return {
    ...actual,
    resolveBinary: vi.fn(),
  };
});

vi.mock('../defaults.js', async () => {
  const actual = (await vi.importActual('../defaults.js')) as typeof _defaults;
  return {
    ...actual,
    defaultSpawner: vi.fn(),
  };
});

describe('main', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('spawns the resolved binary with argv and propagates exit code', async () => {
    const resolveBin = vi.fn(() => 'darkfactory');
    const spawn = vi.fn(async () => 0);
    const code = await main(['--help'], { resolveBin, spawn });
    expect(spawn).toHaveBeenCalledWith('darkfactory', ['--help']);
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
    const resolveBin = vi.fn(() => 'darkfactory');
    const spawn = vi.fn(async () => {
      throw new Error('ENOENT');
    });
    await expect(main([], { resolveBin, spawn })).rejects.toThrow('ENOENT');
  });

  it('propagates non-zero exit codes', async () => {
    const resolveBin = vi.fn(() => 'darkfactory');
    const spawn = vi.fn(async () => 2);
    expect(await main(['bad-arg'], { resolveBin, spawn })).toBe(2);
  });

  it('uses default resolveBin when none supplied', async () => {
    vi.mocked(resolveBinary).mockImplementation(() => 'darkfactory');
    const spawn = vi.fn(async () => 0);
    const code = await main([], { spawn });
    expect(spawn).toHaveBeenCalledWith('darkfactory', []);
    expect(code).toBe(0);
  });

  it('uses default argv when none supplied', async () => {
    const resolveBin = vi.fn(() => 'darkfactory');
    const spawn = vi.fn(async () => 0);
    expect(await main(undefined, { resolveBin, spawn })).toBe(0);
  });

  it('uses default spawn when none supplied', async () => {
    vi.mocked(defaultSpawner).mockImplementation(async () => 0);
    const resolveBin = vi.fn(() => 'darkfactory');
    const code = await main(['hello'], { resolveBin });
    expect(defaultSpawner).toHaveBeenCalledWith('darkfactory', ['hello']);
    expect(code).toBe(0);
  });
});

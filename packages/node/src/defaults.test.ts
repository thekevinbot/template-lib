import { describe, it, expect, vi } from 'vitest';
import { defaultResolver, defaultSpawner, defaultStderr } from './defaults.js';

describe('defaultResolver', () => {
  it('returns a function that resolves Node built-ins', () => {
    const r = defaultResolver();
    expect(typeof r('node:fs')).toBe('string');
  });
});

describe('defaultSpawner', () => {
  it('runs a real command and resolves with its exit code', async () => {
    const code = await defaultSpawner(process.execPath, [
      '-e',
      'process.exit(0)',
    ]);
    expect(code).toBe(0);
  });

  it('rejects when the command does not exist', async () => {
    await expect(defaultSpawner('/nonexistent/binary', [])).rejects.toThrow();
  });

  it('resolves with 1 when child is terminated by a signal', async () => {
    const code = await defaultSpawner(process.execPath, [
      '-e',
      'process.kill(process.pid, "SIGTERM")',
    ]);
    expect(code).toBe(1);
  });
});

describe('defaultStderr', () => {
  it('writes to process.stderr', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    defaultStderr('hello');
    expect(spy).toHaveBeenCalledWith('hello');
    spy.mockRestore();
  });
});

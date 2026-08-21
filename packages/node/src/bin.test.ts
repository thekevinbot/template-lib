import { describe, it, expect, vi } from 'vitest';
import { options, run } from './bin';

describe('bin', () => {
  it('wires the launcher options for the platform binary', () => {
    expect(options.scope).toBe('mynewproduct');
    expect(options.binaryName).toBe('mynewproduct');
    expect(options.platformPackage).toBe('@{scope}/{triple}');
    // '' not 'bin': the engine stages the binary at the platform-package root.
    // A wrong value here fails only at install time, on one platform.
    expect(options.binaryDir).toBe('');
    expect(options.triples['linux-x64']).toBe('x86_64-unknown-linux-gnu');
  });

  it('forwards the options to the launcher and returns its exit code', async () => {
    const launch = vi.fn().mockResolvedValue(3);
    const code = await run(launch);
    expect(code).toBe(3);
    expect(launch).toHaveBeenCalledWith(options);
  });

  it('returns 1 and reports the message when the launcher rejects', async () => {
    const launch = vi.fn().mockRejectedValue(new Error('boom'));
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const code = await run(launch);
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith('boom\n');
    stderr.mockRestore();
  });
});

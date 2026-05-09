import { describe, it, expect, vi } from 'vitest';
import { defaultStderr } from './stderr.js';

describe('defaultStderr', () => {
  it('writes to process.stderr', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    defaultStderr('hello');
    expect(spy).toHaveBeenCalledWith('hello');
    spy.mockRestore();
  });
});

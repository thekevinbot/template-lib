import { describe, it, expect } from 'vitest';
import { defaultSpawner } from './spawner.js';

describe('defaultSpawner', () => {
  it('runs a real command and returns its status', () => {
    const result = defaultSpawner(process.execPath, ['-e', 'process.exit(0)']);
    expect(result.status).toBe(0);
  });
});

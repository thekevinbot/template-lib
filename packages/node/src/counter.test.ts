import { describe, expect, it } from 'vitest';

// The SDK is the napi binding itself (no veneer). Import it directly via the generated loader.
import { Counter, runCli, version } from '../index.js';

const CORPUS = 'the quick brown fox the lazy dog The QUICK fox';

const loaded = (): Counter => {
  const c = new Counter();
  c.add(CORPUS);
  return c;
};

describe('Counter', () => {
  it('counts case-insensitively', () => {
    const c = loaded();
    expect(c.total).toBe(10);
    expect(c.size).toBe(6);
    expect(c.count('THE')).toBe(3);
    expect(c.count('missing')).toBe(0);
  });

  it('supports has()', () => {
    const c = loaded();
    expect(c.has('the')).toBe(true);
    expect(c.has('missing')).toBe(false);
  });

  it('mostCommon breaks ties by word ascending', () => {
    expect(loaded().mostCommon(3)).toEqual([
      { word: 'the', count: 3 },
      { word: 'fox', count: 2 },
      { word: 'quick', count: 2 },
    ]);
  });

  it('returns entries in deterministic order', () => {
    expect(loaded().entries().map((e) => e.word)).toEqual([
      'the', 'fox', 'quick', 'brown', 'dog', 'lazy',
    ]);
  });

  it('respects caseSensitive', () => {
    const c = new Counter(true);
    c.add('The the THE');
    expect(c.count('the')).toBe(1);
    expect(c.size).toBe(3);
  });

  it('throws an error with code "InvalidArg" on negative n', () => {
    try {
      loaded().mostCommon(-1);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as { code?: string }).code).toBe('InvalidArg');
      expect((e as Error).message).toContain('n must be >= 0');
    }
  });

  it('exposes the core version', () => {
    expect(version()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('runs the CLI in-process', () => {
    expect(runCli(['--top', '2', 'a a b'])).toBe(0);
    expect(runCli(['--top', '-1', 'hi'])).toBe(1);
  });
});

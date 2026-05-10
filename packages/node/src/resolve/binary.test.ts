import * as _defaults from '../defaults.js';
import { defaultResolver } from '../defaults.js';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { resolveBinary } from './binary.js';

vi.mock('../defaults.js', async () => {
  const actual = (await vi.importActual('../defaults.js')) as typeof _defaults;
  return {
    ...actual,
    defaultResolver: vi.fn(),
  };
});

describe('resolveBinary', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the per-platform optional dep on linux/x64', () => {
    const resolver = vi.fn((id: string) => id);
    const path = resolveBinary({ platform: 'linux', arch: 'x64', resolver });
    expect(resolver).toHaveBeenCalledWith(
      '@dark-factory/x86_64-unknown-linux-gnu/bin/darkfactory',
    );
    expect(path).toBe(
      '@dark-factory/x86_64-unknown-linux-gnu/bin/darkfactory',
    );
  });

  it('appends .exe on win32', () => {
    const resolver = vi.fn((id: string) => id);
    resolveBinary({ platform: 'win32', arch: 'x64', resolver });
    expect(resolver).toHaveBeenCalledWith(
      '@dark-factory/x86_64-pc-windows-msvc/bin/darkfactory.exe',
    );
  });

  it('throws when the optional dep is not installed', () => {
    const resolver = vi.fn(() => {
      throw new Error('not found');
    });
    expect(() =>
      resolveBinary({ platform: 'linux', arch: 'arm64', resolver }),
    ).toThrow(/no prebuilt binary for linux-arm64/);
  });

  it('throws on unsupported platform/arch', () => {
    expect(() =>
      resolveBinary({ platform: 'freebsd', arch: 'x64', resolver: vi.fn() }),
    ).toThrow(/unsupported platform\/arch freebsd-x64/);
  });

  it('uses default resolver when none supplied', () => {
    const fakeResolver = vi.fn((id: string) => id);
    vi.mocked(defaultResolver).mockReturnValue(fakeResolver);
    const path = resolveBinary({ platform: 'linux', arch: 'x64' });
    expect(defaultResolver).toHaveBeenCalled();
    expect(fakeResolver).toHaveBeenCalledWith(
      '@dark-factory/x86_64-unknown-linux-gnu/bin/darkfactory',
    );
    expect(path).toBe(
      '@dark-factory/x86_64-unknown-linux-gnu/bin/darkfactory',
    );
  });

  it('uses process.platform/arch defaults when called bare', () => {
    vi.mocked(defaultResolver).mockReturnValue(
      vi.fn(() => {
        throw new Error('not found');
      }),
    );
    // Either "no prebuilt binary" (resolver throws on a supported triple)
    // or "unsupported platform/arch" (host is something exotic) is fine —
    // both are valid bare-call outcomes.
    expect(() => resolveBinary()).toThrow();
  });
});

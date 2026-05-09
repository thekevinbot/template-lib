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
      '@darkfactory/linux-x64/bin/darkfactory',
    );
    expect(path).toBe('@darkfactory/linux-x64/bin/darkfactory');
  });

  it('appends .exe on win32', () => {
    const resolver = vi.fn((id: string) => id);
    resolveBinary({ platform: 'win32', arch: 'x64', resolver });
    expect(resolver).toHaveBeenCalledWith(
      '@darkfactory/win32-x64/bin/darkfactory.exe',
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

  it('uses default resolver when none supplied', () => {
    const fakeResolver = vi.fn((id: string) => id);
    vi.mocked(defaultResolver).mockReturnValue(fakeResolver);
    const path = resolveBinary({ platform: 'linux', arch: 'x64' });
    expect(defaultResolver).toHaveBeenCalled();
    expect(fakeResolver).toHaveBeenCalledWith(
      '@darkfactory/linux-x64/bin/darkfactory',
    );
    expect(path).toBe('@darkfactory/linux-x64/bin/darkfactory');
  });

  it('uses process.platform/arch defaults when called bare', () => {
    vi.mocked(defaultResolver).mockReturnValue(
      vi.fn(() => {
        throw new Error('not found');
      }),
    );
    expect(() => resolveBinary()).toThrow(/no prebuilt binary/);
  });
});

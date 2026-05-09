import { describe, it, expect, vi } from 'vitest';
import { resolveBinary } from './binary.js';

describe('resolveBinary', () => {
  it('resolves the per-platform optional dep on linux/x64', () => {
    const resolver = vi.fn((id: string) => `/abs/${id}`);
    const path = resolveBinary({
      platform: 'linux',
      arch: 'x64',
      env: {},
      resolver,
    });
    expect(resolver).toHaveBeenCalledWith(
      '@darkfactory/linux-x64/bin/darkfactory',
    );
    expect(path).toBe('/abs/@darkfactory/linux-x64/bin/darkfactory');
  });

  it('appends .exe on win32', () => {
    const resolver = vi.fn((id: string) => `/abs/${id}`);
    resolveBinary({ platform: 'win32', arch: 'x64', env: {}, resolver });
    expect(resolver).toHaveBeenCalledWith(
      '@darkfactory/win32-x64/bin/darkfactory.exe',
    );
  });

  it('falls back to DARKFACTORY_BIN when resolver throws', () => {
    const resolver = vi.fn(() => {
      throw new Error('not found');
    });
    const path = resolveBinary({
      platform: 'linux',
      arch: 'x64',
      env: { DARKFACTORY_BIN: '/custom/bin' },
      resolver,
    });
    expect(path).toBe('/custom/bin');
  });

  it('throws when neither optional dep nor env present', () => {
    const resolver = vi.fn(() => {
      throw new Error('not found');
    });
    expect(() =>
      resolveBinary({ platform: 'linux', arch: 'arm64', env: {}, resolver }),
    ).toThrow(/no prebuilt binary for linux-arm64/);
  });

  it('uses process.platform/arch/env defaults when called bare', () => {
    expect(() => resolveBinary()).toThrow(/no prebuilt binary/);
  });
});

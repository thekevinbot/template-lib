import { defaultResolver } from '../defaults.js';
import type { ResolveOpts } from '../types.js';

const RUST_TRIPLE: Record<string, string> = {
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
  'darwin-x64': 'x86_64-apple-darwin',
  'darwin-arm64': 'aarch64-apple-darwin',
  'win32-x64': 'x86_64-pc-windows-msvc',
};

export function resolveBinary({
  platform = process.platform,
  arch = process.arch,
  resolver = defaultResolver(),
}: ResolveOpts = {}): string {
  const ext = platform === 'win32' ? '.exe' : '';
  const triple = RUST_TRIPLE[`${platform}-${arch}`];
  if (triple === undefined) {
    throw new Error(
      `darkfactory-cli: unsupported platform/arch ${platform}-${arch}.`,
    );
  }
  const platformPkg = `@dark-factory/${triple}`;
  try {
    return resolver(`${platformPkg}/bin/darkfactory${ext}`);
  } catch (cause) {
    throw new Error(
      `darkfactory-cli: no prebuilt binary for ${platform}-${arch}. ` +
        `expected optional dependency ${platformPkg} to provide one. ` +
        'fix: rerun `npm install darkfactory-cli`.',
      { cause },
    );
  }
}

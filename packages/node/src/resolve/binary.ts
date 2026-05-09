import { defaultResolver } from '../defaults.js';
import type { ResolveOpts } from '../types.js';

export function resolveBinary({
  platform = process.platform,
  arch = process.arch,
  resolver = defaultResolver(),
}: ResolveOpts = {}): string {
  const ext = platform === 'win32' ? '.exe' : '';
  const platformPkg = `@darkfactory/${platform}-${arch}`;
  try {
    return resolver(`${platformPkg}/bin/darkfactory${ext}`);
  } catch {
    throw new Error(
      `darkfactory: no prebuilt binary for ${platform}-${arch}. ` +
        `expected optional dependency ${platformPkg} to provide one. ` +
        'fix: rerun `npm install darkfactory`.',
    );
  }
}

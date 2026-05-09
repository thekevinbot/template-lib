import { defaultResolver } from '../defaults/resolver.js';
import type { ResolveOpts } from '../types.js';

export function resolveBinary(opts: ResolveOpts = {}): string {
  const platform = opts.platform ?? process.platform;
  const arch = opts.arch ?? process.arch;
  const env = opts.env ?? process.env;
  const resolver = opts.resolver ?? defaultResolver();
  const ext = platform === 'win32' ? '.exe' : '';
  const platformPkg = `@darkfactory/${platform}-${arch}`;
  try {
    return resolver(`${platformPkg}/bin/darkfactory${ext}`);
  } catch {
    if (env.DARKFACTORY_BIN) return env.DARKFACTORY_BIN;
    throw new Error(
      `darkfactory: no prebuilt binary for ${platform}-${arch}. ` +
        `expected optional dependency ${platformPkg} to provide one. ` +
        'fix: rerun `npm install darkfactory`, set DARKFACTORY_BIN=/abs/path, ' +
        'or run `cargo install darkfactory`.',
    );
  }
}

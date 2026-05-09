#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ext = process.platform === 'win32' ? '.exe' : '';
const platformPkg = `@darkfactory/${process.platform}-${process.arch}`;
const require = createRequire(import.meta.url);

let binPath;
try {
  binPath = require.resolve(`${platformPkg}/bin/darkfactory${ext}`);
} catch {
  if (process.env.DARKFACTORY_BIN) {
    binPath = process.env.DARKFACTORY_BIN;
  } else {
    console.error(
      `darkfactory: no prebuilt binary for ${process.platform}-${process.arch}.\n` +
        `expected optional dependency ${platformPkg} to provide one.\n` +
        'fix: rerun `npm install darkfactory`, set DARKFACTORY_BIN=/abs/path, ' +
        'or run `cargo install darkfactory`.',
    );
    process.exit(1);
  }
}

const result = spawnSync(binPath, process.argv.slice(2), { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);

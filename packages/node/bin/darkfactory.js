#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const target = process.env.DARKFACTORY_BIN ?? 'darkfactory';
const result = spawnSync(target, process.argv.slice(2), { stdio: 'inherit' });

if (result.error?.code === 'ENOENT') {
  console.error(
    `\`${target}\` not on PATH. Install with \`cargo install darkfactory\` ` +
      'or set DARKFACTORY_BIN.',
  );
  process.exit(127);
}
if (result.error) throw result.error;
process.exit(result.status ?? 1);

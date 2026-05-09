#!/usr/bin/env node
import { main } from './cli/main.js';

main()
  .then((code) => process.exit(code))
  .catch((err: Error) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  });

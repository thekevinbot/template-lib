#!/usr/bin/env node
// Console entry point — forwards argv into the one Rust CLI implementation (via the napi addon).
const { runCli } = require('./index.js');
process.exit(runCli(process.argv.slice(2)));

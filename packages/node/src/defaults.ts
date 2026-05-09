import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import type { Resolver, Spawner } from './types.js';

export const defaultResolver = (): Resolver =>
  createRequire(import.meta.url).resolve;

export const defaultSpawner: Spawner = (cmd, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, [...args], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });

import { spawnSync } from 'node:child_process';
import type { Spawner } from '../types.js';

export const defaultSpawner: Spawner = (cmd, args) =>
  spawnSync(cmd, [...args], { stdio: 'inherit' });

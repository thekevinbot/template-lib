import { createRequire } from 'node:module';
import type { Resolver } from '../types.js';

export const defaultResolver = (): Resolver =>
  createRequire(import.meta.url).resolve;

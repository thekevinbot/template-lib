import type { ErrorWriter } from '../types.js';

export const defaultStderr: ErrorWriter = (msg) => {
  process.stderr.write(msg);
};

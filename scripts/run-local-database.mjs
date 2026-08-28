import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const command = process.argv[2];

if (!['start', 'reset'].includes(command)) {
  throw new Error('Expected a Supabase database command: start or reset.');
}

const executable = resolve(
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'supabase.cmd' : 'supabase',
);
const arguments_ = command === 'start' ? ['start'] : ['db', 'reset'];
const result = spawnSync(executable, arguments_, { stdio: 'inherit' });

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

await import('./configure-super-admin.mjs');

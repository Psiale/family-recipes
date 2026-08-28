import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const executable = resolve(
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'supabase.cmd' : 'supabase',
);
const result = spawnSync(
  executable,
  ['gen', 'types', 'typescript', '--local', '--schema', 'public'],
  { encoding: 'utf8' },
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const committed = await readFile(
  new URL('../src/lib/supabase/database.types.ts', import.meta.url),
  'utf8',
);

if (result.stdout !== committed) {
  console.error(
    'Generated database types are stale. Run npm run db:types and commit the result.',
  );
  process.exit(1);
}

console.log('Generated database types are current.');

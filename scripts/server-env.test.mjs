import assert from 'node:assert/strict';
import test from 'node:test';

import { parseServerEnv } from './server-env.mjs';

test('normalizes valid server-only configuration', () => {
  assert.deepEqual(
    parseServerEnv({
      SUPABASE_DB_URL: 'postgresql://user:pass@localhost:5432/database',
      SUPER_ADMIN_EMAIL: ' Admin@Example.com ',
    }),
    {
      SUPABASE_DB_URL: 'postgresql://user:pass@localhost:5432/database',
      SUPER_ADMIN_EMAIL: 'admin@example.com',
    },
  );
});

test('rejects a non-Postgres database URL', () => {
  assert.throws(() =>
    parseServerEnv({
      SUPABASE_DB_URL: 'https://localhost/database',
      SUPER_ADMIN_EMAIL: 'admin@example.com',
    }),
  );
});

test('rejects a malformed database URL with a validation error', () => {
  assert.throws(() =>
    parseServerEnv({
      SUPABASE_DB_URL: 'not-a-url',
      SUPER_ADMIN_EMAIL: 'admin@example.com',
    }),
  );
});

test('rejects a malformed Super Admin email', () => {
  assert.throws(() =>
    parseServerEnv({
      SUPABASE_DB_URL: 'postgresql://localhost/database',
      SUPER_ADMIN_EMAIL: 'not-an-email',
    }),
  );
});

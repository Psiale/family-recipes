import { ZodError } from 'zod';

import { parsePublicEnv, parsePublicEnvSafely } from './env';

describe('public environment', () => {
  it('accepts a valid Supabase configuration', () => {
    expect(
      parsePublicEnv({
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-publishable-key',
        EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      }),
    ).toEqual({
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-publishable-key',
      EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    });
  });

  it('rejects missing or malformed configuration', () => {
    expect(() =>
      parsePublicEnv({
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
        EXPO_PUBLIC_SUPABASE_URL: 'not-a-url',
      }),
    ).toThrow(ZodError);
  });

  it('returns a failure result that a configuration screen can render', () => {
    const result = parsePublicEnvSafely({
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
      EXPO_PUBLIC_SUPABASE_URL: 'not-a-url',
    });

    expect(result.success).toBe(false);
  });

  it('rejects non-HTTP public URLs', () => {
    expect(
      parsePublicEnvSafely({
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-publishable-key',
        EXPO_PUBLIC_SUPABASE_URL: 'ftp://example.com',
      }).success,
    ).toBe(false);
  });
});

import { ZodError } from 'zod';

import { parsePublicEnv } from './env';

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
});

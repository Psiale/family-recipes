import { z } from 'zod';

export const publicEnvSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z
    .url()
    .refine((value) => /^https?:\/\//i.test(value), {
      message: 'Supabase URL must use HTTP or HTTPS.',
    }),
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(
  source: Record<string, string | undefined>,
): PublicEnv {
  return publicEnvSchema.parse(source);
}

export function parsePublicEnvSafely(
  source: Record<string, string | undefined>,
) {
  return publicEnvSchema.safeParse(source);
}

function readPublicEnv() {
  return {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function getPublicEnv(): PublicEnv {
  return parsePublicEnv(readPublicEnv());
}

export function getPublicEnvResult() {
  return parsePublicEnvSafely(readPublicEnv());
}

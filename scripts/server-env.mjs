import { z } from 'zod';

const databaseUrlSchema = z
  .url('SUPABASE_DB_URL must be a valid URL.')
  .refine((value) => /^postgres(?:ql)?:\/\//i.test(value), {
    message: 'SUPABASE_DB_URL must use the postgres or postgresql protocol.',
  });

const emailSchema = z
  .string()
  .trim()
  .email('SUPER_ADMIN_EMAIL must be a valid email address.')
  .transform((value) => value.toLowerCase());

export const serverEnvSchema = z.object({
  SUPABASE_DB_URL: databaseUrlSchema,
  SUPER_ADMIN_EMAIL: emailSchema,
});

export function parseDatabaseEnv(source = process.env) {
  return z.object({ SUPABASE_DB_URL: databaseUrlSchema }).parse(source);
}

export function parseServerEnv(source = process.env) {
  return serverEnvSchema.parse(source);
}

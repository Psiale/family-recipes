import { z } from 'zod';

export const detailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: 'families.validation.nameRequired' })
    .max(120, { error: 'families.validation.nameLong' }),
  description: z
    .string()
    .trim()
    .max(2000, { error: 'families.validation.descriptionLong' }),
});
export const claimSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/, { error: 'families.validation.claimCode' }),
});
export const issueClaimSchema = z.object({
  email: z
    .string()
    .trim()
    .max(320, { error: 'validation.emailInvalid' })
    .email({ error: 'validation.emailInvalid' }),
});

export function onboardingErrorKey(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : undefined;
  if (code === '23505') return 'families.errors.alreadyLinked';
  if (code === '42501') return 'families.errors.permission';
  if (code === '22023') return 'families.errors.invalid';
  if (code === '55000') return 'families.errors.onboarding';
  return 'families.errors.save';
}

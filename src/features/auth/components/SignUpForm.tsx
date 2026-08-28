import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { AppButton } from '@/components/AppButton';
import { TextField } from '@/components/TextField';
import { colors, spacing } from '@/components/theme';
import type { SignUpResult } from '@/features/auth/providers/SessionProvider';

const signUpSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, { error: 'validation.emailRequired' })
      .email({ error: 'validation.emailInvalid' }),
    password: z
      .string()
      .min(1, { error: 'validation.passwordRequired' })
      .min(8, { error: 'validation.passwordMinimum' }),
    confirmPassword: z
      .string()
      .min(1, { error: 'validation.passwordConfirmationRequired' }),
  })
  .refine(({ confirmPassword, password }) => confirmPassword === password, {
    message: 'validation.passwordsMismatch',
    path: ['confirmPassword'],
  });

type SignUpValues = z.infer<typeof signUpSchema>;
type MessageKey =
  | 'auth.existingAccount'
  | 'auth.signUpGenericError'
  | 'validation.emailInvalid'
  | 'validation.emailRequired'
  | 'validation.passwordConfirmationRequired'
  | 'validation.passwordMinimum'
  | 'validation.passwordRequired'
  | 'validation.passwordsMismatch';

type SignUpFormProps = {
  onSignUp: (
    values: Pick<SignUpValues, 'email' | 'password'>,
  ) => Promise<SignUpResult>;
};

function getSignUpErrorKey(error: unknown): MessageKey {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String(error.code);
    if (code === 'email_exists' || code === 'user_already_exists') {
      return 'auth.existingAccount';
    }
  }

  return 'auth.signUpGenericError';
}

export function SignUpForm({ onSignUp }: SignUpFormProps) {
  const { t } = useTranslation();
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
  } = useForm<SignUpValues>({
    defaultValues: { confirmPassword: '', email: '', password: '' },
    resolver: zodResolver(signUpSchema),
  });

  const submit = handleSubmit(async ({ email, password }) => {
    try {
      const result = await onSignUp({ email, password });
      if (result.status === 'confirmationRequired') {
        setConfirmationRequired(true);
      } else if (result.status === 'existingAccount') {
        setError('root', { message: 'auth.existingAccount' });
      }
    } catch (error) {
      setError('root', { message: getSignUpErrorKey(error) });
    }
  });

  const translateMessage = (message: string | undefined) =>
    message ? t(message as MessageKey) : undefined;

  if (confirmationRequired) {
    return (
      <View accessible accessibilityRole="alert" style={styles.notice}>
        <Text accessibilityRole="header" style={styles.noticeTitle}>
          {t('auth.confirmationRequiredTitle')}
        </Text>
        <Text style={styles.noticeBody}>
          {t('auth.confirmationRequiredBody')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="email"
        render={({ field: { onBlur, onChange, ref, value } }) => (
          <TextField
            ref={ref}
            autoCapitalize="none"
            autoComplete="email"
            error={translateMessage(errors.email?.message)}
            inputMode="email"
            label={t('auth.email')}
            onBlur={onBlur}
            onChangeText={onChange}
            returnKeyType="next"
            value={value}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field: { onBlur, onChange, ref, value } }) => (
          <TextField
            ref={ref}
            autoCapitalize="none"
            autoComplete="new-password"
            error={translateMessage(errors.password?.message)}
            label={t('auth.password')}
            onBlur={onBlur}
            onChangeText={onChange}
            returnKeyType="next"
            secureTextEntry
            value={value}
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onBlur, onChange, ref, value } }) => (
          <TextField
            ref={ref}
            autoCapitalize="none"
            autoComplete="new-password"
            error={translateMessage(errors.confirmPassword?.message)}
            label={t('auth.confirmPassword')}
            onBlur={onBlur}
            onChangeText={onChange}
            onSubmitEditing={() => void submit()}
            returnKeyType="done"
            secureTextEntry
            value={value}
          />
        )}
      />
      {errors.root?.message ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {translateMessage(errors.root.message)}
        </Text>
      ) : null}
      <AppButton
        label={
          isSubmitting ? t('auth.creatingAccount') : t('auth.createAccount')
        }
        loading={isSubmitting}
        onPress={() => void submit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  error: {
    color: colors.error,
    fontSize: 14,
  },
  notice: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  noticeBody: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
});

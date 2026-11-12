import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { colors, spacing } from '@/components/theme';

const emailSchema = z.object({ email: z.string().trim().min(1).email() });
const passwordSchema = z
  .object({
    password: z.string().min(8, { error: 'validation.passwordMinimum' }),
    confirmPassword: z
      .string()
      .min(1, { error: 'validation.passwordConfirmationRequired' }),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    error: 'validation.passwordsMismatch',
    path: ['confirmPassword'],
  });

export function RequestPasswordResetForm({
  onRequest,
}: {
  onRequest: (email: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { email: '' },
    resolver: zodResolver(emailSchema),
  });
  const submit = handleSubmit(async ({ email }) => {
    try {
      await onRequest(email);
      setSent(true);
    } catch {
      setError('root', { message: 'auth.recovery.sendError' });
    }
  });
  if (sent)
    return (
      <Text role="status" style={styles.body}>
        {t('auth.recovery.sent')}
      </Text>
    );
  return (
    <View style={styles.form}>
      <Text style={styles.body}>{t('auth.recovery.instructions')}</Text>
      <Controller
        control={control}
        name="email"
        render={({ field: { ref, value, onChange, onBlur } }) => (
          <TextField
            ref={ref}
            label={t('auth.email')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            inputMode="email"
            editable={!isSubmitting}
            error={errors.email ? t('validation.emailInvalid') : undefined}
          />
        )}
      />
      {errors.root ? (
        <Text role="alert" style={styles.error}>
          {t('auth.recovery.sendError')}
        </Text>
      ) : null}
      <AppButton
        label={t('auth.recovery.send')}
        loading={isSubmitting}
        onPress={() => void submit()}
      />
    </View>
  );
}

export function NewPasswordForm({
  onSave,
}: {
  onSave: (password: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { password: '', confirmPassword: '' },
    resolver: zodResolver(passwordSchema),
  });
  const submit = handleSubmit(async ({ password }) => {
    try {
      await onSave(password);
    } catch (error) {
      const code =
        typeof error === 'object' && error && 'code' in error
          ? error.code
          : null;
      setError('root', {
        message:
          code === 'same_password'
            ? 'auth.recovery.samePassword'
            : code === 'weak_password'
              ? 'auth.recovery.weakPassword'
              : 'auth.recovery.updateError',
      });
    }
  });
  return (
    <View style={styles.form}>
      <Text style={styles.body}>{t('auth.recovery.newInstructions')}</Text>
      {(['password', 'confirmPassword'] as const).map((name) => (
        <Controller
          key={name}
          control={control}
          name={name}
          render={({ field: { ref, value, onChange, onBlur } }) => (
            <TextField
              ref={ref}
              label={t(
                name === 'password'
                  ? 'auth.recovery.newPassword'
                  : 'auth.confirmPassword',
              )}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              editable={!isSubmitting}
              error={
                errors[name]?.message
                  ? t(errors[name].message as 'validation.passwordMinimum')
                  : undefined
              }
            />
          )}
        />
      ))}
      {errors.root?.message ? (
        <Text role="alert" style={styles.error}>
          {t(errors.root.message as 'auth.recovery.updateError')}
        </Text>
      ) : null}
      <AppButton
        label={t('auth.recovery.save')}
        loading={isSubmitting}
        onPress={() => void submit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  error: { color: colors.error, fontSize: 14 },
});

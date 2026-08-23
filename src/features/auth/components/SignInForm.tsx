import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { AppButton } from '@/components/AppButton';
import { TextField } from '@/components/TextField';
import { colors, spacing } from '@/components/theme';

const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: 'validation.emailRequired' })
    .email({ error: 'validation.emailInvalid' }),
  password: z.string().min(1, { error: 'validation.passwordRequired' }),
});

type SignInValues = z.infer<typeof signInSchema>;
type FormMessageKey =
  | 'auth.genericError'
  | 'validation.emailInvalid'
  | 'validation.emailRequired'
  | 'validation.passwordRequired';

type SignInFormProps = {
  onSignIn: (values: SignInValues) => Promise<void>;
};

export function SignInForm({ onSignIn }: SignInFormProps) {
  const { t } = useTranslation();
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
  } = useForm<SignInValues>({
    defaultValues: { email: '', password: '' },
    resolver: zodResolver(signInSchema),
  });

  const submit = handleSubmit(async (values) => {
    try {
      await onSignIn(values);
    } catch {
      setError('root', { message: 'auth.genericError' });
    }
  });

  const translateMessage = (message: string | undefined) =>
    message ? t(message as FormMessageKey) : undefined;

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
            autoComplete="current-password"
            error={translateMessage(errors.password?.message)}
            label={t('auth.password')}
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
        label={isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
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
});

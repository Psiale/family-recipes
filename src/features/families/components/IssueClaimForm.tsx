import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { TextField } from '@/components/TextField';

import { issueClaimSchema, onboardingErrorKey } from '../forms';

import { styles } from './styles';

export function IssueClaimForm({
  onIssue,
  onCancel,
}: {
  onIssue: (email: string) => Promise<string>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [token, setToken] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { email: '' },
    resolver: zodResolver(issueClaimSchema),
  });
  const submit = handleSubmit(async ({ email }) => {
    try {
      setToken(await onIssue(email));
    } catch (error) {
      setError('root', { message: onboardingErrorKey(error) });
    }
  });
  if (token)
    return (
      <View style={styles.stack}>
        <Text role="heading" style={styles.title}>
          {t('families.codeReady')}
        </Text>
        <Text style={styles.body}>{t('families.shareCode')}</Text>
        <Text
          selectable
          aria-label={t('families.claimCode')}
          style={styles.code}
        >
          {token}
        </Text>
        <AppButton label={t('families.done')} onPress={onCancel} />
      </View>
    );
  return (
    <View style={styles.stack}>
      <Text style={styles.body}>{t('families.issueExplanation')}</Text>
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
            inputMode="email"
            editable={!isSubmitting}
            error={errors.email ? t('validation.emailInvalid') : undefined}
          />
        )}
      />
      {errors.root?.message ? (
        <Text role="alert" style={styles.error}>
          {t(errors.root.message as 'families.errors.save')}
        </Text>
      ) : null}
      <AppButton
        label={t('families.issueClaim')}
        loading={isSubmitting}
        onPress={() => void submit()}
      />
      <AppButton
        label={t('families.cancel')}
        variant="secondary"
        disabled={isSubmitting}
        onPress={onCancel}
      />
    </View>
  );
}

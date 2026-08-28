import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { TextField } from '@/components/TextField';

import { claimSchema, onboardingErrorKey } from '../forms';

import { styles } from './styles';

export function ClaimForm({
  onClaim,
  onCancel,
}: {
  onClaim: (token: string) => Promise<unknown>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { token: '' },
    resolver: zodResolver(claimSchema),
  });
  const submit = handleSubmit(async ({ token }) => {
    try {
      await onClaim(token);
    } catch (error) {
      setError('root', { message: onboardingErrorKey(error) });
    }
  });
  return (
    <View style={styles.stack}>
      <Text style={styles.body}>{t('families.claimExplanation')}</Text>
      <Controller
        control={control}
        name="token"
        render={({ field: { ref, value, onChange, onBlur } }) => (
          <TextField
            ref={ref}
            label={t('families.claimCode')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmitting}
            error={
              errors.token ? t('families.validation.claimCode') : undefined
            }
          />
        )}
      />
      {errors.root?.message ? (
        <Text role="alert" style={styles.error}>
          {t(errors.root.message as 'families.errors.save')}
        </Text>
      ) : null}
      <AppButton
        label={t('families.claimProfile')}
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

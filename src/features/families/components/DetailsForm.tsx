import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { TextField } from '@/components/TextField';

import type { DetailsValues } from '../api';
import { detailsSchema, onboardingErrorKey } from '../forms';

import { styles } from './styles';

type Props = {
  kind: 'person' | 'family';
  submitLabel: string;
  onSave: (values: DetailsValues) => Promise<unknown>;
  onCancel?: () => void;
};

export function DetailsForm({ kind, submitLabel, onSave, onCancel }: Props) {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DetailsValues>({
    defaultValues: { name: '', description: '' },
    resolver: zodResolver(detailsSchema),
  });
  const translate = (message?: string) =>
    message ? t(message as 'families.errors.save') : undefined;
  const submit = handleSubmit(async (values) => {
    try {
      await onSave(values);
    } catch (error) {
      setError('root', { message: onboardingErrorKey(error) });
    }
  });
  return (
    <View style={styles.stack}>
      <Controller
        control={control}
        name="name"
        render={({ field: { ref, value, onChange, onBlur } }) => (
          <TextField
            ref={ref}
            label={t(
              kind === 'person' ? 'families.personName' : 'families.familyName',
            )}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            editable={!isSubmitting}
            autoCapitalize="words"
            error={translate(errors.name?.message)}
          />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field: { ref, value, onChange, onBlur } }) => (
          <TextField
            ref={ref}
            label={t(
              kind === 'person' ? 'families.biography' : 'families.description',
            )}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            editable={!isSubmitting}
            multiline
            style={styles.multiline}
            error={translate(errors.description?.message)}
          />
        )}
      />
      {errors.root?.message ? (
        <Text role="alert" style={styles.error}>
          {translate(errors.root.message)}
        </Text>
      ) : null}
      <AppButton
        label={isSubmitting ? t('families.saving') : submitLabel}
        loading={isSubmitting}
        onPress={() => void submit()}
      />
      {onCancel ? (
        <AppButton
          label={t('families.cancel')}
          variant="secondary"
          disabled={isSubmitting}
          onPress={onCancel}
        />
      ) : null}
    </View>
  );
}

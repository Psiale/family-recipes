import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';

import type { MembershipChangeValues } from '../api';

import { styles } from './styles';

export function MembershipConfirmation({
  kind,
  name,
  familyName,
  values,
  onConfirm,
  onCancel,
  onDone,
}: {
  kind: 'remove' | 'transfer';
  name: string;
  familyName: string;
  values: MembershipChangeValues;
  onConfirm: (values: MembershipChangeValues) => Promise<unknown>;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm(values);
      onDone();
    } catch (caught) {
      const code =
        typeof caught === 'object' && caught && 'code' in caught
          ? caught.code
          : null;
      setError(
        t(
          code === 'PT409'
            ? 'families.membership.stale'
            : code === '42501'
              ? 'families.errors.permission'
              : 'families.errors.save',
        ),
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={styles.stack}>
      <Text role="heading" style={styles.title}>
        {t(`families.membership.${kind}Title`, { name })}
      </Text>
      <Text style={styles.body}>
        {t(`families.membership.${kind}Explanation`, {
          name,
          family: familyName,
        })}
      </Text>
      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <AppButton
        label={t(`families.membership.${kind}Confirm`)}
        loading={saving}
        onPress={() => void confirm()}
      />
      <AppButton
        label={t('families.cancel')}
        variant="secondary"
        disabled={saving}
        onPress={onCancel}
      />
    </View>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';

import type { EditableFamilyRole, FamilyRole, RoleChangeValues } from '../api';
import { allowedFamilyRoles } from '../roles';

import { styles } from './styles';

export function RoleForm({
  actorRole,
  currentRole,
  familyId,
  personId,
  name,
  onSave,
  onCancel,
}: {
  actorRole: FamilyRole;
  currentRole: FamilyRole;
  familyId: string;
  personId: string;
  name: string;
  onSave: (values: RoleChangeValues) => Promise<unknown>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const choices = allowedFamilyRoles(actorRole, currentRole);
  const [selected, setSelected] = useState<EditableFamilyRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!selected || !choices.includes(selected) || selected === currentRole)
      return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        familyId,
        personId,
        role: selected,
        expectedRole: currentRole,
      });
      onCancel();
    } catch (caught) {
      const code =
        typeof caught === 'object' && caught && 'code' in caught
          ? caught.code
          : null;
      setError(
        t(
          code === 'PT409'
            ? 'families.roleManagement.stale'
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
        {t('families.roleManagement.title', { name })}
      </Text>
      <Text style={styles.body}>
        {t('families.roleManagement.explanation')}
      </Text>
      <Text style={styles.body}>
        {t('families.roleManagement.current', {
          role: t(`families.roles.${currentRole}`),
        })}
      </Text>
      {choices.map((role) => (
        <AppButton
          key={role}
          label={t(`families.roles.${role}`)}
          variant={selected === role ? 'primary' : 'secondary'}
          accessibilityState={{ selected: selected === role }}
          disabled={saving}
          onPress={() => setSelected(role)}
        />
      ))}
      {selected ? (
        <Text style={styles.body}>
          {t(`families.roleManagement.descriptions.${selected}`)}
        </Text>
      ) : null}
      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <AppButton
        label={t('families.roleManagement.save')}
        loading={saving}
        disabled={
          !selected || selected === currentRole || !choices.includes(selected)
        }
        onPress={() => void save()}
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

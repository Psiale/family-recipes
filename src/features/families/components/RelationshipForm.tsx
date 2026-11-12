import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';

import type { FamilyPerson, RelationshipValues } from '../api';

import { styles } from './styles';

type Kind = RelationshipValues['kind'];

function errorKey(error: unknown) {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String(error.code)
      : '';
  if (code === '23505') return 'families.tree.errors.duplicate' as const;
  if (code === '23514') return 'families.tree.errors.cycle' as const;
  return 'families.errors.save' as const;
}

export function RelationshipForm({
  familyId,
  people,
  onCancel,
  onSave,
}: {
  familyId: string;
  people: FamilyPerson[];
  onCancel: () => void;
  onSave: (values: RelationshipValues) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<Kind>('PARENT_CHILD');
  const [fromPersonId, setFromPersonId] = useState<string | null>(null);
  const [toPersonId, setToPersonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fromLabel =
    kind === 'PARENT_CHILD'
      ? t('families.tree.parent')
      : t('families.tree.firstPartner');
  const toLabel =
    kind === 'PARENT_CHILD'
      ? t('families.tree.child')
      : t('families.tree.secondPartner');

  const save = async () => {
    if (!fromPersonId || !toPersonId || fromPersonId === toPersonId) {
      setError(t('families.tree.errors.people'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ familyId, fromPersonId, kind, toPersonId });
    } catch (caught) {
      setError(t(errorKey(caught)));
    } finally {
      setSaving(false);
    }
  };

  const renderPeople = (
    label: string,
    selectedId: string | null,
    select: (id: string) => void,
  ) => (
    <View style={styles.stack}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.choiceGrid}>
        {people.map(({ person }) => (
          <View key={person.id} style={styles.choice}>
            <AppButton
              label={person.display_name}
              accessibilityLabel={`${label}: ${person.display_name}`}
              variant={selectedId === person.id ? 'primary' : 'secondary'}
              accessibilityState={{ selected: selectedId === person.id }}
              disabled={saving}
              onPress={() => select(person.id)}
            />
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.stack}>
      <Text style={styles.body}>{t('families.tree.formExplanation')}</Text>
      <View style={styles.choiceGrid}>
        {(['PARENT_CHILD', 'PARTNER'] as const).map((value) => (
          <View key={value} style={styles.choice}>
            <AppButton
              label={t(`families.tree.kinds.${value}`)}
              variant={kind === value ? 'primary' : 'secondary'}
              accessibilityState={{ selected: kind === value }}
              disabled={saving}
              onPress={() => {
                setKind(value);
                setError(null);
              }}
            />
          </View>
        ))}
      </View>
      {renderPeople(fromLabel, fromPersonId, setFromPersonId)}
      {renderPeople(toLabel, toPersonId, setToPersonId)}
      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <AppButton
        label={t('families.tree.save')}
        loading={saving}
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

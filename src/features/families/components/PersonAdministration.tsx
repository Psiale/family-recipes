import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { ScrollIntoView } from '@/components/Screen';
import { TextField } from '@/components/TextField';

import {
  adminRemoveFamilyMember,
  adminRenamePerson,
  type DirectoryFamily,
  type FamilyPerson,
} from '../api';
import { familyKeys } from '../queries';

import { styles } from './styles';

export function PersonAdministration({
  userId,
  family,
  member,
  action,
  onClose,
  onDone,
}: {
  userId: string;
  family: DirectoryFamily;
  member: FamilyPerson;
  action: 'rename' | 'remove';
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [name, setName] = useState(member.person.display_name);
  const [reason, setReason] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const submitting = useRef(false);
  const mutation = useMutation({
    networkMode: 'always',
    mutationFn: async () => {
      if (action === 'rename')
        await adminRenamePerson({
          personId: member.person.id,
          expectedName: member.person.display_name,
          expectedUpdatedAt: member.person.updated_at,
          name: name.trim(),
          reason: reason.trim(),
        });
      else
        await adminRemoveFamilyMember({
          familyId: family.id,
          personId: member.person.id,
          expectedRole: member.role,
          expectedUpdatedAt: member.membershipUpdatedAt,
          expectedName: member.person.display_name,
          expectedFamilyName: family.name,
          reason: reason.trim(),
        });
    },
  });
  const valid =
    reason.trim().length > 0 &&
    reason.length <= 2000 &&
    (action === 'remove' ||
      (name.trim().length > 0 &&
        name.trim().length <= 120 &&
        name.trim() !== member.person.display_name));
  const confirm = async () => {
    if (submitting.current || stale || !valid) return;
    submitting.current = true;
    setError(null);
    try {
      await mutation.mutateAsync();
      await client.invalidateQueries({ queryKey: familyKeys.root(userId) });
      onDone();
    } catch (caught) {
      const code =
        typeof caught === 'object' && caught && 'code' in caught
          ? caught.code
          : null;
      setStale(code === 'PT409' || code === 'PT412' || code === '42501');
      setError(
        t(
          code === 'PT409'
            ? 'personAdministration.stale'
            : code === 'PT412'
              ? 'personAdministration.lastOwner'
              : code === '42501'
                ? 'administration.denied'
                : 'families.errors.save',
        ),
      );
      void client.invalidateQueries({ queryKey: familyKeys.root(userId) });
    } finally {
      submitting.current = false;
    }
  };
  return (
    <View style={styles.stack}>
      <ScrollIntoView>
        <Text role="heading" style={styles.title}>
          {t(`personAdministration.${action}`, {
            name: member.person.display_name,
          })}
        </Text>
      </ScrollIntoView>
      <Text style={styles.body}>
        {t(`personAdministration.${action}Explanation`, {
          name: member.person.display_name,
          family: family.name,
        })}
      </Text>
      {action === 'remove' && member.role === 'OWNER' && (
        <Text style={styles.body}>{t('personAdministration.lastOwner')}</Text>
      )}
      {action === 'rename' && (
        <Text style={styles.body}>
          {t('personAdministration.currentName', {
            name: member.person.display_name,
          })}
        </Text>
      )}
      {reviewing ? (
        <>
          {action === 'rename' && (
            <Text style={styles.body}>
              {t('personAdministration.proposedName', { name: name.trim() })}
            </Text>
          )}
          <Text style={styles.body}>
            {t('personAdministration.reviewReason', { reason: reason.trim() })}
          </Text>
        </>
      ) : (
        <>
          {action === 'rename' && (
            <TextField
              label={t('personAdministration.newName')}
              value={name}
              onChangeText={setName}
              maxLength={120}
            />
          )}
          <TextField
            label={t('personAdministration.reason')}
            value={reason}
            onChangeText={setReason}
            maxLength={2000}
            multiline
          />
          <Text style={styles.body}>
            {t('personAdministration.reasonHint')}
          </Text>
        </>
      )}
      {error && (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {reviewing ? (
        <AppButton
          label={t('personAdministration.confirm')}
          loading={mutation.isPending}
          disabled={stale || !valid}
          onPress={() => void confirm()}
        />
      ) : (
        <AppButton
          label={t('personAdministration.review')}
          disabled={!valid}
          onPress={() => setReviewing(true)}
        />
      )}
      <AppButton
        label={t('families.cancel')}
        variant="secondary"
        disabled={mutation.isPending}
        onPress={onClose}
      />
    </View>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { ScrollIntoView } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';

import {
  adminDeletePersonProfile,
  getProfileDeletionImpact,
  type ProfileDeletionImpact,
} from '../api';
import { familyKeys } from '../queries';

import { styles } from './styles';

export function ProfileDeletion({
  userId,
  personId,
  onClose,
  onDone,
}: {
  userId: string;
  personId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const impact = useQuery({
    queryKey: [...familyKeys.root(userId), 'profile-deletion', personId],
    queryFn: () => getProfileDeletionImpact(personId),
    staleTime: 0,
  });
  const [snapshot, setSnapshot] = useState<ProfileDeletionImpact | null>(null);
  const [reason, setReason] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const submitting = useRef(false);
  const mutation = useMutation({
    networkMode: 'always',
    mutationFn: async () => {
      if (!snapshot) return;
      await adminDeletePersonProfile({
        personId,
        expectedState: snapshot.expected_state,
        confirmName: name,
        reason: reason.trim(),
      });
    },
  });
  const confirm = async () => {
    if (
      submitting.current ||
      !snapshot ||
      name !== snapshot.name ||
      !reason.trim() ||
      stale
    )
      return;
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
              ? 'profileDeletion.blocked'
              : code === '42501'
                ? 'administration.denied'
                : 'families.errors.save',
        ),
      );
    } finally {
      submitting.current = false;
    }
  };
  const data = snapshot ?? impact.data;
  return (
    <View style={styles.stack}>
      <ScrollIntoView>
        <Text role="heading" style={styles.title}>
          {t('profileDeletion.title')}
        </Text>
      </ScrollIntoView>
      <Text style={styles.body}>{t('profileDeletion.explanation')}</Text>
      {!snapshot && (impact.isError || impact.fetchStatus === 'paused') ? (
        <>
          <Text role="alert" style={styles.error}>
            {t('families.errors.load')}
          </Text>
          <AppButton
            label={t('families.retry')}
            onPress={() => void impact.refetch()}
          />
        </>
      ) : !data ? (
        <Text role="status">{t('app.loading')}</Text>
      ) : (
        <>
          <Text style={styles.subtitle}>{data.name}</Text>
          <Text style={styles.body}>
            {t('profileDeletion.impact', {
              families: data.families.length,
              grants: data.manager_grants,
              recipes: data.owned_recipes,
            })}
          </Text>
          {data.families.map((f) => (
            <Text key={f.id} style={styles.body}>
              {f.name} · {t(`families.roles.${f.role}`)}
              {f.last_owner ? ` · ${t('profileDeletion.lastOwner')}` : ''}
            </Text>
          ))}
          {(data.platform_admin || data.families.some((f) => f.last_owner)) && (
            <Text role="alert" style={styles.error}>
              {t('profileDeletion.blocked')}
            </Text>
          )}
          {snapshot ? (
            <>
              <Text style={styles.body}>
                {t('personAdministration.reviewReason', {
                  reason: reason.trim(),
                })}
              </Text>
              <TextField
                label={t('profileDeletion.typeName')}
                value={name}
                onChangeText={setName}
                editable={!mutation.isPending}
              />
              {error && (
                <Text role="alert" style={styles.error}>
                  {error}
                </Text>
              )}
              <AppButton
                label={t('profileDeletion.confirm')}
                loading={mutation.isPending}
                disabled={stale || name !== snapshot.name}
                onPress={() => void confirm()}
              />
            </>
          ) : (
            <>
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
              <AppButton
                label={t('personAdministration.review')}
                disabled={
                  !reason.trim() ||
                  !impact.isFetchedAfterMount ||
                  data.platform_admin ||
                  data.families.some((f) => f.last_owner)
                }
                onPress={() => setSnapshot(data)}
              />
            </>
          )}
        </>
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

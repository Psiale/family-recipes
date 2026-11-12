import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { styles } from '@/features/families/components/styles';
import {
  familyKeys,
  useCurrentPerson,
  useFamilies,
  useFamilyPeople,
} from '@/features/families/queries';

import { listMyManagers, setPersonManager, type ManagerChange } from './api';

export function DelegationScreen({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const person = useCurrentPerson(userId);
  return (
    <Screen contentStyle={styles.stack}>
      <Text role="heading" style={styles.title}>
        {t('delegation.title')}
      </Text>
      {person.isPending ? (
        <Text role="status">{t('app.loading')}</Text>
      ) : person.isError ? (
        <>
          <Text role="alert" style={styles.error}>
            {t('families.errors.load')}
          </Text>
          <AppButton
            label={t('families.retry')}
            onPress={() => void person.refetch()}
          />
        </>
      ) : person.data ? (
        <ManagerEditor userId={userId} personId={person.data.id} />
      ) : (
        <>
          <Text style={styles.body}>{t('delegation.needProfile')}</Text>
          <AppButton
            label={t('navigation.tree')}
            onPress={() => router.navigate('/')}
          />
        </>
      )}
    </Screen>
  );
}
function ManagerEditor({
  userId,
  personId,
}: {
  userId: string;
  personId: string;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const managers = useQuery({
    queryKey: [...familyKeys.root(userId), 'delegates'],
    queryFn: listMyManagers,
  });
  const families = useFamilies(userId, personId);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const selectedFamily =
    families.data?.find((family) => family.id === familyId) ??
    families.data?.[0];
  const [pending, setPending] = useState<
    (ManagerChange & { name: string }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () =>
    client.invalidateQueries({ queryKey: familyKeys.root(userId) });
  const change = useMutation({
    mutationFn: setPersonManager,
    networkMode: 'always',
    onSuccess: refresh,
    onError: refresh,
  });
  const confirm = async () => {
    if (!pending || change.isPending) return;
    setError(null);
    try {
      await change.mutateAsync(pending);
      setPending(null);
    } catch (failure) {
      const code =
        typeof failure === 'object' && failure !== null && 'code' in failure
          ? failure.code
          : null;
      setError(
        t(
          code === 'PT409'
            ? 'delegation.stale'
            : code === '42501'
              ? 'families.errors.permission'
              : 'families.errors.save',
        ),
      );
    }
  };
  if (pending)
    return (
      <View style={styles.card}>
        <Text role="heading" style={styles.subtitle}>
          {t(
            pending.enabled
              ? 'delegation.grantTitle'
              : 'delegation.revokeTitle',
            { name: pending.name },
          )}
        </Text>
        <Text style={styles.body}>
          {t(
            pending.enabled
              ? 'delegation.grantWarning'
              : 'delegation.revokeWarning',
          )}
        </Text>
        {error ? (
          <Text role="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <AppButton
          label={t(
            pending.enabled
              ? 'delegation.confirmGrant'
              : 'delegation.confirmRevoke',
          )}
          loading={change.isPending}
          onPress={() => void confirm()}
        />
        <AppButton
          label={t('families.cancel')}
          variant="secondary"
          disabled={change.isPending}
          onPress={() => {
            setPending(null);
            setError(null);
          }}
        />
      </View>
    );
  return (
    <View style={styles.stack}>
      <Text style={styles.body}>{t('delegation.explanation')}</Text>
      <View style={styles.card}>
        <Text role="heading" style={styles.subtitle}>
          {t('delegation.current')}
        </Text>
        {managers.isPending ? (
          <Text role="status">{t('app.loading')}</Text>
        ) : null}
        {managers.isError ? (
          <Text role="alert" style={styles.error}>
            {t('families.errors.load')}
          </Text>
        ) : null}
        {managers.data?.length === 0 ? (
          <Text style={styles.body}>{t('delegation.empty')}</Text>
        ) : null}
        {managers.data?.map((manager) => {
          const name = manager.display_name || t('delegation.unavailable');
          return (
            <AppButton
              key={manager.manager_user_id}
              label={t('delegation.revokeTitle', { name })}
              variant="secondary"
              onPress={() =>
                setPending({
                  managerUserId: manager.manager_user_id,
                  enabled: false,
                  expectedEnabled: true,
                  name,
                })
              }
            />
          );
        })}
      </View>
      <View style={styles.card}>
        <Text role="heading" style={styles.subtitle}>
          {t('delegation.choose')}
        </Text>
        {families.isPending ? (
          <Text role="status">{t('app.loading')}</Text>
        ) : null}
        {families.isError ? (
          <Text role="alert" style={styles.error}>
            {t('families.errors.load')}
          </Text>
        ) : null}
        {families.data?.length === 0 ? (
          <Text style={styles.body}>{t('delegation.noFamily')}</Text>
        ) : null}
        {families.data?.map((family) => (
          <AppButton
            key={family.id}
            label={family.name}
            variant={family.id === selectedFamily?.id ? 'primary' : 'secondary'}
            accessibilityState={{
              selected: family.id === selectedFamily?.id,
            }}
            onPress={() => setFamilyId(family.id)}
          />
        ))}
        {selectedFamily && managers.data ? (
          <Candidates
            key={selectedFamily.id}
            familyId={selectedFamily.id}
            userId={userId}
            managerIds={managers.data.map((entry) => entry.manager_user_id)}
            onChoose={setPending}
          />
        ) : null}
      </View>
      <AppButton
        label={t('families.refresh')}
        variant="secondary"
        disabled={managers.isFetching || families.isFetching}
        onPress={() => void refresh()}
      />
    </View>
  );
}
function Candidates({
  userId,
  familyId,
  managerIds,
  onChoose,
}: {
  userId: string;
  familyId: string;
  managerIds: string[];
  onChoose: (values: ManagerChange & { name: string }) => void;
}) {
  const { t } = useTranslation();
  const people = useFamilyPeople(userId, familyId);
  const candidates = people.data?.filter(
    ({ person }) =>
      person.user_id &&
      person.user_id !== userId &&
      !managerIds.includes(person.user_id),
  );
  return (
    <View style={styles.stack}>
      {people.isPending ? <Text role="status">{t('app.loading')}</Text> : null}
      {people.isError ? (
        <>
          <Text role="alert" style={styles.error}>
            {t('families.errors.load')}
          </Text>
          <AppButton
            label={t('families.retry')}
            onPress={() => void people.refetch()}
          />
        </>
      ) : null}
      {candidates?.length === 0 ? (
        <Text style={styles.body}>{t('delegation.noCandidates')}</Text>
      ) : null}
      {candidates?.map(({ person }) => (
        <AppButton
          key={person.id}
          label={t('delegation.grantTitle', { name: person.display_name })}
          variant="secondary"
          onPress={() =>
            onChoose({
              managerUserId: person.user_id!,
              familyId,
              enabled: true,
              expectedEnabled: false,
              name: person.display_name,
            })
          }
        />
      ))}
    </View>
  );
}

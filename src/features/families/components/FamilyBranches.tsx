import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';

import type { Family, FamilyPerson } from '../api';
import { onboardingErrorKey } from '../forms';
import { familyKeys, useFamilyActions, useFamilyBranches } from '../queries';

import { DetailsForm } from './DetailsForm';
import { styles } from './styles';

export function FamilyBranches({
  userId,
  family,
  people,
  onClose,
}: {
  userId: string;
  family: Family;
  people: FamilyPerson[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const branches = useFamilyBranches(userId, family.id);
  const queryClient = useQueryClient();
  const refreshing = useIsFetching({ queryKey: familyKeys.root(userId) }) > 0;
  const actions = useFamilyActions(userId);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = family.role === 'OWNER' || family.role === 'ADMIN';
  const selected = branches.data?.find((branch) => branch.id === selectedId);
  const memberIds = new Set(
    selected?.branch_memberships.map((member) => member.person_id),
  );
  const busy = actions.setBranchMember.isPending;
  const refresh = () => {
    setError(null);
    void queryClient.invalidateQueries({ queryKey: familyKeys.root(userId) });
  };
  const changeMember = async (personId: string, expectedMember: boolean) => {
    if (!selected) return;
    setError(null);
    try {
      await actions.setBranchMember.mutateAsync({
        familyId: family.id,
        branchId: selected.id,
        personId,
        expectedMember,
        isMember: !expectedMember,
      });
    } catch (failure) {
      setError(
        typeof failure === 'object' &&
          failure !== null &&
          'code' in failure &&
          failure.code === 'PT409'
          ? 'families.branches.stale'
          : onboardingErrorKey(failure),
      );
    }
  };
  return (
    <View style={styles.card}>
      <Text role="heading" style={styles.title}>
        {selected?.name ?? t('families.branches.title')}
      </Text>
      {creating && canManage ? (
        <DetailsForm
          kind="branch"
          submitLabel={t('families.branches.create')}
          onCancel={() => setCreating(false)}
          onSave={async (values) => {
            const id = await actions.createBranch.mutateAsync({
              ...values,
              familyId: family.id,
            });
            setCreating(false);
            setSelectedId(id);
          }}
        />
      ) : (
        <>
          <Text style={styles.body}>{t('families.branches.explanation')}</Text>
          {branches.isPending ? (
            <Text role="status">{t('app.loading')}</Text>
          ) : null}
          {branches.isError ? (
            <Text role="alert" style={styles.error}>
              {t('families.errors.load')}
            </Text>
          ) : null}
          {error ? (
            <Text role="alert" style={styles.error}>
              {t(error as 'families.errors.save')}
            </Text>
          ) : null}
          {selected ? (
            <>
              {selected.description ? (
                <Text style={styles.body}>{selected.description}</Text>
              ) : null}
              <Text role="heading" style={styles.subtitle}>
                {t('families.branches.member')}
              </Text>
              {!people.some(({ person }) => memberIds.has(person.id)) ? (
                <Text style={styles.body}>
                  {t('families.branches.emptyMembers')}
                </Text>
              ) : null}
              {people
                .filter(({ person }) => memberIds.has(person.id))
                .map(({ person }) => (
                  <View key={person.id} style={styles.stack}>
                    <Text style={styles.body}>{person.display_name}</Text>
                    {canManage ? (
                      <AppButton
                        label={t('families.branches.remove', {
                          name: person.display_name,
                        })}
                        variant="secondary"
                        disabled={busy}
                        onPress={() => void changeMember(person.id, true)}
                      />
                    ) : null}
                  </View>
                ))}
              {canManage ? (
                <>
                  <Text style={styles.body}>
                    {t('families.branches.removeExplanation')}
                  </Text>
                  <Text role="heading" style={styles.subtitle}>
                    {t('families.branches.other')}
                  </Text>
                  {people
                    .filter(({ person }) => !memberIds.has(person.id))
                    .map(({ person }) => (
                      <AppButton
                        key={person.id}
                        label={t('families.branches.add', {
                          name: person.display_name,
                        })}
                        variant="secondary"
                        disabled={busy}
                        onPress={() => void changeMember(person.id, false)}
                      />
                    ))}
                </>
              ) : null}
              <AppButton
                label={t('families.branches.backList')}
                disabled={busy}
                variant="secondary"
                onPress={() => {
                  setSelectedId(null);
                  setError(null);
                }}
              />
            </>
          ) : (
            <>
              {branches.data?.length === 0 ? (
                <Text style={styles.body}>{t('families.branches.empty')}</Text>
              ) : null}
              {branches.data?.map((branch) => (
                <AppButton
                  key={branch.id}
                  label={branch.name}
                  variant="secondary"
                  onPress={() => {
                    setSelectedId(branch.id);
                    setError(null);
                  }}
                />
              ))}
              {canManage ? (
                <AppButton
                  label={t('families.branches.create')}
                  onPress={() => setCreating(true)}
                />
              ) : null}
            </>
          )}
          <AppButton
            label={t('families.refresh')}
            disabled={busy || refreshing}
            variant="secondary"
            onPress={refresh}
          />
          <AppButton
            label={t('families.branches.back')}
            disabled={busy}
            variant="secondary"
            onPress={onClose}
          />
        </>
      )}
    </View>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';

import type { Family, Person } from '../api';
import {
  useCurrentPerson,
  useFamilies,
  useFamilyActions,
  useFamilyPeople,
} from '../queries';
import { useFamilySelection } from '../useFamilySelection';

import { ClaimForm } from './ClaimForm';
import { DetailsForm } from './DetailsForm';
import { IssueClaimForm } from './IssueClaimForm';
import { styles } from './styles';

function LoadError({ retry }: { retry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.stack}>
      <Text role="alert" style={styles.error}>
        {t('families.errors.load')}
      </Text>
      <AppButton label={t('families.retry')} onPress={retry} />
    </View>
  );
}

export function FamilyWorkspace({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const person = useCurrentPerson(userId);
  const actions = useFamilyActions(userId);
  const [claiming, setClaiming] = useState(false);
  if (person.isPending)
    return (
      <Text role="status" style={styles.body}>
        {t('app.loading')}
      </Text>
    );
  if (person.isError) return <LoadError retry={() => void person.refetch()} />;
  if (!person.data)
    return (
      <View style={styles.card}>
        <Text role="heading" style={styles.title}>
          {t('families.onboardingTitle')}
        </Text>
        {claiming ? (
          <ClaimForm
            onClaim={actions.claim.mutateAsync}
            onCancel={() => setClaiming(false)}
          />
        ) : (
          <>
            <Text style={styles.body}>
              {t('families.onboardingExplanation')}
            </Text>
            <DetailsForm
              kind="person"
              submitLabel={t('families.createProfile')}
              onSave={actions.onboard.mutateAsync}
            />
            <AppButton
              label={t('families.haveClaimCode')}
              variant="secondary"
              onPress={() => setClaiming(true)}
            />
          </>
        )}
      </View>
    );
  return <FamilyDashboard userId={userId} person={person.data} />;
}

const noFamilies: Family[] = [];

function FamilyDashboard({
  userId,
  person,
}: {
  userId: string;
  person: Person;
}) {
  const { t } = useTranslation();
  const families = useFamilies(userId, person.id);
  const actions = useFamilyActions(userId);
  const selection = useFamilySelection(userId, families.data ?? noFamilies);
  const [creating, setCreating] = useState(false);
  if (families.isPending || !selection.ready)
    return (
      <Text role="status" style={styles.body}>
        {t('app.loading')}
      </Text>
    );
  if (families.isError)
    return <LoadError retry={() => void families.refetch()} />;
  if (creating)
    return (
      <View style={styles.card}>
        <Text role="heading" style={styles.title}>
          {t('families.createFamily')}
        </Text>
        <Text style={styles.body}>{t('families.ownerExplanation')}</Text>
        <DetailsForm
          kind="family"
          submitLabel={t('families.createFamily')}
          onCancel={() => setCreating(false)}
          onSave={async (values) => {
            const id = await actions.createFamily.mutateAsync(values);
            selection.select(id);
            setCreating(false);
          }}
        />
      </View>
    );
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text role="heading" style={styles.title}>
          {t('families.welcome', { name: person.display_name })}
        </Text>
        <Text style={styles.body}>{t('families.identityExplanation')}</Text>
        <Text role="heading" style={styles.subtitle}>
          {t('families.yourFamilies')}
        </Text>
        {families.data.length === 0 ? (
          <Text style={styles.body}>{t('families.noFamilies')}</Text>
        ) : null}
        {families.data.map((family) => (
          <AppButton
            key={family.id}
            label={family.name}
            variant={
              family.id === selection.selected?.id ? 'primary' : 'secondary'
            }
            accessibilityState={{
              selected: family.id === selection.selected?.id,
            }}
            onPress={() => selection.select(family.id)}
          />
        ))}
        <AppButton
          label={t('families.createFamily')}
          variant="secondary"
          onPress={() => setCreating(true)}
        />
        <AppButton
          label={t('families.refresh')}
          variant="secondary"
          onPress={() => void families.refetch()}
        />
      </View>
      {selection.selected ? (
        <FamilyPanel
          key={selection.selected.id}
          family={selection.selected}
          userId={userId}
        />
      ) : null}
    </View>
  );
}

function FamilyPanel({ family, userId }: { family: Family; userId: string }) {
  const { t } = useTranslation();
  const people = useFamilyPeople(userId, family.id);
  const actions = useFamilyActions(userId);
  const [adding, setAdding] = useState(false);
  const [claimTarget, setClaimTarget] = useState<Person | null>(null);
  const canAdd = family.role === 'OWNER' || family.role === 'ADMIN';
  if (people.isPending)
    return (
      <Text role="status" style={styles.body}>
        {t('app.loading')}
      </Text>
    );
  if (people.isError) return <LoadError retry={() => void people.refetch()} />;
  // Recheck current server-derived permissions before keeping an editor open.
  const claimPerson = people.data.find(
    ({ person, canIssueClaim }) =>
      person.id === claimTarget?.id && canIssueClaim,
  )?.person;
  if (claimPerson)
    return (
      <View style={styles.card}>
        <Text role="heading" style={styles.title}>
          {t('families.claimFor', { name: claimPerson.display_name })}
        </Text>
        <IssueClaimForm
          onIssue={(email) =>
            actions.issueClaim.mutateAsync({ personId: claimPerson.id, email })
          }
          onCancel={() => {
            actions.issueClaim.reset();
            setClaimTarget(null);
          }}
        />
      </View>
    );
  if (adding && canAdd)
    return (
      <View style={styles.card}>
        <Text role="heading" style={styles.title}>
          {t('families.addPerson')}
        </Text>
        <Text style={styles.body}>{t('families.managedExplanation')}</Text>
        <DetailsForm
          kind="person"
          submitLabel={t('families.addPerson')}
          onCancel={() => setAdding(false)}
          onSave={async (values) => {
            await actions.createManaged.mutateAsync({
              ...values,
              familyId: family.id,
            });
            setAdding(false);
          }}
        />
      </View>
    );
  return (
    <View style={styles.card}>
      <Text role="heading" style={styles.title}>
        {family.name}
      </Text>
      {family.description ? (
        <Text style={styles.body}>{family.description}</Text>
      ) : null}
      <Text style={styles.body}>
        {t('families.yourRole', { role: t(`families.roles.${family.role}`) })}
      </Text>
      <Text role="heading" style={styles.subtitle}>
        {t('families.people')}
      </Text>
      {people.data.map(({ person, role, canIssueClaim }) => (
        <View style={styles.stack} key={person.id}>
          <Text style={styles.subtitle}>{person.display_name}</Text>
          <Text style={styles.body}>
            {t('families.personSummary', {
              role: t(`families.roles.${role}`),
              status: t(
                person.user_id ? 'families.linked' : 'families.managed',
              ),
            })}
          </Text>
          {person.biography ? (
            <Text style={styles.body}>{person.biography}</Text>
          ) : null}
          {canIssueClaim ? (
            <AppButton
              label={t('families.claimFor', { name: person.display_name })}
              variant="secondary"
              onPress={() => setClaimTarget(person)}
            />
          ) : null}
        </View>
      ))}
      {canAdd ? (
        <AppButton
          label={t('families.addPerson')}
          onPress={() => setAdding(true)}
        />
      ) : null}
      <AppButton
        label={t('families.refreshPeople')}
        variant="secondary"
        onPress={() => void people.refetch()}
      />
    </View>
  );
}

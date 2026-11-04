import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';

import type { Family, Person, FamilyRole } from '../api';
import {
  useCurrentPerson,
  useFamilies,
  useFamilyActions,
  useFamilyPeople,
  useFamilyRelationships,
} from '../queries';
import {
  allowedFamilyRoles,
  canRemoveFamilyMember,
  canTransferFamilyOwnership,
} from '../roles';
import { useFamilySelection } from '../useFamilySelection';

import { ClaimForm } from './ClaimForm';
import { DetailsForm } from './DetailsForm';
import { DetailsSheet } from './DetailsSheet';
import { FamilyBranches } from './FamilyBranches';
import { FamilyTree } from './FamilyTree';
import { IssueClaimForm } from './IssueClaimForm';
import { MembershipConfirmation } from './MembershipConfirmation';
import { RoleForm } from './RoleForm';
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
  const { t, i18n } = useTranslation();
  const people = useFamilyPeople(userId, family.id);
  const relationships = useFamilyRelationships(userId, family.id);
  const actions = useFamilyActions(userId);
  const [adding, setAdding] = useState(false);
  const [claimTarget, setClaimTarget] = useState<Person | null>(null);
  const [membershipAction, setMembershipAction] = useState<{
    kind: 'remove' | 'transfer';
    personId: string;
    expectedRole: FamilyRole;
  } | null>(null);
  const [branchesOpen, setBranchesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [roleTargetId, setRoleTargetId] = useState<string | null>(null);
  const canAdd = family.role === 'OWNER' || family.role === 'ADMIN';
  if (people.isPending)
    return (
      <Text role="status" style={styles.body}>
        {t('app.loading')}
      </Text>
    );
  if (people.isError) return <LoadError retry={() => void people.refetch()} />;
  if (branchesOpen)
    return (
      <FamilyBranches
        userId={userId}
        family={family}
        people={people.data}
        onClose={() => setBranchesOpen(false)}
      />
    );
  const membershipTarget = people.data.find(
    ({ person, role }) =>
      person.id === membershipAction?.personId &&
      (membershipAction.kind === 'remove'
        ? canRemoveFamilyMember(family.role, role)
        : canTransferFamilyOwnership(
            family.role,
            role,
            person.user_id,
            userId,
          )),
  );
  if (membershipAction && membershipTarget)
    return (
      <View style={styles.card}>
        <MembershipConfirmation
          key={`${membershipAction.kind}:${membershipTarget.person.id}`}
          kind={membershipAction.kind}
          name={membershipTarget.person.display_name}
          familyName={family.name}
          values={{
            familyId: family.id,
            personId: membershipTarget.person.id,
            expectedRole: membershipAction.expectedRole,
          }}
          onConfirm={
            membershipAction.kind === 'remove'
              ? actions.removeMember.mutateAsync
              : actions.transferOwnership.mutateAsync
          }
          onCancel={() => {
            setMembershipAction(null);
            setSelectedPersonId(membershipTarget.person.id);
          }}
          onDone={() => setMembershipAction(null)}
        />
      </View>
    );
  const roleTarget = people.data.find(
    ({ person, role }) =>
      person.id === roleTargetId &&
      allowedFamilyRoles(family.role, role).length > 0,
  );
  if (roleTarget)
    return (
      <View style={styles.card}>
        <RoleForm
          key={`${roleTarget.person.id}:${roleTarget.role}`}
          actorRole={family.role}
          currentRole={roleTarget.role}
          familyId={family.id}
          personId={roleTarget.person.id}
          name={roleTarget.person.display_name}
          onSave={actions.changeRole.mutateAsync}
          onCancel={() => setRoleTargetId(null)}
        />
      </View>
    );
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
      <Pressable
        role="button"
        accessibilityLabel={t('families.openDetails', { name: family.name })}
        onPress={() => setDetailsOpen(true)}
        style={styles.familyHeading}
      >
        <Text style={styles.title}>{family.name}</Text>
        <Text style={styles.personNodeMeta}>{t('families.viewDetails')}</Text>
      </Pressable>
      <Text style={styles.body}>
        {t('families.yourRole', { role: t(`families.roles.${family.role}`) })}
      </Text>
      {detailsOpen ? (
        <DetailsSheet title={family.name} onClose={() => setDetailsOpen(false)}>
          {family.description ? (
            <Text style={styles.body}>{family.description}</Text>
          ) : null}
          <Text style={styles.body}>
            {t('families.createdBy', {
              name:
                people.data.find(
                  ({ person }) => person.user_id === family.created_by_user_id,
                )?.person.display_name ?? t('families.unavailableCreator'),
            })}
          </Text>
          {family.created_at &&
          Number.isFinite(Date.parse(family.created_at)) ? (
            <Text style={styles.body}>
              {t('families.createdOn', {
                date: new Date(family.created_at).toLocaleDateString(
                  i18n.language,
                ),
              })}
            </Text>
          ) : null}
          <Text style={styles.body}>
            {t('families.memberCount', { count: people.data.length })}
          </Text>
          <Text style={styles.body}>
            {t('families.yourRole', {
              role: t(`families.roles.${family.role}`),
            })}
          </Text>
          <AppButton
            label={t('families.branches.title')}
            onPress={() => {
              setDetailsOpen(false);
              setBranchesOpen(true);
            }}
          />
        </DetailsSheet>
      ) : null}
      {selectedPersonId &&
      people.data.some(({ person }) => person.id === selectedPersonId) ? (
        <DetailsSheet
          title={t('families.personDetails')}
          onClose={() => setSelectedPersonId(null)}
        >
          {people.data
            .filter(({ person }) => person.id === selectedPersonId)
            .map(({ person, role, canIssueClaim }) => (
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
                {(relationships.data ?? [])
                  .filter(
                    (link) =>
                      link.from_person_id === person.id ||
                      link.to_person_id === person.id,
                  )
                  .map((link) => {
                    const from = people.data.find(
                      (entry) => entry.person.id === link.from_person_id,
                    )?.person.display_name;
                    const to = people.data.find(
                      (entry) => entry.person.id === link.to_person_id,
                    )?.person.display_name;
                    if (!from || !to) return null;
                    return (
                      <Text key={link.id} style={styles.body}>
                        {t(
                          link.kind === 'PARTNER'
                            ? 'families.tree.partnerLink'
                            : 'families.tree.parentLink',
                          { from, to },
                        )}
                      </Text>
                    );
                  })}
                {canRemoveFamilyMember(family.role, role) ? (
                  <AppButton
                    label={t('families.membership.removeTitle', {
                      name: person.display_name,
                    })}
                    variant="secondary"
                    onPress={() => {
                      setSelectedPersonId(null);
                      setMembershipAction({
                        kind: 'remove',
                        personId: person.id,
                        expectedRole: role,
                      });
                    }}
                  />
                ) : null}
                {canTransferFamilyOwnership(
                  family.role,
                  role,
                  person.user_id,
                  userId,
                ) ? (
                  <AppButton
                    label={t('families.membership.transferTitle', {
                      name: person.display_name,
                    })}
                    variant="secondary"
                    onPress={() => {
                      setSelectedPersonId(null);
                      setMembershipAction({
                        kind: 'transfer',
                        personId: person.id,
                        expectedRole: role,
                      });
                    }}
                  />
                ) : null}
                {allowedFamilyRoles(family.role, role).length > 0 ? (
                  <AppButton
                    label={t('families.roleManagement.edit', {
                      name: person.display_name,
                    })}
                    variant="secondary"
                    onPress={() => {
                      setSelectedPersonId(null);
                      setRoleTargetId(person.id);
                    }}
                  />
                ) : null}
                {canIssueClaim ? (
                  <AppButton
                    label={t('families.claimFor', {
                      name: person.display_name,
                    })}
                    variant="secondary"
                    onPress={() => {
                      setSelectedPersonId(null);
                      setClaimTarget(person);
                    }}
                  />
                ) : null}
              </View>
            ))}
        </DetailsSheet>
      ) : null}
      {canAdd ? (
        <AppButton
          label={t('families.addPerson')}
          onPress={() => setAdding(true)}
        />
      ) : null}
      {relationships.isPending ? (
        <Text role="status" style={styles.body}>
          {t('app.loading')}
        </Text>
      ) : relationships.isError ? (
        <View style={styles.treeSection}>
          <Text role="heading" style={styles.subtitle}>
            {t('families.tree.title')}
          </Text>
          {people.data.map(({ person }) => (
            <AppButton
              key={person.id}
              label={person.display_name}
              variant="secondary"
              onPress={() => setSelectedPersonId(person.id)}
            />
          ))}
          <Text role="alert" style={styles.error}>
            {t('families.tree.errors.load')}
          </Text>
          <AppButton
            label={t('families.retry')}
            variant="secondary"
            onPress={() => void relationships.refetch()}
          />
        </View>
      ) : (
        <FamilyTree
          onSelectPerson={setSelectedPersonId}
          canManage={canAdd}
          familyId={family.id}
          people={people.data}
          relationships={relationships.data.filter(
            (link) =>
              people.data.some(
                ({ person }) => person.id === link.from_person_id,
              ) &&
              people.data.some(({ person }) => person.id === link.to_person_id),
          )}
          onCreate={actions.createRelationship.mutateAsync}
          onDelete={actions.deleteRelationship.mutateAsync}
        />
      )}
      <AppButton
        label={t('families.refreshPeople')}
        variant="secondary"
        onPress={() => void people.refetch()}
      />
    </View>
  );
}

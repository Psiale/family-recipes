import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Screen, ScrollIntoView } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';

import {
  listDeletionRequests,
  searchFamilies,
  type DirectoryFamily,
  type FamilyPerson,
} from '../api';
import { familyKeys, useFamilyPeople, useSuperAdmin } from '../queries';

import { FamilyDetailsSummary } from './FamilyDetailsSummary';
import { FamilyLifecyclePanel } from './FamilyLifecyclePanel';
import { PersonAdministration } from './PersonAdministration';
import { ProfileDeletion } from './ProfileDeletion';
import { styles } from './styles';

function LoadError({ retry }: { retry: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Text role="alert" style={styles.error}>
        {t('families.errors.load')}
      </Text>
      <AppButton label={t('families.retry')} onPress={retry} />
    </>
  );
}

export function FamilyAdministration({ userId }: { userId: string }) {
  const role = useSuperAdmin(userId);
  const { t } = useTranslation();
  return (
    <Screen contentStyle={styles.stack}>
      {role.isError || role.fetchStatus === 'paused' ? (
        <LoadError retry={() => void role.refetch()} />
      ) : role.isPending || !role.isFetchedAfterMount ? (
        <Text role="status">{t('app.loading')}</Text>
      ) : role.data ? (
        <Directory userId={userId} />
      ) : (
        <Text role="alert" style={styles.error}>
          {t('administration.denied')}
        </Text>
      )}
    </Screen>
  );
}

function Directory({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<DirectoryFamily | null>(null);
  const [done, setDone] = useState(false);
  const results = useQuery({
    queryKey: [...familyKeys.root(userId), 'directory', search, page],
    queryFn: () => searchFamilies(search, page),
  });
  const submit = () => {
    Keyboard.dismiss();
    setDone(false);
    setPage(0);
    setSearch(input.trim());
  };
  if (selected)
    return (
      <Inspection
        userId={userId}
        family={selected}
        onClose={() => setSelected(null)}
        onComplete={() => setDone(true)}
      />
    );
  return (
    <>
      <TextField
        label={t('administration.name')}
        value={input}
        onChangeText={setInput}
        returnKeyType="search"
        onSubmitEditing={submit}
      />
      <AppButton label={t('administration.search')} onPress={submit} />
      {done && <Text role="status">{t('familyLifecycle.done')}</Text>}
      {results.isError || results.fetchStatus === 'paused' ? (
        <LoadError retry={() => void results.refetch()} />
      ) : results.isPending ? (
        <Text role="status">{t('app.loading')}</Text>
      ) : (
        <>
          {!results.data.families.length && (
            <Text>{t('administration.empty')}</Text>
          )}
          {results.data.families.map((f) => (
            <AppButton
              key={f.id}
              variant="secondary"
              label={f.name}
              onPress={() => {
                setDone(false);
                setSelected(f);
              }}
            />
          ))}
          {results.data.more && (
            <AppButton
              label={t('administration.next')}
              onPress={() => setPage(page + 1)}
            />
          )}
        </>
      )}
      {page > 0 && (
        <AppButton
          label={t('administration.previous')}
          onPress={() => setPage(page - 1)}
        />
      )}
    </>
  );
}

function Inspection({
  userId,
  family,
  onClose,
  onComplete,
}: {
  userId: string;
  family: DirectoryFamily;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { t, i18n } = useTranslation();
  const people = useFamilyPeople(userId, family.id);
  // Keep the exact roster snapshot the user chose, even during a refetch.
  const [selection, setSelection] = useState<{
    member: FamilyPerson;
    action: 'rename' | 'remove' | 'deleteProfile';
  } | null>(null);
  const [personDone, setPersonDone] = useState(false);
  const requests = useQuery({
    queryKey: [...familyKeys.root(userId), 'request', family.id],
    queryFn: () => listDeletionRequests(family.id),
  });
  if (selection?.action === 'deleteProfile')
    return (
      <ProfileDeletion
        userId={userId}
        personId={selection.member.person.id}
        onClose={() => setSelection(null)}
        onDone={() => {
          setSelection(null);
          setPersonDone(true);
        }}
      />
    );
  if (selection)
    return (
      <PersonAdministration
        userId={userId}
        family={family}
        member={selection.member}
        action={selection.action}
        onClose={() => setSelection(null)}
        onDone={() => {
          setSelection(null);
          setPersonDone(true);
        }}
      />
    );
  if (
    people.isError ||
    requests.isError ||
    people.fetchStatus === 'paused' ||
    requests.fetchStatus === 'paused'
  )
    return (
      <>
        <AppButton label={t('administration.back')} onPress={onClose} />
        <LoadError
          retry={() => {
            void people.refetch();
            void requests.refetch();
          }}
        />
      </>
    );
  if (!people.data || !requests.data)
    return (
      <>
        <AppButton label={t('administration.back')} onPress={onClose} />
        <Text role="status">{t('app.loading')}</Text>
      </>
    );
  const request = requests.data[0];
  return (
    <>
      <View style={styles.card}>
        <ScrollIntoView>
          <Text role="heading" style={styles.title}>
            {family.name}
          </Text>
        </ScrollIntoView>
        <FamilyDetailsSummary family={family} people={people.data} />
        {personDone && (
          <Text role="status">{t('personAdministration.done')}</Text>
        )}
        {people.data.map((member) => (
          <View key={member.person.id} style={styles.card}>
            <Text style={styles.body}>
              {member.person.display_name} ·{' '}
              {t(`families.roles.${member.role}`)}
            </Text>
            {(['rename', 'remove', 'deleteProfile'] as const).map((action) => (
              <AppButton
                key={action}
                variant="secondary"
                label={t(`personAdministration.${action}`, {
                  name: member.person.display_name,
                })}
                onPress={() => {
                  setPersonDone(false);
                  setSelection({ member, action });
                }}
              />
            ))}
          </View>
        ))}
      </View>
      {request ? (
        <View style={styles.card}>
          <Text style={styles.subtitle}>
            {t('familyLifecycle.pending', { family: family.name })}
          </Text>
          <Text style={styles.body}>
            {t('administration.requestedBy', {
              name:
                people.data.find(
                  ({ person }) =>
                    person.user_id === request.requested_by_user_id,
                )?.person.display_name ?? t('families.unavailableCreator'),
            })}
          </Text>
          <Text style={styles.body}>
            {t('administration.expires', {
              date: new Date(request.expires_at).toLocaleString(i18n.language),
            })}
          </Text>
        </View>
      ) : (
        <Text>{t('administration.noRequest')}</Text>
      )}
      <FamilyLifecyclePanel
        target={family}
        userId={userId}
        request={request}
        superAdminAllowed
        directory
        ready
        onClose={onClose}
        onComplete={onComplete}
      />
    </>
  );
}

import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';

import type { DirectoryFamily, FamilyPerson } from '../api';

import { styles } from './styles';

export function FamilyDetailsSummary({
  family,
  people,
}: {
  family: DirectoryFamily;
  people: FamilyPerson[];
}) {
  const { t, i18n } = useTranslation();
  return (
    <>
      {family.description ? (
        <Text style={styles.body}>{family.description}</Text>
      ) : null}
      <Text style={styles.body}>
        {t('families.createdBy', {
          name:
            people.find(
              ({ person }) => person.user_id === family.created_by_user_id,
            )?.person.display_name ?? t('families.unavailableCreator'),
        })}
      </Text>
      {family.created_at && Number.isFinite(Date.parse(family.created_at)) ? (
        <Text style={styles.body}>
          {t('families.createdOn', {
            date: new Date(family.created_at).toLocaleDateString(i18n.language),
          })}
        </Text>
      ) : null}
      <Text style={styles.body}>
        {t('families.memberCount', { count: people.length })}
      </Text>
    </>
  );
}

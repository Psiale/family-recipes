import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';

import type {
  FamilyPerson,
  FamilyRelationship,
  RelationshipValues,
} from '../api';

import { RelationshipForm } from './RelationshipForm';
import { styles } from './styles';

export function buildTreeGenerations(
  people: FamilyPerson[],
  relationships: FamilyRelationship[],
) {
  const parentLinks = relationships.filter(
    ({ kind }) => kind === 'PARENT_CHILD',
  );
  const childIds = new Set(parentLinks.map(({ to_person_id }) => to_person_id));
  const generations = new Map<string, number>();

  people.forEach(({ person }) => {
    if (!childIds.has(person.id)) generations.set(person.id, 0);
  });

  for (let pass = 0; pass < people.length; pass += 1) {
    let changed = false;
    parentLinks.forEach(({ from_person_id, to_person_id }) => {
      const parentGeneration = generations.get(from_person_id);
      if (parentGeneration === undefined) return;
      const nextGeneration = parentGeneration + 1;
      if ((generations.get(to_person_id) ?? -1) < nextGeneration) {
        generations.set(to_person_id, nextGeneration);
        changed = true;
      }
    });
    if (!changed) break;
  }

  people.forEach(({ person }) => {
    if (!generations.has(person.id)) generations.set(person.id, 0);
  });

  const grouped = new Map<number, FamilyPerson[]>();
  people.forEach((entry) => {
    const generation = generations.get(entry.person.id) ?? 0;
    grouped.set(generation, [...(grouped.get(generation) ?? []), entry]);
  });
  return [...grouped.entries()].sort(([left], [right]) => left - right);
}

export function FamilyTree({
  canManage,
  familyId,
  people,
  relationships,
  onCreate,
  onDelete,
}: {
  canManage: boolean;
  familyId: string;
  people: FamilyPerson[];
  relationships: FamilyRelationship[];
  onCreate: (values: RelationshipValues) => Promise<unknown>;
  onDelete: (relationshipId: string) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const peopleById = useMemo(
    () => new Map(people.map(({ person }) => [person.id, person])),
    [people],
  );
  const generations = useMemo(
    () => buildTreeGenerations(people, relationships),
    [people, relationships],
  );
  const parentsByChild = useMemo(() => {
    const result = new Map<string, string[]>();
    relationships
      .filter(({ kind }) => kind === 'PARENT_CHILD')
      .forEach(({ from_person_id, to_person_id }) => {
        const name = peopleById.get(from_person_id)?.display_name;
        if (name)
          result.set(to_person_id, [...(result.get(to_person_id) ?? []), name]);
      });
    return result;
  }, [peopleById, relationships]);
  const partnersByPerson = useMemo(() => {
    const result = new Map<string, string[]>();
    relationships
      .filter(({ kind }) => kind === 'PARTNER')
      .forEach(({ from_person_id, to_person_id }) => {
        const fromName = peopleById.get(from_person_id)?.display_name;
        const toName = peopleById.get(to_person_id)?.display_name;
        if (toName)
          result.set(from_person_id, [
            ...(result.get(from_person_id) ?? []),
            toName,
          ]);
        if (fromName)
          result.set(to_person_id, [
            ...(result.get(to_person_id) ?? []),
            fromName,
          ]);
      });
    return result;
  }, [peopleById, relationships]);

  if (adding)
    return (
      <View style={styles.treeSection}>
        <Text role="heading" style={styles.subtitle}>
          {t('families.tree.add')}
        </Text>
        <RelationshipForm
          familyId={familyId}
          people={people}
          onCancel={() => setAdding(false)}
          onSave={async (values) => {
            await onCreate(values);
            setAdding(false);
          }}
        />
      </View>
    );

  return (
    <View style={styles.treeSection}>
      <Text role="heading" style={styles.subtitle}>
        {t('families.tree.title')}
      </Text>
      <Text style={styles.body}>{t('families.tree.explanation')}</Text>
      {relationships.length === 0 ? (
        <Text style={styles.body}>{t('families.tree.empty')}</Text>
      ) : null}
      <View accessibilityLabel={t('families.tree.title')} style={styles.tree}>
        {generations.map(([generation, entries], index) => (
          <View key={generation} style={styles.generation}>
            {index > 0 ? <View style={styles.treeConnector} /> : null}
            <Text style={styles.generationLabel}>
              {t('families.tree.generation', { number: generation + 1 })}
            </Text>
            <View style={styles.treeRow}>
              {entries.map(({ person }) => {
                const parents = parentsByChild.get(person.id) ?? [];
                const partners = partnersByPerson.get(person.id) ?? [];
                return (
                  <View key={person.id} style={styles.personNode}>
                    <Text style={styles.personNodeName}>
                      {person.display_name}
                    </Text>
                    {parents.length ? (
                      <Text style={styles.personNodeMeta}>
                        {t('families.tree.parents', {
                          names: parents.join(', '),
                        })}
                      </Text>
                    ) : null}
                    {partners.length ? (
                      <Text style={styles.personNodeMeta}>
                        {t('families.tree.partners', {
                          names: partners.join(', '),
                        })}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
      {canManage && people.length >= 2 ? (
        <AppButton
          label={t('families.tree.add')}
          onPress={() => setAdding(true)}
        />
      ) : null}
      {canManage && relationships.length ? (
        <View style={styles.stack}>
          <Text style={styles.fieldLabel}>
            {t('families.tree.relationships')}
          </Text>
          {relationships.map((relationship) => {
            const from =
              peopleById.get(relationship.from_person_id)?.display_name ?? '';
            const to =
              peopleById.get(relationship.to_person_id)?.display_name ?? '';
            return (
              <View key={relationship.id} style={styles.relationshipRow}>
                <Text style={styles.relationshipLabel}>
                  {relationship.kind === 'PARENT_CHILD'
                    ? t('families.tree.parentLink', { from, to })
                    : t('families.tree.partnerLink', { from, to })}
                </Text>
                <AppButton
                  label={t('families.tree.remove')}
                  variant="secondary"
                  loading={deletingId === relationship.id}
                  disabled={deletingId !== null}
                  onPress={async () => {
                    setDeletingId(relationship.id);
                    try {
                      await onDelete(relationship.id);
                    } finally {
                      setDeletingId(null);
                    }
                  }}
                />
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

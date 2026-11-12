import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import { colors } from '@/components/theme';

import type {
  FamilyPerson,
  FamilyRelationship,
  RelationshipValues,
} from '../api';
import { AVATAR_SIZE, layoutFamilyTree } from '../treeLayout';

import { RelationshipForm } from './RelationshipForm';
import { styles } from './styles';

export { buildTreeGenerations } from '../treeLayout';

export function FamilyTree({
  canManage,
  familyId,
  people,
  relationships,
  onCreate,
  onDelete,
  onSelectPerson,
}: {
  onSelectPerson?: (personId: string) => void;
  canManage: boolean;
  familyId: string;
  people: FamilyPerson[];
  relationships: FamilyRelationship[];
  onCreate: (values: RelationshipValues) => Promise<unknown>;
  onDelete: (relationshipId: string) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const [showRelationships, setShowRelationships] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const peopleById = useMemo(
    () => new Map(people.map(({ person }) => [person.id, person])),
    [people],
  );
  const layout = useMemo(
    () => layoutFamilyTree(people, relationships, fontScale, viewportWidth),
    [people, relationships, fontScale, viewportWidth],
  );
  useEffect(() => {
    if (viewportWidth > 0)
      scrollRef.current?.scrollTo({
        x: Math.max(0, (layout.width - viewportWidth) / 2),
        animated: false,
      });
  }, [layout.width, viewportWidth, adding]);
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
      <Text style={styles.body}>{t('families.tree.hint')}</Text>
      <View style={styles.treeLegend}>
        <Text style={styles.personNodeMeta}>
          {t('families.tree.parentLegend')}
        </Text>
        <Text style={styles.personNodeMeta}>
          {t('families.tree.partnerLegend')}
        </Text>
      </View>
      <ScrollView
        horizontal
        ref={scrollRef}
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        style={styles.treeCanvas}
        accessibilityLabel={t('families.tree.title')}
      >
        <View style={{ width: layout.width, height: layout.height }}>
          <View
            pointerEvents="none"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={styles.edgeLayer}
          >
            {layout.edges.map(({ relationship, points }) => (
              <View
                key={relationship.id}
                testID={`tree-edge-${relationship.id}`}
              >
                {points.slice(1).map(([x2, y2], index) => {
                  const [x1, y1] = points[index]!;
                  const partner = relationship.kind === 'PARTNER';
                  return (
                    <View
                      key={index}
                      style={{
                        position: 'absolute',
                        left: Math.min(x1, x2),
                        top: Math.min(y1, y2),
                        width: Math.max(2, Math.abs(x2 - x1)),
                        height: Math.max(2, Math.abs(y2 - y1)),
                        borderColor: partner ? colors.partner : colors.primary,
                        borderStyle: partner ? 'dashed' : 'solid',
                        ...(x1 === x2
                          ? { borderLeftWidth: 2 }
                          : { borderTopWidth: 2 }),
                      }}
                    />
                  );
                })}
              </View>
            ))}
          </View>
          {layout.nodes.map(({ person, generation, x, y }) => (
            <Pressable
              key={person.id}
              role="button"
              accessibilityLabel={t('families.tree.openPerson', {
                name: person.display_name,
              })}
              accessibilityHint={[
                t('families.tree.generation', { number: generation + 1 }),
                parentsByChild.has(person.id)
                  ? t('families.tree.parents', {
                      names: parentsByChild.get(person.id)!.join(', '),
                    })
                  : '',
                partnersByPerson.has(person.id)
                  ? t('families.tree.partners', {
                      names: partnersByPerson.get(person.id)!.join(', '),
                    })
                  : '',
              ]
                .filter(Boolean)
                .join('. ')}
              onPress={() => onSelectPerson?.(person.id)}
              style={({ pressed }) => [
                styles.treeNode,
                {
                  left: x,
                  top: y,
                  width: layout.nodeWidth,
                  height: layout.nodeHeight,
                  opacity: pressed ? 0.65 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.avatar,
                  { width: AVATAR_SIZE, height: AVATAR_SIZE },
                ]}
              >
                <Text style={styles.initial} maxFontSizeMultiplier={1.4}>
                  {Array.from(
                    person.display_name.trim(),
                  )[0]?.toLocaleUpperCase() ?? '?'}
                </Text>
              </View>
              <Text numberOfLines={2} style={styles.nodeName}>
                {person.display_name}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {canManage && people.length >= 2 ? (
        <AppButton
          label={t('families.tree.add')}
          onPress={() => setAdding(true)}
        />
      ) : null}
      {canManage && relationships.length ? (
        <AppButton
          label={t('families.tree.relationships')}
          variant="secondary"
          onPress={() => setShowRelationships(!showRelationships)}
          accessibilityState={{ expanded: showRelationships }}
        />
      ) : null}
      {canManage && showRelationships && relationships.length ? (
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

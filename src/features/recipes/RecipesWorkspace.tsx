import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Screen, ScrollIntoView } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { styles } from '@/features/families/components/styles';
import {
  familyKeys,
  useCurrentPerson,
  useFamilies,
} from '@/features/families/queries';

import * as api from './api';
import { RecipeForm } from './RecipeForm';

const keys = (userId: string) => [...familyKeys.root(userId), 'recipes'];
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
export function RecipesWorkspace({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [input, setInput] = useState(''),
    [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<string | null>(null);
  const recipes = useQuery({
    queryKey: [...keys(userId), 'list', search, page],
    queryFn: () => api.listRecipes(search, page),
  });
  return (
    <Screen contentStyle={styles.stack}>
      {creating ? (
        <NewRecipe
          userId={userId}
          onCancel={() => setCreating(false)}
          onDone={(id) => {
            setCreating(false);
            setSelected(id);
          }}
        />
      ) : selected ? (
        <RecipeView
          key={selected}
          id={selected}
          userId={userId}
          onClose={() => setSelected(null)}
        />
      ) : (
        <>
          <Text role="heading" style={styles.title}>
            {t('navigation.recipes')}
          </Text>
          <AppButton
            label={t('recipes.create')}
            onPress={() => setCreating(true)}
          />
          <TextField
            label={t('recipes.search')}
            value={input}
            onChangeText={setInput}
            maxLength={160}
            onSubmitEditing={() => {
              setSearch(input.trim());
              setPage(0);
            }}
            returnKeyType="search"
          />
          <AppButton
            label={t('administration.search')}
            onPress={() => {
              setSearch(input.trim());
              setPage(0);
            }}
          />
          {(recipes.isError || recipes.fetchStatus === 'paused') && (
            <LoadError retry={() => void recipes.refetch()} />
          )}
          {!recipes.data ? (
            !(recipes.isError || recipes.fetchStatus === 'paused') && (
              <Text role="status">{t('app.loading')}</Text>
            )
          ) : (
            <>
              {!recipes.data.recipes.length && (
                <Text style={styles.body}>{t('recipes.empty')}</Text>
              )}
              {recipes.data.recipes.map((r) => (
                <View key={r.id} style={styles.card}>
                  <AppButton
                    label={r.title}
                    variant="secondary"
                    onPress={() => setSelected(r.id)}
                  />
                  <Text>
                    {t('recipes.owner', {
                      name: r.owner_deleted
                        ? t('recipes.anonymous')
                        : r.owner_name,
                    })}
                  </Text>
                  {r.preservation_status === 'PRESERVED' && (
                    <Text>{t('recipes.preserved')}</Text>
                  )}
                </View>
              ))}
              {recipes.data.more && (
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
      )}
    </Screen>
  );
}
function NewRecipe({
  userId,
  onCancel,
  onDone,
}: {
  userId: string;
  onCancel: () => void;
  onDone: (id: string) => void;
}) {
  const { t } = useTranslation();
  const person = useCurrentPerson(userId);
  if (person.isError || person.fetchStatus === 'paused')
    return <LoadError retry={() => void person.refetch()} />;
  if (!person.data)
    return (
      <>
        <Text>
          {person.isPending ? t('app.loading') : t('recipes.onboard')}
        </Text>
        <AppButton label={t('families.cancel')} onPress={onCancel} />
      </>
    );
  return (
    <CreateRecipeForm
      userId={userId}
      personId={person.data.id}
      onCancel={onCancel}
      onDone={onDone}
    />
  );
}
function CreateRecipeForm({
  userId,
  personId,
  onCancel,
  onDone,
}: {
  userId: string;
  personId: string;
  onCancel: () => void;
  onDone: (id: string) => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const families = useFamilies(userId, personId);
  const mutation = useMutation({
    networkMode: 'always',
    mutationFn: api.saveRecipe,
  });
  return (
    <>
      {families.isError || families.fetchStatus === 'paused' ? (
        <LoadError retry={() => void families.refetch()} />
      ) : !families.data ? (
        <Text role="status">{t('app.loading')}</Text>
      ) : !families.data.some((f) => f.role !== 'READ_ONLY') ? (
        <>
          <Text>{t('recipes.joinFamily')}</Text>
          <AppButton label={t('families.cancel')} onPress={onCancel} />
        </>
      ) : (
        <RecipeForm
          families={families.data}
          onCancel={onCancel}
          onSave={async (values) => {
            const id = await mutation.mutateAsync({
              ...values,
              id: null,
              expectedRevision: 0,
            });
            await client.invalidateQueries({ queryKey: keys(userId) });
            onDone(id);
          }}
        />
      )}
    </>
  );
}
function RecipeView({
  id,
  userId,
  onClose,
}: {
  id: string;
  userId: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const detail = useQuery({
    queryKey: [...keys(userId), 'detail', id],
    queryFn: () => api.getRecipe(id),
  });
  const [editing, setEditing] = useState<api.RecipeDetail | null>(null),
    [revision, setRevision] = useState<number | null>(null);
  const mutation = useMutation({
    networkMode: 'always',
    mutationFn: api.saveRecipe,
  });
  if (editing)
    return (
      <RecipeForm
        initial={editing}
        families={[]}
        onCancel={() => {
          setEditing(null);
          void detail.refetch();
        }}
        onSave={async (values) => {
          await mutation.mutateAsync({
            ...values,
            id,
            expectedRevision: editing.latest_revision,
          });
          await client.invalidateQueries({ queryKey: keys(userId) });
          setEditing(null);
        }}
      />
    );
  return (
    <>
      <AppButton
        label={t('recipes.back')}
        variant="secondary"
        onPress={onClose}
      />
      {detail.isError || detail.fetchStatus === 'paused' ? (
        <LoadError retry={() => void detail.refetch()} />
      ) : !detail.data ? (
        <Text role="status">{t('app.loading')}</Text>
      ) : (
        <>
          <Text style={styles.body}>
            {t('recipes.owner', {
              name: detail.data.owner_deleted
                ? t('recipes.anonymous')
                : detail.data.owner_name,
            })}
          </Text>
          <Text style={styles.body}>
            {t('recipes.creator', {
              name: detail.data.creator_deleted
                ? t('recipes.anonymous')
                : detail.data.creator_name,
            })}
          </Text>
          {revision !== null ? (
            <>
              <Text style={styles.subtitle}>
                {t('recipes.historical', { number: revision })}
              </Text>
              <Revision userId={userId} recipeId={id} number={revision} />
              <AppButton
                label={t('recipes.current')}
                onPress={() => setRevision(null)}
              />
            </>
          ) : (
            <>
              <RecipeContentView data={detail.data} />
              <Text>
                {t(
                  detail.data.recipe.preservation_status === 'PRESERVED'
                    ? 'recipes.preserved'
                    : 'recipes.editable',
                )}
              </Text>
              {detail.data.can_edit && (
                <AppButton
                  label={t('recipes.edit')}
                  onPress={() => setEditing(detail.data!)}
                />
              )}
            </>
          )}
          <Text style={styles.subtitle}>{t('recipes.history')}</Text>
          {detail.data.revisions.map((r) => (
            <View key={r.revision_number} style={styles.card}>
              <AppButton
                variant="secondary"
                label={t('recipes.version', {
                  number: r.revision_number,
                  date: new Date(r.created_at).toLocaleString(i18n.language),
                })}
                onPress={() => setRevision(r.revision_number)}
              />
              {r.change_summary && <Text>{r.change_summary}</Text>}
            </View>
          ))}
        </>
      )}
    </>
  );
}
function Revision({
  userId,
  recipeId,
  number,
}: {
  userId: string;
  recipeId: string;
  number: number;
}) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: [...keys(userId), 'revision', recipeId, number],
    queryFn: () => api.getRevision(recipeId, number),
  });
  return query.isError || query.fetchStatus === 'paused' ? (
    <LoadError retry={() => void query.refetch()} />
  ) : query.data ? (
    <RecipeContentView data={query.data} />
  ) : (
    <Text role="status">{t('app.loading')}</Text>
  );
}
function RecipeContentView({
  data,
}: {
  data: Pick<api.RecipeDetail, 'recipe' | 'ingredients' | 'steps'>;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.stack}>
      <ScrollIntoView>
        <Text role="heading" style={styles.title}>
          {data.recipe.title}
        </Text>
      </ScrollIntoView>
      {(
        [
          'description',
          'origin_location',
          'origin_year',
          'story',
          'servings',
          'prep_time_minutes',
          'cook_time_minutes',
          'rest_time_minutes',
        ] as const
      ).map((key) =>
        data.recipe[key] !== null && data.recipe[key] !== '' ? (
          <Text key={key} style={styles.body}>
            {t(`recipes.fields.${key}`)}: {data.recipe[key]}
          </Text>
        ) : null,
      )}
      <Text style={styles.subtitle}>{t('recipes.ingredients')}</Text>
      {data.ingredients.map((v, i) => (
        <View key={i} style={styles.stack}>
          {v.section_name &&
            v.section_name !== data.ingredients[i - 1]?.section_name && (
              <Text role="heading" style={styles.fieldLabel}>
                {v.section_name}
              </Text>
            )}
          <Text style={styles.body}>
            {[v.quantity, v.unit, v.ingredient, v.preparation_note]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      ))}
      <Text style={styles.subtitle}>{t('recipes.steps')}</Text>
      {data.steps.map((v, i) => (
        <View key={i} style={styles.stack}>
          {v.section_name &&
            v.section_name !== data.steps[i - 1]?.section_name && (
              <Text role="heading" style={styles.fieldLabel}>
                {v.section_name}
              </Text>
            )}
          <Text style={styles.body}>
            {i + 1}. {v.instruction}
          </Text>
        </View>
      ))}
    </View>
  );
}

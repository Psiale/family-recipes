import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { TextField } from '@/components/TextField';
import { styles } from '@/features/families/components/styles';

import * as api from './api';

export function collectionName(c: api.Collection, t: TFunction) {
  const key = (['breakfast', 'mains', 'desserts', 'drinks'] as const).find(
    (k) => k === c.localization_key,
  );
  return key
    ? t(`recipes.collections.defaults.${key}`)
    : (c.custom_name ?? c.localization_key ?? '');
}
export function RecipeCollections({
  options,
  userId,
  onOpenRecipe,
  onClose,
}: {
  options: api.RecipeOptions;
  userId: string;
  onOpenRecipe: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [familyId, setFamilyId] = useState(options.families[0]?.id ?? null),
    [selected, setSelected] = useState<string | null>(null),
    [creating, setCreating] = useState(false);
  const query = useQuery({
    queryKey: ['recipe-collections', userId, familyId],
    queryFn: () => api.listCollections(familyId!),
    enabled: !!familyId,
  });
  const family = options.families.find((f) => f.id === familyId);
  const collection = query.data?.find((c) => c.id === selected);
  const changed = () => {
    void client.invalidateQueries({ queryKey: ['recipe-collections', userId] });
  };
  return (
    <View style={styles.stack}>
      <Text role="heading" style={styles.title}>
        {t('recipes.collections.title')}
      </Text>
      <AppButton
        label={t('recipes.back')}
        onPress={onClose}
        variant="secondary"
      />
      {options.families.map((f) => (
        <AppButton
          key={f.id}
          label={f.name}
          variant={familyId === f.id ? 'primary' : 'secondary'}
          onPress={() => {
            setFamilyId(f.id);
            setSelected(null);
            setCreating(false);
          }}
        />
      ))}
      {!family ? (
        <Text>{t('recipes.collections.noFamily')}</Text>
      ) : query.isError ? (
        <>
          <Text role="alert">{t('families.errors.load')}</Text>
          <AppButton
            label={t('families.retry')}
            onPress={() => void query.refetch()}
          />
        </>
      ) : !query.data ? (
        <Text role="status">{t('app.loading')}</Text>
      ) : creating ? (
        <CollectionForm
          familyId={family.id}
          onCancel={() => setCreating(false)}
          onDone={() => {
            changed();
            setCreating(false);
          }}
        />
      ) : collection ? (
        <CollectionDetails
          key={`${collection.id}:${collection.updated_at}`}
          collection={collection}
          userId={userId}
          canManage={family.can_manage}
          onChange={changed}
          onClose={() => setSelected(null)}
          onOpenRecipe={onOpenRecipe}
        />
      ) : (
        <>
          {family.can_write && (
            <AppButton
              label={t('recipes.collections.create')}
              onPress={() => setCreating(true)}
            />
          )}
          {query.data.map((c) => (
            <View key={c.id} style={styles.card}>
              <AppButton
                label={collectionName(c, t)}
                variant="secondary"
                onPress={() => setSelected(c.id)}
              />
              {c.localization_key && (
                <Text>{t('recipes.collections.builtIn')}</Text>
              )}
              {c.description && <Text>{c.description}</Text>}
            </View>
          ))}
        </>
      )}
    </View>
  );
}
function CollectionForm({
  familyId,
  initial,
  onCancel,
  onDone,
}: {
  familyId: string;
  initial?: api.Collection;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [name, setName] = useState(initial?.custom_name ?? ''),
    [description, setDescription] = useState(initial?.description ?? ''),
    [stale, setStale] = useState(false);
  const mutation = useMutation({
    mutationFn: () =>
      api.saveCollection(familyId, name.trim(), description, initial),
    onSuccess: onDone,
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['recipe-collections'] });
    },
    onError: (e) => {
      if (
        'code' in e &&
        ['PT409', '42501', 'RECIPE_SAVE_UNCONFIRMED'].includes(String(e.code))
      )
        setStale(true);
    },
  });
  return (
    <View style={styles.card}>
      {initial?.localization_key && (
        <>
          <Text>{collectionName(initial, t)}</Text>
          <Text>{t('recipes.collections.renameDefault')}</Text>
        </>
      )}
      <TextField
        label={t('recipes.collections.name')}
        value={name}
        onChangeText={setName}
        maxLength={100}
        editable={!mutation.isPending}
      />
      <TextField
        label={t('recipes.fields.description')}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
        editable={!mutation.isPending}
      />
      {mutation.isError && (
        <Text role="alert">
          {t(
            mutation.error &&
              'code' in mutation.error &&
              mutation.error.code === '23505'
              ? 'recipes.collections.duplicate'
              : mutation.error &&
                  'code' in mutation.error &&
                  mutation.error.code === 'RECIPE_SAVE_UNCONFIRMED'
                ? 'recipes.collections.unconfirmed'
                : stale
                  ? 'recipes.collections.stale'
                  : 'families.errors.save',
          )}
        </Text>
      )}
      <AppButton
        label={t('recipes.collections.save')}
        loading={mutation.isPending}
        disabled={!name.trim() || stale}
        onPress={() => mutation.mutate()}
      />
      <AppButton
        label={t('families.cancel')}
        variant="secondary"
        disabled={mutation.isPending}
        onPress={onCancel}
      />
    </View>
  );
}
function CollectionDetails({
  collection,
  userId,
  canManage,
  onChange,
  onClose,
  onOpenRecipe,
}: {
  collection: api.Collection;
  userId: string;
  canManage: boolean;
  onChange: () => void;
  onClose: () => void;
  onOpenRecipe: (id: string) => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false),
    [deleting, setDeleting] = useState(false),
    [adding, setAdding] = useState(false),
    [page, setPage] = useState(0),
    [stale, setStale] = useState(false);
  const items = useQuery({
    queryKey: ['recipe-collection-items', userId, collection.id],
    queryFn: () => api.collectionRecipes(collection.id),
  });
  const candidates = useQuery({
    queryKey: [
      'recipe-collection-candidates',
      userId,
      collection.family_id,
      page,
    ],
    queryFn: () => api.familyRecipes(collection.family_id, page),
    enabled: adding,
  });
  const update = () => {
    onChange();
    void client.invalidateQueries({
      queryKey: ['recipe-collection-items', userId, collection.id],
    });
  };
  const mutation = useMutation({
    mutationFn: async (action: {
      removeCollection?: boolean;
      recipeId?: string;
      add?: boolean;
    }) =>
      action.removeCollection
        ? api.saveCollection(collection.family_id, '', '', collection, true)
        : api.setCollectionRecipe(collection, action.recipeId!, !!action.add),
    onSuccess: (_data, action) => {
      if (action.removeCollection) onClose();
    },
    onSettled: update,
    onError: (e) => {
      if (
        'code' in e &&
        ['PT409', '42501', 'RECIPE_SAVE_UNCONFIRMED'].includes(String(e.code))
      )
        setStale(true);
    },
  });
  if (editing)
    return (
      <CollectionForm
        familyId={collection.family_id}
        initial={collection}
        onCancel={() => setEditing(false)}
        onDone={() => {
          update();
          setEditing(false);
        }}
      />
    );
  return (
    <View style={styles.stack}>
      <Text role="heading" style={styles.subtitle}>
        {collectionName(collection, t)}
      </Text>
      {collection.description && <Text>{collection.description}</Text>}
      <AppButton
        label={t('recipes.collections.back')}
        onPress={onClose}
        variant="secondary"
      />
      {mutation.isError && (
        <Text role="alert">
          {t(
            mutation.error &&
              'code' in mutation.error &&
              mutation.error.code === '23505'
              ? 'recipes.collections.duplicate'
              : mutation.error &&
                  'code' in mutation.error &&
                  mutation.error.code === 'RECIPE_SAVE_UNCONFIRMED'
                ? 'recipes.collections.unconfirmed'
                : stale
                  ? 'recipes.collections.stale'
                  : 'families.errors.save',
          )}
        </Text>
      )}
      {items.isError ? (
        <>
          <Text role="alert">{t('families.errors.load')}</Text>
          <AppButton
            label={t('families.retry')}
            onPress={() => void items.refetch()}
          />
        </>
      ) : !items.data ? (
        <Text role="status">{t('app.loading')}</Text>
      ) : items.data.length === 0 ? (
        <Text>{t('recipes.collections.empty')}</Text>
      ) : (
        items.data.map((r) => (
          <View key={r.id} style={styles.card}>
            <AppButton label={r.title} onPress={() => onOpenRecipe(r.id)} />
            {canManage && (
              <AppButton
                label={t('recipes.collections.remove', { title: r.title })}
                variant="secondary"
                disabled={mutation.isPending || stale}
                onPress={() => mutation.mutate({ recipeId: r.id, add: false })}
              />
            )}
          </View>
        ))
      )}
      {canManage && (
        <>
          <AppButton
            label={t('recipes.collections.add')}
            disabled={mutation.isPending || stale}
            variant="secondary"
            onPress={() => setAdding((old) => !old)}
          />
          {adding &&
            (candidates.isError ? (
              <>
                <Text role="alert">{t('families.errors.load')}</Text>
                <AppButton
                  label={t('families.retry')}
                  onPress={() => void candidates.refetch()}
                />
              </>
            ) : !candidates.data ? (
              <Text role="status">{t('app.loading')}</Text>
            ) : (
              <>
                {candidates.data.recipes.map((r) => (
                  <AppButton
                    key={r.id}
                    label={t('recipes.collections.addTitle', {
                      title: r.title,
                    })}
                    disabled={
                      mutation.isPending ||
                      stale ||
                      items.data?.some((i) => i.id === r.id)
                    }
                    onPress={() =>
                      mutation.mutate({ recipeId: r.id, add: true })
                    }
                  />
                ))}
                {candidates.data.more && (
                  <AppButton
                    label={t('administration.next')}
                    onPress={() => setPage((old) => old + 1)}
                  />
                )}{' '}
                {page > 0 && (
                  <AppButton
                    label={t('administration.previous')}
                    onPress={() => setPage((old) => old - 1)}
                  />
                )}
              </>
            ))}
          {
            <>
              <AppButton
                label={t('recipes.collections.edit')}
                disabled={mutation.isPending || stale}
                variant="secondary"
                onPress={() => setEditing(true)}
              />
              <AppButton
                label={t('recipes.collections.delete')}
                disabled={mutation.isPending || stale}
                variant="secondary"
                onPress={() => setDeleting(true)}
              />
              {deleting && (
                <View style={styles.card}>
                  <Text>
                    {t('recipes.collections.deleteConfirm', {
                      name: collectionName(collection, t),
                    })}
                  </Text>
                  <AppButton
                    label={t('recipes.collections.confirmDelete')}
                    loading={mutation.isPending}
                    disabled={stale}
                    onPress={() => mutation.mutate({ removeCollection: true })}
                  />
                  <AppButton
                    label={t('families.cancel')}
                    disabled={mutation.isPending}
                    onPress={() => setDeleting(false)}
                  />
                </View>
              )}
            </>
          }
        </>
      )}
    </View>
  );
}

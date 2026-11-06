import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { ScrollIntoView } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import type { Family } from '@/features/families/api';
import { styles } from '@/features/families/components/styles';

import { contentSchema, type RecipeContent, type RecipeDetail } from './api';

type Ingredient = RecipeContent['ingredients'][number] & { key: number };
type Step = RecipeContent['steps'][number] & { key: number };
const blankIngredient = (): RecipeContent['ingredients'][number] => ({
  ingredient: '',
  quantity: '',
  unit: '',
  preparation_note: '',
  section_name: '',
});
const blankStep = (): RecipeContent['steps'][number] => ({
  instruction: '',
  section_name: '',
  duration_minutes: null,
});
function move<T>(items: T[], index: number, offset: number) {
  const item = items[index];
  if (item === undefined) return items;
  const result = [...items];
  result.splice(index, 1);
  result.splice(index + offset, 0, item);
  return result;
}
export function RecipeForm({
  initial,
  families,
  onSave,
  onCancel,
}: {
  initial?: RecipeDetail;
  families: Family[];
  onSave: (values: {
    content: RecipeContent;
    familyId: string | null;
    shareWithFamily: boolean;
    overrideReason: string;
  }) => Promise<unknown>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const ids = useRef(1000);
  const busy = useRef(false);
  const [fields, setFields] = useState(() => ({
    title: initial?.recipe.title ?? '',
    description: initial?.recipe.description ?? '',
    origin_location: initial?.recipe.origin_location ?? '',
    origin_year: initial?.recipe.origin_year?.toString() ?? '',
    story: initial?.recipe.story ?? '',
    servings: initial?.recipe.servings ?? '',
    prep_time_minutes: initial?.recipe.prep_time_minutes?.toString() ?? '',
    cook_time_minutes: initial?.recipe.cook_time_minutes?.toString() ?? '',
    rest_time_minutes: initial?.recipe.rest_time_minutes?.toString() ?? '',
    change_summary: '',
  }));
  const [ingredients, setIngredients] = useState<Ingredient[]>(() =>
    (initial?.ingredients ?? [blankIngredient()]).map((v, key) => ({
      ...v,
      key,
    })),
  );
  const [steps, setSteps] = useState<Step[]>(() =>
    (initial?.steps ?? [blankStep()]).map((v, key) => ({ ...v, key })),
  );
  const [familyId, setFamilyId] = useState(
    families.find((f) => f.role !== 'READ_ONLY')?.id ?? null,
  );
  const [share, setShare] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const preserved = initial?.recipe.preservation_status === 'PRESERVED';
  const save = async () => {
    if (busy.current || stale) return;
    const numeric = (value: string) =>
      value.trim() === ''
        ? null
        : /^[0-9]{1,6}$/.test(value)
          ? Number(value)
          : Number.NaN;
    const parsed = contentSchema.safeParse({
      ...fields,
      origin_year: numeric(fields.origin_year),
      prep_time_minutes: numeric(fields.prep_time_minutes),
      cook_time_minutes: numeric(fields.cook_time_minutes),
      rest_time_minutes: numeric(fields.rest_time_minutes),
      ingredients: ingredients.map(({ key, ...v }) => v),
      steps: steps.map(({ key, ...v }) => v),
    });
    if (
      !parsed.success ||
      (!initial && !familyId) ||
      (preserved && !reason.trim())
    ) {
      setError(t('recipes.invalid'));
      return;
    }
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        content: parsed.data,
        familyId: initial ? null : familyId,
        shareWithFamily: !initial && share,
        overrideReason: reason,
      });
    } catch (caught) {
      const code =
        typeof caught === 'object' && caught && 'code' in caught
          ? caught.code
          : null;
      setStale(code === 'PT409' || code === '42501');
      setError(
        t(
          code === 'PT409'
            ? 'recipes.stale'
            : code === '42501'
              ? 'recipes.denied'
              : 'families.errors.save',
        ),
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  return (
    <View style={styles.stack}>
      <ScrollIntoView>
        <Text role="heading" style={styles.title}>
          {t(initial ? 'recipes.edit' : 'recipes.create')}
        </Text>
      </ScrollIntoView>
      {(Object.keys(fields) as (keyof typeof fields)[])
        .filter((key) => key !== 'change_summary' || initial)
        .map((key) => (
          <TextField
            key={key}
            label={t(`recipes.fields.${key}`)}
            value={fields[key]}
            onChangeText={(value) =>
              setFields((old) => ({ ...old, [key]: value }))
            }
            editable={!saving}
            multiline={['description', 'story'].includes(key)}
            maxLength={
              key === 'title'
                ? 160
                : key === 'story'
                  ? 10000
                  : key === 'description'
                    ? 2000
                    : key === 'change_summary'
                      ? 500
                      : 120
            }
            keyboardType={
              key.endsWith('_minutes') || key === 'origin_year'
                ? 'number-pad'
                : 'default'
            }
          />
        ))}
      {!initial && (
        <>
          <Text style={styles.subtitle}>{t('recipes.familyContext')}</Text>
          {families
            .filter((f) => f.role !== 'READ_ONLY')
            .map((f) => (
              <AppButton
                key={f.id}
                variant={familyId === f.id ? 'primary' : 'secondary'}
                label={f.name}
                disabled={saving}
                onPress={() => setFamilyId(f.id)}
              />
            ))}
          <Text style={styles.body}>{t('recipes.privateExplanation')}</Text>
          <Text>{t('recipes.shareFamily')}</Text>
          <Switch
            accessibilityLabel={t('recipes.shareFamily')}
            value={share}
            onValueChange={setShare}
            disabled={saving}
          />
        </>
      )}
      <Text style={styles.subtitle}>{t('recipes.ingredients')}</Text>
      {ingredients.map((item, index) => (
        <View key={item.key} style={styles.card}>
          <Text>{t('recipes.ingredientNumber', { number: index + 1 })}</Text>
          {(
            ['ingredient', 'quantity', 'unit', 'preparation_note'] as const
          ).map((key) => (
            <TextField
              key={key}
              label={t(`recipes.fields.${key}`, { number: index + 1 })}
              value={item[key] ?? ''}
              editable={!saving}
              maxLength={240}
              onChangeText={(value) =>
                setIngredients((old) =>
                  old.map((v) =>
                    v.key === item.key ? { ...v, [key]: value } : v,
                  ),
                )
              }
            />
          ))}
          <AppButton
            variant="secondary"
            label={t('recipes.moveUp', {
              item: t('recipes.ingredientNumber', { number: index + 1 }),
            })}
            disabled={saving || index === 0}
            onPress={() => setIngredients((old) => move(old, index, -1))}
          />
          <AppButton
            variant="secondary"
            label={t('recipes.moveDown', {
              item: t('recipes.ingredientNumber', { number: index + 1 }),
            })}
            disabled={saving || index === ingredients.length - 1}
            onPress={() => setIngredients((old) => move(old, index, 1))}
          />
          <AppButton
            variant="secondary"
            label={t('recipes.removeIngredient', { number: index + 1 })}
            disabled={saving || ingredients.length === 1}
            onPress={() =>
              setIngredients((old) => old.filter((v) => v.key !== item.key))
            }
          />
        </View>
      ))}
      <AppButton
        label={t('recipes.addIngredient')}
        disabled={saving || ingredients.length >= 100}
        onPress={() =>
          setIngredients((old) => [
            ...old,
            { ...blankIngredient(), key: ids.current++ },
          ])
        }
      />
      <Text style={styles.subtitle}>{t('recipes.steps')}</Text>
      {steps.map((item, index) => (
        <View key={item.key} style={styles.card}>
          <TextField
            label={t('recipes.stepNumber', { number: index + 1 })}
            value={item.instruction}
            editable={!saving}
            maxLength={4000}
            multiline
            onChangeText={(value) =>
              setSteps((old) =>
                old.map((v) =>
                  v.key === item.key ? { ...v, instruction: value } : v,
                ),
              )
            }
          />
          <AppButton
            variant="secondary"
            label={t('recipes.moveUp', {
              item: t('recipes.stepNumber', { number: index + 1 }),
            })}
            disabled={saving || index === 0}
            onPress={() => setSteps((old) => move(old, index, -1))}
          />
          <AppButton
            variant="secondary"
            label={t('recipes.moveDown', {
              item: t('recipes.stepNumber', { number: index + 1 }),
            })}
            disabled={saving || index === steps.length - 1}
            onPress={() => setSteps((old) => move(old, index, 1))}
          />
          <AppButton
            variant="secondary"
            label={t('recipes.removeStep', { number: index + 1 })}
            disabled={saving || steps.length === 1}
            onPress={() =>
              setSteps((old) => old.filter((v) => v.key !== item.key))
            }
          />
        </View>
      ))}
      <AppButton
        label={t('recipes.addStep')}
        disabled={saving || steps.length >= 100}
        onPress={() =>
          setSteps((old) => [...old, { ...blankStep(), key: ids.current++ }])
        }
      />
      {preserved && (
        <>
          <Text style={styles.body}>{t('recipes.preservedOverride')}</Text>
          <TextField
            label={t('personAdministration.reason')}
            value={reason}
            onChangeText={setReason}
            editable={!saving}
            maxLength={2000}
          />
        </>
      )}
      {error && (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <AppButton
        label={t('recipes.save')}
        disabled={stale}
        loading={saving}
        onPress={() => void save()}
      />
      <AppButton
        variant="secondary"
        label={t('families.cancel')}
        disabled={saving}
        onPress={onCancel}
      />
    </View>
  );
}

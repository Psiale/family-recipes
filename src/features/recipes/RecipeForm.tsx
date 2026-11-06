import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { ScrollIntoView } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import type { Family } from '@/features/families/api';
import { styles } from '@/features/families/components/styles';

import { contentSchema, type RecipeContent, type RecipeDetail } from './api';
import {
  EditorDisclosure,
  RecipeRowActions,
  editorStyles,
} from './RecipeEditorControls';
import { RecipeUnitField } from './RecipeUnitField';

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
  const [timingOpen, setTimingOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
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
      if (
        ['prep_time_minutes', 'cook_time_minutes', 'rest_time_minutes'].some(
          (key) => Number.isNaN(numeric(fields[key as keyof typeof fields])),
        )
      )
        setTimingOpen(true);
      if (Number.isNaN(numeric(fields.origin_year))) setStoryOpen(true);
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
      setStale(
        code === 'PT409' ||
          code === '42501' ||
          code === 'RECIPE_SAVE_UNCONFIRMED',
      );
      setError(
        t(
          code === 'RECIPE_SAVE_UNCONFIRMED'
            ? 'recipes.saveUnconfirmed'
            : code === 'PT409'
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
  const field = (key: keyof typeof fields) => (
    <TextField
      key={key}
      label={t(`recipes.fields.${key}`)}
      value={fields[key]}
      onChangeText={(value) => setFields((old) => ({ ...old, [key]: value }))}
      editable={!saving}
      multiline={['description', 'story'].includes(key)}
      style={
        ['description', 'story'].includes(key)
          ? editorStyles.multiline
          : undefined
      }
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
  );
  const timingSummary =
    [
      fields.servings &&
        t('recipes.editor.servingsSummary', { value: fields.servings }),
      ...(
        ['prep_time_minutes', 'cook_time_minutes', 'rest_time_minutes'] as const
      )
        .filter((key) => fields[key] !== '')
        .map((key) => `${t(`recipes.fields.${key}`)}: ${fields[key]}`),
    ]
      .filter(Boolean)
      .join(' · ') || t('recipes.editor.timingHint');
  const storySummary =
    [
      fields.origin_location,
      fields.origin_year,
      fields.story && t('recipes.editor.storyAdded'),
    ]
      .filter(Boolean)
      .join(' · ') || t('recipes.editor.storyHint');
  return (
    <View style={editorStyles.container}>
      <ScrollIntoView>
        <Text role="heading" style={styles.title}>
          {t(initial ? 'recipes.edit' : 'recipes.create')}
        </Text>
      </ScrollIntoView>
      <Text style={styles.body}>{t('recipes.editor.intro')}</Text>
      <View style={editorStyles.section}>
        {field('title')}
        {field('description')}
      </View>
      <View style={editorStyles.section}>
        <Text role="heading" style={styles.subtitle}>
          {t('recipes.ingredients')}
        </Text>
        <Text style={editorStyles.hint}>
          {t('recipes.editor.ingredientsHint')}
        </Text>
        {ingredients.map((item, index) => (
          <EditorRow key={item.key} added={item.key >= 1000}>
            <View style={editorStyles.row}>
              <View style={editorStyles.rowHeader}>
                <Text style={editorStyles.number}>{index + 1}</Text>
                <RecipeRowActions
                  label={t('recipes.ingredientNumber', { number: index + 1 })}
                  first={index === 0}
                  last={index === ingredients.length - 1}
                  only={ingredients.length === 1}
                  disabled={saving}
                  onMove={(offset) =>
                    setIngredients((old) => move(old, index, offset))
                  }
                  onRemove={() =>
                    setIngredients((old) =>
                      old.filter((v) => v.key !== item.key),
                    )
                  }
                />
              </View>
              <TextField
                label={t('recipes.fields.ingredient', { number: index + 1 })}
                value={item.ingredient}
                editable={!saving}
                maxLength={240}
                placeholder={t('recipes.editor.ingredientExample')}
                onChangeText={(value) =>
                  setIngredients((old) =>
                    old.map((v) =>
                      v.key === item.key ? { ...v, ingredient: value } : v,
                    ),
                  )
                }
              />
              <View style={editorStyles.columns}>
                <View style={editorStyles.column}>
                  <TextField
                    label={t('recipes.editor.quantity')}
                    aria-label={t('recipes.fields.quantity', {
                      number: index + 1,
                    })}
                    value={item.quantity ?? ''}
                    editable={!saving}
                    maxLength={240}
                    placeholder={t('recipes.editor.quantityExample')}
                    onChangeText={(quantity) =>
                      setIngredients((old) =>
                        old.map((v) =>
                          v.key === item.key ? { ...v, quantity } : v,
                        ),
                      )
                    }
                  />
                </View>
                <View style={editorStyles.unitColumn}>
                  <RecipeUnitField
                    value={item.unit ?? ''}
                    number={index + 1}
                    disabled={saving}
                    onChange={(unit) =>
                      setIngredients((old) =>
                        old.map((v) =>
                          v.key === item.key ? { ...v, unit } : v,
                        ),
                      )
                    }
                  />
                </View>
              </View>
              <EditorDisclosure
                label={t('recipes.editor.rowNotes')}
                accessibilityLabel={t('recipes.editor.ingredientDetails', {
                  number: index + 1,
                })}
                summary={
                  [item.section_name, item.preparation_note]
                    .filter(Boolean)
                    .join(' · ') || t('recipes.editor.optional')
                }
                disabled={saving}
              >
                <Text style={editorStyles.hint}>
                  {t('recipes.editor.ingredientGroupHint')}
                </Text>
                {(['preparation_note', 'section_name'] as const).map((key) => (
                  <TextField
                    key={key}
                    label={t(
                      `recipes.fields.${key === 'section_name' ? 'ingredient_section' : key}`,
                      { number: index + 1 },
                    )}
                    placeholder={
                      key === 'section_name'
                        ? t('recipes.editor.ingredientGroupExample')
                        : undefined
                    }
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
              </EditorDisclosure>
            </View>
          </EditorRow>
        ))}
        <AppButton
          variant="secondary"
          label={t('recipes.addIngredient')}
          disabled={saving || ingredients.length >= 100}
          onPress={() =>
            setIngredients((old) => [
              ...old,
              { ...blankIngredient(), key: ids.current++ },
            ])
          }
        />
      </View>
      <View style={editorStyles.section}>
        <Text role="heading" style={styles.subtitle}>
          {t('recipes.steps')}
        </Text>
        <Text style={editorStyles.hint}>{t('recipes.editor.stepsHint')}</Text>
        {steps.map((item, index) => (
          <EditorRow key={item.key} added={item.key >= 1000}>
            <View style={editorStyles.row}>
              <View style={editorStyles.rowHeader}>
                <Text style={editorStyles.number}>{index + 1}</Text>
                <RecipeRowActions
                  label={t('recipes.stepNumber', { number: index + 1 })}
                  first={index === 0}
                  last={index === steps.length - 1}
                  only={steps.length === 1}
                  disabled={saving}
                  onMove={(offset) =>
                    setSteps((old) => move(old, index, offset))
                  }
                  onRemove={() =>
                    setSteps((old) => old.filter((v) => v.key !== item.key))
                  }
                />
              </View>
              <TextField
                label={t('recipes.stepNumber', { number: index + 1 })}
                value={item.instruction}
                editable={!saving}
                maxLength={4000}
                multiline
                style={editorStyles.multiline}
                placeholder={t('recipes.editor.stepExample')}
                onChangeText={(value) =>
                  setSteps((old) =>
                    old.map((v) =>
                      v.key === item.key ? { ...v, instruction: value } : v,
                    ),
                  )
                }
              />
              <EditorDisclosure
                label={t('recipes.editor.stepSection')}
                accessibilityLabel={t('recipes.editor.stepDetails', {
                  number: index + 1,
                })}
                summary={item.section_name || t('recipes.editor.optional')}
                disabled={saving}
              >
                <Text style={editorStyles.hint}>
                  {t('recipes.editor.stepGroupHint')}
                </Text>
                <TextField
                  placeholder={t('recipes.editor.stepGroupExample')}
                  label={t('recipes.fields.step_section', {
                    number: index + 1,
                  })}
                  value={item.section_name ?? ''}
                  editable={!saving}
                  maxLength={240}
                  onChangeText={(value) =>
                    setSteps((old) =>
                      old.map((v) =>
                        v.key === item.key ? { ...v, section_name: value } : v,
                      ),
                    )
                  }
                />
              </EditorDisclosure>
            </View>
          </EditorRow>
        ))}
        <AppButton
          variant="secondary"
          label={t('recipes.addStep')}
          disabled={saving || steps.length >= 100}
          onPress={() =>
            setSteps((old) => [...old, { ...blankStep(), key: ids.current++ }])
          }
        />
      </View>
      <EditorDisclosure
        label={t('recipes.editor.timing')}
        summary={timingSummary}
        disabled={saving}
        expanded={timingOpen}
        onToggle={() => setTimingOpen((old) => !old)}
      >
        {field('servings')}
        {field('prep_time_minutes')}
        {field('cook_time_minutes')}
        {field('rest_time_minutes')}
      </EditorDisclosure>
      <EditorDisclosure
        label={t('recipes.editor.story')}
        summary={storySummary}
        disabled={saving}
        expanded={storyOpen}
        onToggle={() => setStoryOpen((old) => !old)}
      >
        {field('origin_location')}
        {field('origin_year')}
        {field('story')}
      </EditorDisclosure>
      {!initial ? (
        <View style={editorStyles.row}>
          <Text role="heading" style={styles.subtitle}>
            {t('recipes.editor.sharing')}
          </Text>
          <Text style={editorStyles.hint}>{t('recipes.familyContext')}</Text>
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
          <Text style={styles.fieldLabel}>
            {t(
              share
                ? 'recipes.editor.familyVisibility'
                : 'recipes.editor.privateVisibility',
              { family: families.find((f) => f.id === familyId)?.name ?? '' },
            )}
          </Text>
          <Text style={styles.body}>
            {share
              ? t('recipes.editor.familyVisibilityHint', {
                  family: families.find((f) => f.id === familyId)?.name ?? '',
                })
              : t('recipes.privateExplanation')}
          </Text>
          <View style={editorStyles.sharingRow}>
            <Text style={editorStyles.grow}>{t('recipes.shareFamily')}</Text>
            <Switch
              accessibilityLabel={t('recipes.shareFamily')}
              value={share}
              onValueChange={setShare}
              disabled={saving}
            />
          </View>
        </View>
      ) : (
        <View style={editorStyles.section}>
          <Text style={editorStyles.hint}>
            {t('recipes.editor.existingSharing')}
          </Text>
          {field('change_summary')}
        </View>
      )}
      {preserved && (
        <View style={editorStyles.row}>
          <Text style={styles.body}>{t('recipes.preservedOverride')}</Text>
          <TextField
            label={t('personAdministration.reason')}
            value={reason}
            onChangeText={setReason}
            editable={!saving}
            maxLength={2000}
          />
        </View>
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

function EditorRow({
  added,
  children,
}: {
  added: boolean;
  children: React.ReactNode;
}) {
  return added ? (
    <ScrollIntoView>{children}</ScrollIntoView>
  ) : (
    <View>{children}</View>
  );
}

import { useTranslation } from 'react-i18next';
import { Switch, Text, View } from 'react-native';

import { styles } from '@/features/families/components/styles';

import type { RecipeAudience, RecipeOptions } from './api';
import { editorStyles } from './RecipeEditorControls';

export function RecipeAudienceEditor({
  value,
  onChange,
  options,
  disabled,
}: {
  value: RecipeAudience[];
  onChange: (value: RecipeAudience[]) => void;
  options: RecipeOptions;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const toggle = (family_id: string, branch_id: string | null) => {
    const exists = value.some(
      (a) => a.family_id === family_id && a.branch_id === branch_id,
    );
    onChange(
      exists
        ? value.filter(
            (a) => a.family_id !== family_id || a.branch_id !== branch_id,
          )
        : [
            ...value.filter(
              (a) =>
                a.family_id !== family_id ||
                (branch_id !== null && a.branch_id !== null),
            ),
            { family_id, branch_id },
          ],
    );
  };
  const choices = options.families.filter(
    (f) => f.can_write || value.some((a) => a.family_id === f.id),
  );
  return (
    <View style={styles.stack}>
      <Text role="heading" style={styles.subtitle}>
        {t('recipes.audiences.title')}
      </Text>
      <Text>
        {t(
          value.length
            ? 'recipes.audiences.shared'
            : 'recipes.privateExplanation',
        )}
      </Text>
      {choices.map((f) => (
        <View key={f.id} style={styles.card}>
          <Text style={styles.fieldLabel}>{f.name}</Text>
          {[
            { id: null, name: t('recipes.audiences.wholeFamily') },
            ...f.branches,
          ].map((b) => {
            const selected = value.some(
              (a) => a.family_id === f.id && a.branch_id === b.id,
            );
            return (
              <View key={b.id ?? 'family'} style={editorStyles.sharingRow}>
                <Text>{b.name}</Text>
                <Switch
                  accessibilityLabel={t('recipes.audiences.choice', {
                    family: f.name,
                    audience: b.name,
                  })}
                  value={selected}
                  disabled={disabled || (!f.can_write && !selected)}
                  onValueChange={() => toggle(f.id, b.id)}
                />
              </View>
            );
          })}
        </View>
      ))}
      {value
        .filter(
          (a) =>
            !choices.some(
              (f) =>
                f.id === a.family_id &&
                (!a.branch_id || f.branches.some((b) => b.id === a.branch_id)),
            ),
        )
        .map((a) => (
          <View key={`${a.family_id}:${a.branch_id}`}>
            <Text>{t('recipes.audiences.existing')}</Text>
            <Switch
              accessibilityLabel={t('recipes.audiences.existing')}
              value
              disabled={disabled}
              onValueChange={() => toggle(a.family_id, a.branch_id)}
            />
          </View>
        ))}
    </View>
  );
}

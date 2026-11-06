import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TextField } from '@/components/TextField';
import { colors, spacing } from '@/components/theme';

const units = {
  gram: 'g gr gram grams gramo gramos',
  kilogram: 'kg kilo kilos kilogram kilograms kilogramo kilogramos',
  milliliter: 'ml milliliter milliliters mililitro mililitros',
  liter: 'l liter liters litro litros',
  teaspoon: 'tsp teaspoon teaspoons cucharadita cucharaditas',
  tablespoon: 'tbsp tablespoon tablespoons cucharada cucharadas',
  cup: 'cup cups taza tazas',
  piece: 'piece pieces pieza piezas unidad unidades',
  pinch: 'pinch pinches pizca pizcas',
  handful: 'handful handfuls puñado puñados',
  clove: 'clove cloves diente dientes',
  bunch: 'bunch bunches manojo manojos',
  slice: 'slice slices rebanada rebanadas',
  can: 'can cans lata latas',
  package: 'package packages paquete paquetes',
  toTaste: 'to taste al gusto',
} as const;
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function RecipeUnitField({
  value,
  onChange,
  number,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  number: number;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const options = Object.entries(units).map(([key, aliases]) => ({
    label: t(`recipes.units.options.${key as keyof typeof units}`),
    aliases,
  }));
  const query = normalize(value);
  const matches = options.filter((option) =>
    normalize(`${option.label} ${option.aliases}`).includes(query),
  );
  const choose = (unit: string) => {
    onChange(unit);
    setOpen(false);
  };
  return (
    <View style={unitStyles.container}>
      <View style={unitStyles.inputRow}>
        <View style={unitStyles.input}>
          <TextField
            label={t('recipes.editor.unit')}
            aria-label={t('recipes.fields.unit', { number })}
            accessibilityRole="combobox"
            accessibilityState={{ expanded: open, disabled }}
            value={value}
            editable={!disabled}
            maxLength={240}
            autoCorrect={false}
            placeholder={t('recipes.editor.unitExample')}
            onFocus={() => setOpen(true)}
            onChangeText={(text) => {
              onChange(text);
              setOpen(true);
            }}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(
            open ? 'recipes.units.hide' : 'recipes.units.show',
            {
              number,
            },
          )}
          accessibilityState={{ expanded: open, disabled }}
          disabled={disabled}
          onPress={() => setOpen((old) => !old)}
          style={unitStyles.toggle}
        >
          <Text accessible={false} style={unitStyles.arrow}>
            {open ? '⌃' : '⌄'}
          </Text>
        </Pressable>
      </View>
      {open && !disabled && (
        <View style={unitStyles.options}>
          <Text style={unitStyles.hint}>{t('recipes.units.hint')}</Text>
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={unitStyles.list}
          >
            {matches.map((option) => (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                accessibilityState={{ selected: value === option.label }}
                onPress={() => choose(option.label)}
                style={unitStyles.option}
              >
                <Text style={unitStyles.label}>{option.label}</Text>
              </Pressable>
            ))}
            {value.trim() &&
            !options.some((option) => normalize(option.label) === query) ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => choose(value.trim())}
                style={unitStyles.option}
              >
                <Text style={unitStyles.label}>
                  {t('recipes.units.custom', { unit: value.trim() })}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const unitStyles = StyleSheet.create({
  container: { gap: spacing.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  input: { flex: 1, minWidth: 0 },
  toggle: {
    minWidth: 44,
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { color: colors.primary, fontSize: 22 },
  options: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  list: { maxHeight: 220 },
  option: { minHeight: 48, justifyContent: 'center', padding: spacing.sm },
  label: { color: colors.text, fontSize: 16 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
});

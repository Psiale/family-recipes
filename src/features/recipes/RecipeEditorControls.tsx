import { useState, type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/components/theme';

export function EditorDisclosure({
  label,
  accessibilityLabel,
  summary,
  disabled,
  expanded,
  onToggle,
  children,
}: PropsWithChildren<{
  label: string;
  accessibilityLabel?: string;
  summary: string;
  disabled: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}>) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const open = expanded ?? localExpanded;
  return (
    <View style={editorStyles.disclosure}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={onToggle ?? (() => setLocalExpanded((value) => !value))}
        style={({ pressed }) => [
          editorStyles.disclosureHeader,
          pressed && editorStyles.pressed,
          disabled && editorStyles.disabled,
        ]}
      >
        <View style={editorStyles.grow}>
          <Text style={editorStyles.disclosureTitle}>{label}</Text>
          <Text style={editorStyles.hint} numberOfLines={2}>
            {summary}
          </Text>
        </View>
        <Text accessible={false} style={editorStyles.symbol}>
          {open ? '−' : '+'}
        </Text>
      </Pressable>
      {open && <View style={editorStyles.disclosureBody}>{children}</View>}
    </View>
  );
}

export function RecipeRowActions({
  label,
  first,
  last,
  only,
  disabled,
  onMove,
  onRemove,
}: {
  label: string;
  first: boolean;
  last: boolean;
  only: boolean;
  disabled: boolean;
  onMove: (offset: number) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const actions = [
    {
      label: t('recipes.moveUp', { item: label }),
      symbol: '↑',
      disabled: disabled || first,
      onPress: () => onMove(-1),
    },
    {
      label: t('recipes.moveDown', { item: label }),
      symbol: '↓',
      disabled: disabled || last,
      onPress: () => onMove(1),
    },
    {
      label: t('recipes.editor.remove', { item: label }),
      symbol: '×',
      disabled: disabled || only,
      onPress: onRemove,
    },
  ];
  return (
    <View style={editorStyles.actions}>
      {actions.map((action) => (
        <Pressable
          key={action.symbol}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityState={{ disabled: action.disabled }}
          disabled={action.disabled}
          onPress={action.onPress}
          style={({ pressed }) => [
            editorStyles.action,
            pressed && editorStyles.pressed,
            action.disabled && editorStyles.disabled,
          ]}
        >
          <Text accessible={false} style={editorStyles.symbol}>
            {action.symbol}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export const editorStyles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    gap: spacing.lg,
    maxWidth: 760,
    width: '100%',
  },
  section: { gap: spacing.md },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.md,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  number: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
    minWidth: 32,
  },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  column: { flexGrow: 1, flexBasis: 120, minWidth: 100 },
  grow: { flex: 1, minWidth: 0, gap: spacing.xs },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  multiline: {
    minHeight: 112,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: spacing.xs },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    minHeight: 48,
    padding: spacing.sm,
    borderRadius: 10,
    borderColor: colors.border,
    borderWidth: 1,
  },
  symbol: { color: colors.primary, fontSize: 22, fontWeight: '600' },
  pressed: { backgroundColor: colors.background },
  disabled: { opacity: 0.4 },
  disclosure: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  disclosureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    minHeight: 64,
  },
  disclosureTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  disclosureBody: { padding: spacing.md, paddingTop: 0, gap: spacing.md },
  sharingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});

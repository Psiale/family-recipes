import { StyleSheet } from 'react-native';

import { colors, spacing } from '@/components/theme';

export const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.text, fontSize: 19, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  error: { color: colors.error, fontSize: 14 },
  multiline: {
    minHeight: 100,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  code: { color: colors.text, fontSize: 16, lineHeight: 26 },
});

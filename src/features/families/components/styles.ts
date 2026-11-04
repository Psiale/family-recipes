import { StyleSheet } from 'react-native';

import { colors, spacing } from '@/components/theme';

export const styles = StyleSheet.create({
  treeCanvas: {
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  treeLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  edgeLayer: { position: 'absolute', left: 0, top: 0 },
  treeNode: {
    position: 'absolute',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
  },
  avatar: {
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: colors.primary, fontSize: 25, fontWeight: '800' },
  nodeName: {
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  familyHeading: { minHeight: 48, justifyContent: 'center' },
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
  fieldLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choice: { flexGrow: 1, minWidth: 140 },
  treeSection: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.lg,
  },
  personNodeMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  relationshipRow: {
    backgroundColor: colors.background,
    borderRadius: 12,
    gap: spacing.sm,
    padding: spacing.md,
  },
  relationshipLabel: { color: colors.text, fontSize: 15, lineHeight: 22 },
});

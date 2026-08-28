import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/components/theme';

import { Screen } from './Screen';

export function ConfigurationErrorScreen() {
  const { t } = useTranslation();

  return (
    <Screen contentStyle={styles.screen}>
      <View accessible accessibilityRole="alert" style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('errors.configurationTitle')}
        </Text>
        <Text style={styles.body}>{t('errors.configurationBody')}</Text>
        <Text style={styles.hint}>{t('errors.configurationHint')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.error,
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  body: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  hint: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
});

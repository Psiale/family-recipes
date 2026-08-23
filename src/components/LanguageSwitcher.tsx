import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { SupportedLanguage } from '@/i18n';

import { AppButton } from './AppButton';
import { colors, spacing } from './theme';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const setLanguage = (language: SupportedLanguage) => {
    void i18n.changeLanguage(language);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('language.label')}</Text>
      <View style={styles.actions}>
        <AppButton
          label={t('language.spanish')}
          onPress={() => setLanguage('es')}
          variant={i18n.resolvedLanguage === 'es' ? 'primary' : 'secondary'}
        />
        <AppButton
          label={t('language.english')}
          onPress={() => setLanguage('en')}
          variant={i18n.resolvedLanguage === 'en' ? 'primary' : 'secondary'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});

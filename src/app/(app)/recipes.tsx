import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/components/theme';

export default function RecipesScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <View style={styles.card}>
        <Text role="heading" style={styles.title}>
          {t('navigation.recipes')}
        </Text>
        <Text style={styles.body}>{t('navigation.recipesSoon')}</Text>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 18,
    gap: spacing.md,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 17, lineHeight: 26 },
});

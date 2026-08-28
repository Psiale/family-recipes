import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/components/theme';
import { useSession } from '@/features/auth/providers/SessionProvider';
import { useCurrentProfileQuery } from '@/features/profile/useCurrentProfileQuery';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { session, signOut } = useSession();
  const profile = useCurrentProfileQuery(session!.user.id);
  const email = session?.user.email ?? '';

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          {profile.data?.display_name || t('home.welcome')}
        </Text>
        <Text style={styles.body}>{t('home.signedInAs', { email })}</Text>
        <Text style={styles.body}>{t('home.foundationReady')}</Text>
        {profile.isError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {t('errors.profileLoad')}
          </Text>
        ) : null}
      </View>
      <LanguageSwitcher />
      <AppButton
        label={t('auth.signOut')}
        onPress={() => void signOut()}
        variant="secondary"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.xl,
    paddingTop: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
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
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  error: {
    color: colors.error,
  },
});

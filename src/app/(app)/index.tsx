import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/components/theme';
import { useSession } from '@/features/auth/providers/SessionProvider';
import { FamilyWorkspace } from '@/features/families/components/FamilyWorkspace';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { session, signOut } = useSession();
  const email = session?.user.email ?? '';

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.body}>{t('home.signedInAs', { email })}</Text>
      </View>
      <FamilyWorkspace key={session!.user.id} userId={session!.user.id} />
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
  body: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
});

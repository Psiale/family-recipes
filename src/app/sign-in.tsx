import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { colors, fonts, spacing } from '@/components/theme';
import { SignInForm } from '@/features/auth/components/SignInForm';
import { useSession } from '@/features/auth/providers/SessionProvider';

export default function SignInScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { signIn, startPasswordRecovery } = useSession();

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.hero}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('auth.signInTitle')}
        </Text>
        <Text style={styles.subtitle}>{t('auth.signInSubtitle')}</Text>
      </View>
      <SignInForm onSignIn={({ email, password }) => signIn(email, password)} />
      <AppButton
        label={t('auth.recovery.forgot')}
        onPress={startPasswordRecovery}
        variant="secondary"
      />
      <AppButton
        label={t('auth.needAccount')}
        onPress={() => router.push('/sign-up')}
        variant="secondary"
      />
      <LanguageSwitcher />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.xl,
    justifyContent: 'center',
  },
  hero: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontFamily: fonts.heading,
    letterSpacing: -0.7,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 25,
  },
});

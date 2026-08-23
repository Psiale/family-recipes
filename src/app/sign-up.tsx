import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Screen } from '@/components/Screen';
import { colors, spacing } from '@/components/theme';
import { SignUpForm } from '@/features/auth/components/SignUpForm';
import { useSession } from '@/features/auth/providers/SessionProvider';

export default function SignUpScreen() {
  const router = useRouter();
  const { i18n, t } = useTranslation();
  const { signUp } = useSession();
  const locale = i18n.resolvedLanguage === 'en' ? 'en' : 'es';

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.hero}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('auth.signUpTitle')}
        </Text>
        <Text style={styles.subtitle}>{t('auth.signUpSubtitle')}</Text>
        <Text style={styles.hint}>{t('auth.bootstrapHint')}</Text>
      </View>
      <SignUpForm
        onSignUp={({ email, password }) => signUp(email, password, locale)}
      />
      <AppButton
        label={t('auth.haveAccount')}
        onPress={() => router.replace('/sign-in')}
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
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 25,
  },
  hint: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
});

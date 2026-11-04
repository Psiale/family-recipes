import {
  type DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
} from 'expo-router/drawer';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { colors, spacing } from '@/components/theme';
import { useSession } from '@/features/auth/providers/SessionProvider';

export function AppMenu(props: DrawerContentComponentProps) {
  const { t } = useTranslation();
  const { session, signOut } = useSession();
  return (
    <DrawerContentScrollView {...props}>
      <View style={styles.section}>
        <Text role="heading" style={styles.title}>
          {t('app.name')}
        </Text>
        <Text style={styles.email}>{session?.user.email}</Text>
        <AppButton
          label={t('navigation.close')}
          variant="secondary"
          onPress={() => props.navigation.closeDrawer()}
        />
      </View>
      <DrawerItemList {...props} />
      <View style={styles.section}>
        <LanguageSwitcher />
        <AppButton
          label={t('auth.signOut')}
          variant="secondary"
          onPress={() => void signOut()}
        />
      </View>
    </DrawerContentScrollView>
  );
}
const styles = StyleSheet.create({
  section: { padding: spacing.md, gap: spacing.md },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  email: { color: colors.muted, fontSize: 14 },
});

import {
  type DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
} from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Text } from '@/components/Text';
import { colors, fonts, spacing } from '@/components/theme';
import { useSession } from '@/features/auth/providers/SessionProvider';

export function AppMenu(props: DrawerContentComponentProps) {
  const { t } = useTranslation();
  const { session, signOut } = useSession();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
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
      <View
        pointerEvents="none"
        style={[styles.statusBar, { height: insets.top }]}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  statusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.primary,
  },
  section: { padding: spacing.md, gap: spacing.md },
  title: { color: colors.text, fontSize: 22, fontFamily: fonts.heading },
  email: { color: colors.muted, fontSize: 14 },
});

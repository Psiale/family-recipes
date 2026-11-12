import { Drawer, DrawerToggleButton } from 'expo-router/drawer';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors, fonts } from '@/components/theme';
import { useSession } from '@/features/auth/providers/SessionProvider';
import { useSuperAdmin } from '@/features/families/queries';
import { AppMenu } from '@/features/navigation/AppMenu';
import { OnboardingGate } from '@/features/onboarding/OnboardingGate';

export default function AuthenticatedLayout() {
  const { t } = useTranslation();
  const { session } = useSession();
  const role = useSuperAdmin(session!.user.id);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <OnboardingGate userId={session!.user.id}>
        <Drawer
          backBehavior="history"
          drawerContent={(props) => <AppMenu {...props} />}
          screenOptions={{
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: colors.white,
            headerTitleStyle: {
              fontFamily: fonts.heading,
              fontSize: 24,
              fontWeight: 'normal',
            },
            headerLeft: () => (
              <DrawerToggleButton
                accessibilityLabel={t('navigation.open')}
                tintColor={colors.white}
              />
            ),
            sceneStyle: { backgroundColor: colors.background },
            drawerStyle: { backgroundColor: colors.surface },
            drawerActiveTintColor: colors.primary,
            drawerActiveBackgroundColor: colors.secondary,
            drawerLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 18 },
            drawerInactiveTintColor: colors.text,
          }}
        >
          <Drawer.Screen
            name="index"
            options={{ title: t('navigation.tree') }}
          />
          <Drawer.Screen
            name="how-to-use"
            options={{ title: t('guide.help') }}
          />
          <Drawer.Screen
            name="delegates"
            options={{ title: t('delegation.title') }}
          />
          <Drawer.Screen
            name="family-administration"
            options={{
              title: t('administration.title'),
              drawerItemStyle:
                role.isSuccess && role.data ? undefined : { display: 'none' },
            }}
          />
          <Drawer.Screen
            name="recipes"
            options={{ title: t('navigation.recipes') }}
          />
        </Drawer>
      </OnboardingGate>
    </GestureHandlerRootView>
  );
}

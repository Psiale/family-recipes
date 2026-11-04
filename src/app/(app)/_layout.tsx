import { Drawer, DrawerToggleButton } from 'expo-router/drawer';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '@/components/theme';
import { useSession } from '@/features/auth/providers/SessionProvider';
import { AppMenu } from '@/features/navigation/AppMenu';
import { OnboardingGate } from '@/features/onboarding/OnboardingGate';

export default function AuthenticatedLayout() {
  const { t } = useTranslation();
  const { session } = useSession();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <OnboardingGate userId={session!.user.id}>
        <Drawer
          backBehavior="history"
          drawerContent={(props) => <AppMenu {...props} />}
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerLeft: () => (
              <DrawerToggleButton
                accessibilityLabel={t('navigation.open')}
                tintColor={colors.text}
              />
            ),
            sceneStyle: { backgroundColor: colors.background },
            drawerStyle: { backgroundColor: colors.surface },
            drawerActiveTintColor: colors.primary,
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
            name="recipes"
            options={{ title: t('navigation.recipes') }}
          />
        </Drawer>
      </OnboardingGate>
    </GestureHandlerRootView>
  );
}

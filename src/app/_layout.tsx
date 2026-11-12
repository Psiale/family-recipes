import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { ConfigurationErrorScreen } from '@/components/ConfigurationErrorScreen';
import { FontAvailability } from '@/components/Text';
import { fonts } from '@/components/theme';
import { getPublicEnvResult } from '@/config/env';
import {
  SessionProvider,
  useSession,
} from '@/features/auth/providers/SessionProvider';
import { restoreLanguage } from '@/i18n';
import { logger } from '@/lib/logger';
import { QueryProvider } from '@/lib/query/QueryProvider';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isLanguageReady, setIsLanguageReady] = useState(false);
  const [fontsReady, fontError] = useFonts({
    [fonts.heading]: require('../../assets/fonts/BitterBold.ttf'),
    [fonts.body]: require('../../assets/fonts/AtkinsonRegular.ttf'),
    [fonts.bodyBold]: require('../../assets/fonts/AtkinsonBold.ttf'),
  });
  const ready = isLanguageReady && (fontsReady || Boolean(fontError));
  useEffect(() => {
    if (fontError)
      logger.warn('Unable to load bundled fonts; using the system font.');
  }, [fontError]);
  const publicEnv = getPublicEnvResult();

  useEffect(() => {
    void restoreLanguage()
      .catch(() => logger.warn('Unable to restore the saved language.'))
      .finally(() => setIsLanguageReady(true));
  }, []);

  useEffect(() => {
    if (ready && !publicEnv.success) {
      void SplashScreen.hideAsync();
    }
  }, [ready, publicEnv.success]);

  if (!ready) {
    return null;
  }

  if (!publicEnv.success) {
    return (
      <FontAvailability value={fontsReady}>
        <StatusBar style="dark" />
        <ConfigurationErrorScreen />
      </FontAvailability>
    );
  }

  return (
    <FontAvailability value={fontsReady}>
      <StatusBar style="dark" />
      <SessionProvider>
        <SessionQueries />
      </SessionProvider>
    </FontAvailability>
  );
}

function SessionQueries() {
  const { session } = useSession();
  return (
    <QueryProvider key={session?.user.id ?? 'anonymous'}>
      <RootNavigator />
    </QueryProvider>
  );
}

export function RootNavigator() {
  const { isLoading, session, recoveryMode } = useSession();

  useEffect(() => {
    if (!isLoading) {
      void SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={Boolean(session) && !recoveryMode}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session && !recoveryMode}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(recoveryMode)}>
        <Stack.Screen name="password-recovery" />
      </Stack.Protected>
    </Stack>
  );
}

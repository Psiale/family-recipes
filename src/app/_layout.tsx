import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { ConfigurationErrorScreen } from '@/components/ConfigurationErrorScreen';
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
  const publicEnv = getPublicEnvResult();

  useEffect(() => {
    void restoreLanguage()
      .catch(() => logger.warn('Unable to restore the saved language.'))
      .finally(() => setIsLanguageReady(true));
  }, []);

  useEffect(() => {
    if (isLanguageReady && !publicEnv.success) {
      void SplashScreen.hideAsync();
    }
  }, [isLanguageReady, publicEnv.success]);

  if (!isLanguageReady) {
    return null;
  }

  if (!publicEnv.success) {
    return <ConfigurationErrorScreen />;
  }

  return (
    <QueryProvider>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </QueryProvider>
  );
}

export function RootNavigator() {
  const { isLoading, session } = useSession();

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
      <Stack.Protected guard={Boolean(session)}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
    </Stack>
  );
}

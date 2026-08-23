import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors } from '@/components/theme';

export default function AuthenticatedLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen name="index" options={{ title: t('home.title') }} />
    </Stack>
  );
}

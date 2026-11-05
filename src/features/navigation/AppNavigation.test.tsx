import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen, userEvent } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { useState } from 'react';
import { Text, TextInput } from 'react-native';

import AppLayout from '@/app/(app)/_layout';
import FamilyAdministrationRoute from '@/app/(app)/family-administration';
import GuideScreen from '@/app/(app)/how-to-use';
import RecipesScreen from '@/app/(app)/recipes';
import { useSession } from '@/features/auth/providers/SessionProvider';
import * as familyApi from '@/features/families/api';
import { guideStorageKey } from '@/features/onboarding/OnboardingGate';

jest.mock('@/features/families/api');
jest.mock('@/features/auth/providers/SessionProvider', () => ({
  useSession: jest.fn(),
}));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
// Exercise the real router/drawer navigator without native animation machinery.
jest.mock('react-native-drawer-layout', () => {
  const actual = jest.requireActual('react-native-drawer-layout');
  const { View } = jest.requireActual('react-native');
  return {
    ...actual,
    Drawer: ({
      open,
      children,
      renderDrawerContent,
    }: {
      open: boolean;
      children: React.ReactNode;
      renderDrawerContent: () => React.ReactNode;
    }) => (
      <actual.DrawerProgressContext.Provider value={{ value: open ? 1 : 0 }}>
        <View
          accessibilityElementsHidden={open}
          importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </View>
        {open ? renderDrawerContent() : null}
      </actual.DrawerProgressContext.Provider>
    ),
  };
});
jest.useFakeTimers();

function TreeFixture() {
  const [value, setValue] = useState('');
  return (
    <>
      <Text>Tree workspace</Text>
      <TextInput
        accessibilityLabel="Draft name"
        value={value}
        onChangeText={setValue}
      />
    </>
  );
}

async function openApp(superAdmin: boolean, initialUrl = '/') {
  jest.mocked(familyApi.isSuperAdmin).mockResolvedValue(superAdmin);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const signOut = jest.fn();
  jest.mocked(useSession).mockReturnValue({
    session: { user: { id: 'one', email: 'test@example.com' } } as Session,
    signOut,
  } as unknown as ReturnType<typeof useSession>);
  await AsyncStorage.setItem(guideStorageKey('one'), 'seen');
  await renderRouter(
    {
      _layout: () => (
        <QueryClientProvider client={client}>
          <AppLayout />
        </QueryClientProvider>
      ),
      'family-administration': FamilyAdministrationRoute,
      index: TreeFixture,
      'how-to-use': GuideScreen,
      recipes: RecipesScreen,
      delegates: () => null,
    },
    { initialUrl },
  );
  return signOut;
}

beforeEach(() => jest.clearAllMocks());

it('opens separate screens through the drawer and preserves tree drafts', async () => {
  const signOut = await openApp(false);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Draft name'), 'Grandma');
  await user.press(screen.getByRole('button', { name: 'Abrir menú' }));
  expect(screen.queryByText('Administración de familias')).toBeNull();
  await user.press(await screen.findByText('Recetas'));
  expect(await screen.findByText(/Aquí estarán las recetas/)).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Abrir menú' }));
  await user.press(await screen.findByText('Cómo usar la app'));
  expect(await screen.findByText('Vamos paso a paso')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Omitir por ahora' }));
  expect(await screen.findByLabelText('Draft name')).toHaveDisplayValue(
    'Grandma',
  );
  await user.press(screen.getByRole('button', { name: 'Abrir menú' }));
  expect(await screen.findByText('test@example.com')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
  expect(signOut).toHaveBeenCalledTimes(1);
});

it('opens the family directory from the hamburger menu for a Super Admin', async () => {
  jest
    .mocked(familyApi.searchFamilies)
    .mockResolvedValue({ families: [], more: false });
  await openApp(true);
  const user = userEvent.setup();
  await user.press(await screen.findByRole('button', { name: 'Abrir menú' }));
  await user.press(await screen.findByText('Administración de familias'));
  expect(
    await screen.findByLabelText('Buscar una familia por nombre'),
  ).toBeOnTheScreen();
});

it('denies a direct administration link for an ordinary account before reading family data', async () => {
  await openApp(false, '/family-administration');
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Solo los súper administradores pueden acceder a esta pantalla.',
  );
  expect(familyApi.searchFamilies).not.toHaveBeenCalled();
  expect(familyApi.listDeletionRequests).not.toHaveBeenCalled();
  expect(familyApi.listFamilyPeople).not.toHaveBeenCalled();
});

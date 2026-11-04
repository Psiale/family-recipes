import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { screen, userEvent } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { useState } from 'react';
import { Text, TextInput } from 'react-native';

import AppLayout from '@/app/(app)/_layout';
import GuideScreen from '@/app/(app)/how-to-use';
import RecipesScreen from '@/app/(app)/recipes';
import { useSession } from '@/features/auth/providers/SessionProvider';
import { guideStorageKey } from '@/features/onboarding/OnboardingGate';

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

it('opens separate screens through the drawer and preserves tree drafts', async () => {
  const signOut = jest.fn();
  jest.mocked(useSession).mockReturnValue({
    session: { user: { id: 'one', email: 'test@example.com' } } as Session,
    signOut,
  } as unknown as ReturnType<typeof useSession>);
  await AsyncStorage.setItem(guideStorageKey('one'), 'seen');
  await renderRouter(
    {
      _layout: AppLayout,
      index: TreeFixture,
      'how-to-use': GuideScreen,
      recipes: RecipesScreen,
    },
    { initialUrl: '/' },
  );
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Draft name'), 'Grandma');
  await user.press(screen.getByRole('button', { name: 'Abrir menú' }));
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

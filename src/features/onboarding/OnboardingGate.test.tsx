import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import i18n from '@/i18n';

import { guideStorageKey, OnboardingGate } from './OnboardingGate';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn() } }));
jest.useFakeTimers();

function Workspace({ openHelp }: { openHelp: () => void }) {
  const [count, setCount] = useState(0);
  return (
    <View>
      <Text>Workspace {count}</Text>
      <AppButton label="Edit draft" onPress={() => setCount(count + 1)} />
      <AppButton label="Help" onPress={openHelp} />
    </View>
  );
}
function App({ userId = 'one' }: { userId?: string }) {
  return (
    <OnboardingGate userId={userId}>
      {(openHelp) => <Workspace openHelp={openHelp} />}
    </OnboardingGate>
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await i18n.changeLanguage('es');
});

it('guides a new account through four steps, supports back, and saves completion', async () => {
  const user = userEvent.setup();
  await render(<App />);
  await screen.findByRole('heading', { name: 'Vamos paso a paso' });
  expect(screen.queryByText('Workspace 0')).toBeNull();
  expect(screen.getByText('Paso 1 de 4')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Siguiente' }));
  expect(
    screen.getByRole('heading', { name: 'Tu lugar en la familia' }),
  ).toBeOnTheScreen();
  expect(screen.getByText(/Si alguien ya creó tu perfil/)).toHaveTextContent(
    /Ya tengo un código para vincular mi perfil/,
  );
  await user.press(screen.getByRole('button', { name: 'Atrás' }));
  expect(screen.getByText('Paso 1 de 4')).toBeOnTheScreen();
  for (let i = 0; i < 3; i++)
    await user.press(screen.getByRole('button', { name: 'Siguiente' }));
  expect(
    screen.getByRole('heading', { name: 'Conecta tu árbol' }),
  ).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Empezar' }));
  expect(screen.getByText('Workspace 0')).toBeOnTheScreen();
  expect(await AsyncStorage.getItem(guideStorageKey('one'))).toBe('seen');
  await screen.unmount();
  await render(<App />);
  expect(await screen.findByText('Workspace 0')).toBeOnTheScreen();
  expect(screen.queryByText('Vamos paso a paso')).toBeNull();
});

it('remembers skipping and reopens Help without losing work underneath it', async () => {
  const user = userEvent.setup();
  await render(<App />);
  await user.press(
    await screen.findByRole('button', { name: 'Omitir por ahora' }),
  );
  expect(await AsyncStorage.getItem(guideStorageKey('one'))).toBe('seen');
  await user.press(screen.getByRole('button', { name: 'Edit draft' }));
  await user.press(screen.getByRole('button', { name: 'Help' }));
  expect(screen.getByText('Paso 1 de 4')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Omitir por ahora' }));
  expect(screen.getByText('Workspace 1')).toBeOnTheScreen();
});

it('shows the guide for another account even if the previous account skipped it', async () => {
  await AsyncStorage.setItem(guideStorageKey('one'), 'seen');
  await render(<App />);
  await screen.findByText('Workspace 0');
  await screen.rerender(<App userId="two" />);
  expect(await screen.findByText('Vamos paso a paso')).toBeOnTheScreen();
  expect(screen.queryByText('Workspace 0')).toBeNull();
  expect(await AsyncStorage.getItem(guideStorageKey('two'))).toBeNull();
});

it('does not let a slow previous-account read dismiss the current guide', async () => {
  let resolveOld!: (value: string | null) => void;
  jest.mocked(AsyncStorage.getItem).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  await render(<App />);
  await screen.rerender(<App userId="two" />);
  await screen.findByText('Vamos paso a paso');
  resolveOld('seen');
  expect(await screen.findByText('Vamos paso a paso')).toBeOnTheScreen();
  expect(screen.queryByText('Workspace 0')).toBeNull();
});

it('never blocks entry when storage is unavailable', async () => {
  const user = userEvent.setup();
  jest
    .mocked(AsyncStorage.getItem)
    .mockRejectedValueOnce(new Error('storage unavailable'));
  await render(<App />);
  await screen.findByText('Vamos paso a paso');
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('storage unavailable'));
  await user.press(screen.getByRole('button', { name: 'Omitir por ahora' }));
  expect(screen.getByText('Workspace 0')).toBeOnTheScreen();
});

it('lets users change language in the guide without losing their step', async () => {
  const user = userEvent.setup();
  await render(<App />);
  await user.press(await screen.findByRole('button', { name: 'Siguiente' }));
  await user.press(screen.getByRole('button', { name: 'English' }));
  expect(screen.getByText('Step 2 of 4')).toBeOnTheScreen();
  expect(
    screen.getByRole('heading', { name: 'Your place in the family' }),
  ).toBeOnTheScreen();
  expect(
    screen.getByText(/If someone already created your profile/),
  ).toHaveTextContent(/I have a code to link my profile/);
});

import type { Session } from '@supabase/supabase-js';
import { render, screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { AppButton } from '@/components/AppButton';

import { SessionProvider, useSession } from './SessionProvider';

const unsubscribe = jest.fn();
const mockAuth = {
  exchangeCodeForSession: jest.fn(async () => ({ error: null })),
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(() => ({
    data: { subscription: { unsubscribe } },
  })),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  signUp: jest.fn(),
  startAutoRefresh: jest.fn(),
  stopAutoRefresh: jest.fn(),
};

jest.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ auth: mockAuth }),
}));

jest.mock('expo-linking', () => ({
  createURL: () => 'familyrecipes://sign-in',
  parse: () => ({ queryParams: {} }),
}));

const restoredSession = {
  user: { email: 'chef@example.com', id: 'user-id' },
} as Session;

function SessionProbe() {
  const { isLoading, session, signOut, signUp } = useSession();
  const [signUpStatus, setSignUpStatus] = useState('');

  if (isLoading) {
    return <Text>Cargando prueba</Text>;
  }

  return (
    <>
      <Text>{session?.user.email ?? 'Sesión pública'}</Text>
      <Text>{signUpStatus}</Text>
      <AppButton label="Cerrar sesión" onPress={() => void signOut()} />
      <AppButton
        label="Crear cuenta"
        onPress={() => {
          void signUp('new@example.com', 'password1', 'es').then(({ status }) =>
            setSignUpStatus(status),
          );
        }}
      />
    </>
  );
}

describe('SessionProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.getSession.mockResolvedValue({
      data: { session: restoredSession },
    });
    mockAuth.signOut.mockResolvedValue({ error: null });
    mockAuth.signUp.mockResolvedValue({
      data: { session: null, user: { identities: [{ id: 'identity-id' }] } },
      error: null,
    });
  });

  it('restores the persisted Supabase session', async () => {
    await render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );

    expect(await screen.findByText('chef@example.com')).toBeOnTheScreen();
    expect(mockAuth.getSession).toHaveBeenCalledTimes(1);
    expect(mockAuth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('delegates sign-out to Supabase Auth', async () => {
    const user = userEvent.setup();
    await render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );

    await user.press(
      await screen.findByRole('button', { name: 'Cerrar sesión' }),
    );
    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
  });

  it('passes locale metadata and reports confirmation-required sign-up', async () => {
    const user = userEvent.setup();
    await render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );

    await user.press(
      await screen.findByRole('button', { name: 'Crear cuenta' }),
    );

    expect(await screen.findByText('confirmationRequired')).toBeOnTheScreen();
    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      options: {
        data: { locale: 'es' },
        emailRedirectTo: 'familyrecipes://sign-in',
      },
      password: 'password1',
    });
  });
});

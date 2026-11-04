import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { useState } from 'react';
import { Linking, Text } from 'react-native';

import { AppButton } from '@/components/AppButton';

import { recoveryStorageKey } from '../recovery';

import { SessionProvider, useSession } from './SessionProvider';

const unsubscribe = jest.fn();
let mockAuthListener: (event: AuthChangeEvent, session: Session | null) => void;
let mockUrlListener: (event: { url: string }) => void;
const mockAuth = {
  exchangeCodeForSession: jest.fn(async () => ({ error: null })),
  getSession: jest.fn(),
  onAuthStateChange: jest.fn((listener: typeof mockAuthListener) => {
    mockAuthListener = listener;
    return { data: { subscription: { unsubscribe } } };
  }),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  signUp: jest.fn(),
  startAutoRefresh: jest.fn(),
  stopAutoRefresh: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  updateUser: jest.fn(),
};

jest.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ auth: mockAuth }),
}));

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `familyrecipes://${path}`,
  parse: () => ({ queryParams: {} }),
}));

const restoredSession = {
  user: { email: 'chef@example.com', id: 'user-id' },
} as Session;

function SessionProbe() {
  const {
    isLoading,
    session,
    signOut,
    signUp,
    recoveryMode,
    startPasswordRecovery,
    requestPasswordReset,
    updateRecoveredPassword,
    cancelPasswordRecovery,
  } = useSession();
  const [signUpStatus, setSignUpStatus] = useState('');

  if (isLoading) {
    return <Text>Cargando prueba</Text>;
  }

  return (
    <>
      <Text>{session?.user.email ?? 'Sesión pública'}</Text>
      <Text>{signUpStatus}</Text>
      <Text>{`Recovery: ${recoveryMode ?? 'none'}`}</Text>
      <AppButton label="Recover" onPress={startPasswordRecovery} />
      <AppButton
        label="Request email"
        onPress={() =>
          void requestPasswordReset('chef@example.com').then(() =>
            setSignUpStatus('sent'),
          )
        }
      />
      <AppButton
        label="Update password"
        onPress={() =>
          void updateRecoveredPassword('NewPassword123!')
            .then(() => setSignUpStatus('updated'))
            .catch(() => setSignUpStatus('update denied'))
        }
      />
      <AppButton
        label="Cancel recovery"
        onPress={() => void cancelPasswordRecovery()}
      />
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
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest
      .spyOn(Linking, 'addEventListener')
      .mockImplementation((_type, listener) => {
        mockUrlListener = listener;
        return { remove: jest.fn() };
      });
    mockAuth.exchangeCodeForSession
      .mockReset()
      .mockResolvedValue({ error: null });
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null });
    mockAuth.updateUser.mockResolvedValue({ error: null });
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

  it('requests a reset email through the already configured redirect', async () => {
    await render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );
    const user = userEvent.setup();
    await user.press(await screen.findByRole('button', { name: 'Recover' }));
    expect(screen.getByText('Recovery: request')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Request email' }));
    await screen.findByText('sent');
    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith(
      'chef@example.com',
      { redirectTo: 'familyrecipes://sign-in' },
    );
  });

  it('requires a verified recovery event and clears its marker after saving', async () => {
    await render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );
    const user = userEvent.setup();
    await user.press(
      await screen.findByRole('button', { name: 'Update password' }),
    );
    await screen.findByText('update denied');
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
    await act(() => mockAuthListener('PASSWORD_RECOVERY', restoredSession));
    await screen.findByText('Recovery: update');
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(recoveryStorageKey)).toBe('user-id'),
    );
    await user.press(screen.getByRole('button', { name: 'Update password' }));
    await screen.findByText('Recovery: complete');
    expect(mockAuth.updateUser).toHaveBeenCalledWith({
      password: 'NewPassword123!',
    });
    expect(await AsyncStorage.getItem(recoveryStorageKey)).toBeNull();
  });

  it('resumes verified recovery after restarting the app', async () => {
    await AsyncStorage.setItem(recoveryStorageKey, 'user-id');
    await render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );
    await screen.findByText('Recovery: update');
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Cancel recovery' }));
    await screen.findByText('Recovery: none');
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(await AsyncStorage.getItem(recoveryStorageKey)).toBeNull();
  });

  it('does not restore another account’s recovery marker', async () => {
    await AsyncStorage.setItem(recoveryStorageKey, 'someone-else');
    await render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );
    await screen.findByText('Recovery: none');
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Update password' }));
    await screen.findByText('update denied');
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });

  it('deduplicates cold-start and foreground delivery of the same code', async () => {
    const url = 'familyrecipes:///sign-in?code=test-recovery-code';
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(url);
    mockAuth.exchangeCodeForSession.mockImplementation(async () => {
      mockAuthListener('PASSWORD_RECOVERY', restoredSession);
      return { error: null };
    });
    await render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );
    await screen.findByText('Recovery: update');
    await act(() => mockUrlListener({ url }));
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('shows an invalid-link state when code exchange fails', async () => {
    mockAuth.exchangeCodeForSession.mockResolvedValue({
      error: { code: 'flow_state_expired' },
    } as never);
    jest
      .spyOn(Linking, 'getInitialURL')
      .mockResolvedValue('familyrecipes:///sign-in?code=expired');
    await render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );
    await screen.findByText('Recovery: invalid');
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });

  it('keeps normal signup confirmation separate from password recovery', async () => {
    jest
      .spyOn(Linking, 'getInitialURL')
      .mockResolvedValue('familyrecipes:///sign-in?code=signup-code');
    mockAuth.exchangeCodeForSession.mockImplementation(async () => {
      mockAuthListener('SIGNED_IN', restoredSession);
      return { error: null };
    });
    await render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );
    await screen.findByText('chef@example.com');
    expect(screen.getByText('Recovery: none')).toBeOnTheScreen();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Update password' }));
    await screen.findByText('update denied');
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });

  it('does not overwrite a fresh recovery event with a stale restored session', async () => {
    let restore!: (value: { data: { session: Session | null } }) => void;
    mockAuth.getSession.mockReturnValue(
      new Promise((resolve) => {
        restore = resolve;
      }),
    );
    await render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );
    await act(() => mockAuthListener('PASSWORD_RECOVERY', restoredSession));
    await act(async () => restore({ data: { session: null } }));
    await screen.findByText('Recovery: update');
    expect(screen.getByText('chef@example.com')).toBeOnTheScreen();
  });
});

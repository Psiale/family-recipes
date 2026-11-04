import type { Session } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { RootNavigator } from '@/app/_layout';
import {
  useSession,
  type RecoveryMode,
} from '@/features/auth/providers/SessionProvider';

jest.mock('@/features/auth/providers/SessionProvider', () => ({
  useSession: jest.fn(),
}));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => undefined),
  hideAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-router', () => {
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const Stack = ({ children }: PropsWithChildren) => <>{children}</>;
  Stack.Protected = function Protected({
    guard,
    children,
  }: PropsWithChildren<{ guard: boolean }>) {
    return guard ? <>{children}</> : null;
  };
  Stack.Screen = function Route({ name }: { name: string }) {
    return <Text>{name}</Text>;
  };
  return { Stack };
});

const session = { user: { id: 'recovery-test-user' } } as Session;
it.each(['request', 'update', 'invalid', 'complete'] as const)(
  'keeps the family workspace inaccessible during %s recovery, even with a session',
  async (recoveryMode: RecoveryMode) => {
    jest.mocked(useSession).mockReturnValue({
      isLoading: false,
      session,
      recoveryMode,
    } as ReturnType<typeof useSession>);
    await render(<RootNavigator />);
    expect(screen.getByText('password-recovery')).toBeOnTheScreen();
    expect(screen.queryByText('(app)')).toBeNull();
    expect(screen.queryByText('sign-in')).toBeNull();
  },
);
it('shows normal authenticated routes after recovery ends', async () => {
  jest.mocked(useSession).mockReturnValue({
    isLoading: false,
    session,
    recoveryMode: null,
  } as ReturnType<typeof useSession>);
  await render(<RootNavigator />);
  expect(screen.getByText('(app)')).toBeOnTheScreen();
  expect(screen.queryByText('password-recovery')).toBeNull();
});

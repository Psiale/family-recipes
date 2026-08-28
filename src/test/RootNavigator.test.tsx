import type { Session } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react-native';

import { RootNavigator } from '@/app/_layout';

const mockUseSession = jest.fn();

jest.mock('@/features/auth/providers/SessionProvider', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => mockUseSession(),
}));

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(async () => undefined),
  preventAutoHideAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-router', () => {
  const { Text, View } = jest.requireActual('react-native');
  function Stack({ children }: { children: React.ReactNode }) {
    return <View>{children}</View>;
  }
  Stack.Protected = function Protected({
    children,
    guard,
  }: {
    children: React.ReactNode;
    guard: boolean;
  }) {
    return guard ? <View>{children}</View> : null;
  };
  Stack.Screen = function Screen({ name }: { name: string }) {
    return <Text>{name}</Text>;
  };
  return { Stack };
});

const session = { user: { id: 'user-id' } } as Session;

describe('RootNavigator', () => {
  it('shows public routes to unauthenticated users', async () => {
    mockUseSession.mockReturnValue({ isLoading: false, session: null });

    await render(<RootNavigator />);

    expect(screen.getByText('sign-in')).toBeOnTheScreen();
    expect(screen.getByText('sign-up')).toBeOnTheScreen();
    expect(screen.queryByText('(app)')).not.toBeOnTheScreen();
  });

  it('shows protected routes to authenticated users', async () => {
    mockUseSession.mockReturnValue({ isLoading: false, session });

    await render(<RootNavigator />);

    expect(screen.getByText('(app)')).toBeOnTheScreen();
    expect(screen.queryByText('sign-in')).not.toBeOnTheScreen();
    expect(screen.queryByText('sign-up')).not.toBeOnTheScreen();
  });
});

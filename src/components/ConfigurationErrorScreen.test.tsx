import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfigurationErrorScreen } from './ConfigurationErrorScreen';

describe('ConfigurationErrorScreen', () => {
  it('renders localized recovery guidance', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { height: 844, width: 390, x: 0, y: 0 },
          insets: { bottom: 0, left: 0, right: 0, top: 0 },
        }}
      >
        <ConfigurationErrorScreen />
      </SafeAreaProvider>,
    );

    expect(
      screen.getByRole('header', { name: 'Configuración incompleta' }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/EXPO_PUBLIC_SUPABASE_URL/)).toBeOnTheScreen();
  });
});

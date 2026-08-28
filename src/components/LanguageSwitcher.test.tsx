import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, userEvent } from '@testing-library/react-native';

import i18n, { LANGUAGE_STORAGE_KEY } from '@/i18n';

import { LanguageSwitcher } from './LanguageSwitcher';

jest.useFakeTimers();

describe('LanguageSwitcher', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await i18n.changeLanguage('es');
  });

  it('switches to English and persists the choice', async () => {
    const user = userEvent.setup();
    await render(<LanguageSwitcher />);

    await user.press(screen.getByRole('button', { name: 'English' }));

    expect(await screen.findByText('Language')).toBeOnTheScreen();
    await expect(AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)).resolves.toBe(
      'en',
    );
  });
});

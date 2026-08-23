import { en } from './locales/en';
import { es } from './locales/es';

import i18n, { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './index';

function collectKeys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === 'object' && child !== null ? collectKeys(child, path) : [path];
  });
}

describe('localization resources', () => {
  afterEach(async () => {
    await i18n.changeLanguage(DEFAULT_LANGUAGE);
  });

  it('uses Spanish by default and exposes both V1 languages', () => {
    expect(DEFAULT_LANGUAGE).toBe('es');
    expect(i18n.language).toBe('es');
    expect(SUPPORTED_LANGUAGES).toEqual(['es', 'en']);
  });

  it('keeps English and Spanish localization keys in parity', () => {
    expect(collectKeys(en).sort()).toEqual(collectKeys(es).sort());
  });

  it('can switch to English', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('auth.signIn')).toBe('Sign in');
  });
});

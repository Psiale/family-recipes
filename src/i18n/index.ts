import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { en } from './locales/en';
import { es } from './locales/es';

export const DEFAULT_LANGUAGE = 'es' as const;
export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export const LANGUAGE_STORAGE_KEY = 'family-recipes.language';
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// i18next documents initialization through the default instance's fluent API.
// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

export default i18n;

function isSupportedLanguage(value: string | null): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.some((language) => language === value);
}

export async function restoreLanguage() {
  const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  const language = isSupportedLanguage(savedLanguage)
    ? savedLanguage
    : DEFAULT_LANGUAGE;
  // eslint-disable-next-line import/no-named-as-default-member
  await i18n.changeLanguage(language);
  return language;
}

export async function setAppLanguage(language: SupportedLanguage) {
  // eslint-disable-next-line import/no-named-as-default-member
  await i18n.changeLanguage(language);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

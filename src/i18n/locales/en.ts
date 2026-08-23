import type { TranslationResources } from './es';

export const en = {
  app: {
    name: 'Family Recipe Tree',
    loading: 'Loading…',
  },
  auth: {
    email: 'Email address',
    password: 'Password',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    signInTitle: 'Your family recipe tree',
    signInSubtitle: 'Preserve the recipes and stories that bring your family together.',
    signOut: 'Sign out',
    genericError: 'We could not sign you in. Check your details and try again.',
  },
  home: {
    title: 'Home',
    welcome: 'Welcome to your recipe tree',
    signedInAs: 'Signed in as {{email}}',
    foundationReady: 'The app foundation is ready for you to create your first family.',
  },
  language: {
    label: 'Language',
    spanish: 'Español',
    english: 'English',
  },
  validation: {
    emailRequired: 'Enter your email address.',
    emailInvalid: 'Enter a valid email address.',
    passwordRequired: 'Enter your password.',
  },
  errors: {
    configurationTitle: 'Incomplete configuration',
    configurationBody: 'Required environment variables are missing. Check the .env file.',
    profileLoad: 'We could not load your profile.',
  },
} as const satisfies TranslationResources;

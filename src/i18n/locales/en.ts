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
    signInSubtitle:
      'Preserve the recipes and stories that bring your family together.',
    signOut: 'Sign out',
    genericError: 'We could not sign you in. Check your details and try again.',
    createAccount: 'Create account',
    creatingAccount: 'Creating account…',
    signUpTitle: 'Create your account',
    signUpSubtitle: "Start preserving your family's recipes and stories.",
    bootstrapHint:
      'If this is the first account, use the Super Admin email configured on the server.',
    haveAccount: 'Already have an account? Sign in',
    needAccount: 'Need an account? Create one',
    confirmPassword: 'Confirm password',
    confirmationRequiredTitle: 'Confirm your email',
    confirmationRequiredBody:
      'Check your inbox and confirm your email before signing in.',
    existingAccount:
      'An account with this email already exists. Sign in or reset your password.',
    signUpGenericError: 'We could not create your account. Try again.',
  },
  home: {
    title: 'Home',
    welcome: 'Welcome to your recipe tree',
    signedInAs: 'Signed in as {{email}}',
    foundationReady:
      'The app foundation is ready for you to create your first family.',
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
    passwordMinimum: 'Password must be at least 8 characters.',
    passwordConfirmationRequired: 'Confirm your password.',
    passwordsMismatch: 'Passwords do not match.',
  },
  errors: {
    configurationTitle: 'Incomplete configuration',
    configurationBody:
      'Required environment variables are missing. Check the .env file.',
    configurationHint:
      'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to valid values.',
    profileLoad: 'We could not load your profile.',
  },
} as const satisfies TranslationResources;

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
  families: {
    onboardingTitle: 'Your person profile',
    onboardingExplanation:
      'Your account signs you in. Your profile identifies the person who owns their recipes. If someone already created your profile, use their code instead of creating another.',
    createProfile: 'Create my profile',
    personName: 'Person’s name',
    biography: 'Story or biography (optional)',
    familyName: 'Family name',
    description: 'Description (optional)',
    saving: 'Saving…',
    cancel: 'Cancel',
    done: 'Done',
    retry: 'Try again',
    refresh: 'Refresh families',
    refreshPeople: 'Refresh people',
    welcome: 'Hello, {{name}}',
    identityExplanation:
      'Your profile is the same across all your families. Switching families does not change who owns a recipe.',
    yourFamilies: 'Your families',
    noFamilies:
      'You do not belong to a family yet. Create your first one to begin.',
    createFamily: 'Create family',
    ownerExplanation:
      'You will own the new family. The family and your membership are created together.',
    yourRole: 'Your role: {{role}}',
    people: 'Family people',
    addPerson: 'Add person',
    managedExplanation:
      'Create a profile without an account for someone in this family. They will be added as a member and you will manage their profile. This does not create a sign-in account.',
    linked: 'Linked account',
    managed: 'Managed profile',
    personSummary: '{{role}} · {{status}}',
    haveClaimCode: 'I have a code to link my profile',
    claimProfile: 'Link my profile',
    claimCode: 'Profile claim code',
    claimExplanation:
      'Use the code shared by your profile manager. You must have confirmed the email the code was issued to. Your profile, memberships, and recipes stay intact. Previous managers’ permissions will be revoked.',
    claimFor: 'Link an account for {{name}}',
    issueClaim: 'Generate code',
    issueExplanation:
      'Enter this person’s email. Only an account with that verified email and no other profile can use the code. It expires in 7 days and replaces any previous code. Linking the account revokes previous managers’ permissions.',
    codeReady: 'Code ready to share',
    shareCode:
      'Share this code privately with that person. No email has been sent. The code is shown only here and expires in 7 days.',
    roles: {
      OWNER: 'Owner',
      ADMIN: 'Admin',
      MEMBER: 'Member',
      READ_ONLY: 'Read-only',
    },
    validation: {
      nameRequired: 'Enter a name.',
      nameLong: 'Use a name up to 120 characters.',
      descriptionLong: 'Use a description up to 2000 characters.',
      claimCode: 'Enter the complete 64-character code.',
    },
    errors: {
      load: 'We could not load this information. Check your connection and try again.',
      save: 'We could not save your changes. Check your connection and try again.',
      alreadyLinked:
        'Your account already has a profile. Refresh the screen to continue.',
      permission:
        'You do not have permission for this action. To claim a profile, first confirm the correct email.',
      invalid:
        'The details or code are invalid. The code may have expired or belong to another email.',
      onboarding: 'Create or claim your person profile first.',
    },
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

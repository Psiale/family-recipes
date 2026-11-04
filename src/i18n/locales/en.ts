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
    recovery: {
      forgot: 'Forgot password?',
      title: 'Reset your password',
      instructions:
        'Enter your account email. Request the link here, then open it on this same device. Use only the latest email.',
      send: 'Send reset email',
      sent: 'If an account exists for this email, you will receive a reset link. Check your inbox and spam folder. Open the latest link on this device.',
      sendError:
        'We could not request the email. Check your connection or wait a few minutes before trying again.',
      newTitle: 'Choose a new password',
      newPassword: 'New password',
      newInstructions:
        'Use at least 8 characters and confirm your new password below.',
      save: 'Save new password',
      updateError:
        'We could not update your password. Check your connection. If the link expired, cancel and request a new email.',
      samePassword: 'Choose a password different from your current password.',
      weakPassword:
        'This password does not meet the account security requirements. Choose a stronger password.',
      invalidTitle: 'This email link could not be verified',
      invalid:
        'The link may have expired, already been used, or been requested on another device. Request a new email from this device.',
      sendAnother: 'Request a new reset email',
      completeTitle: 'Password updated',
      complete:
        'Your new password is saved. Your account, profile, and family data are unchanged.',
      continue: 'Continue to my families',
      cancel: 'Cancel and return',
      cancelError:
        'We could not close recovery. Check your connection and try again.',
    },
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
  guide: {
    label: 'Welcome to your family',
    progress: 'Step {{current}} of {{total}}',
    next: 'Next',
    back: 'Back',
    skip: 'Skip for now',
    start: 'Get started',
    tip: 'Good to know',
    help: 'How to use the app',
    revisit: 'You can revisit this guide from “How to use the app”.',
    steps: {
      welcome: {
        title: 'One step at a time',
        body: 'You don’t need to set up your whole family today. We’ll cover the basics so you know where to go.',
        tip: 'First, your profile. Then, your family and its connections.',
      },
      profile: {
        title: 'Your place in the family',
        body: 'Your account lets you sign in. Your person profile represents you across all your families.',
        tip: 'If someone already created your profile, ask them for a code and choose “{{claimAction}}”. This avoids creating a duplicate.',
      },
      family: {
        title: 'Start with those closest to you',
        body: 'Create a family and add your relatives. They don’t need an account: you can create a managed profile with their name.',
        tip: 'If you already belong to a family, select it. You can switch families without losing your profile.',
      },
      tree: {
        title: 'Connect your tree',
        body: 'Parent/child links organize the generations. Partners have their own connection. Owners and admins can add these relationships.',
        tip: 'Tap a person to see their profile. Tap the family name to see its information. Swipe sideways to explore the tree.',
      },
    },
  },
  families: {
    backToTree: 'Back to tree',
    openDetails: 'View details for {{name}}',
    viewDetails: 'View family details ›',
    createdBy: 'Created by: {{name}}',
    unavailableCreator: 'Profile unavailable',
    createdOn: 'Created on: {{date}}',
    memberCount: 'People: {{count}}',
    personDetails: 'Person profile',

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
    membership: {
      removeTitle: 'Remove {{name}} from family',
      removeExplanation:
        'Remove {{name}} from {{family}}? They will no longer appear in this family’s tree or have membership access. Their profile, recipes, and memberships in other families are kept. This cannot be undone in the app yet.',
      removeConfirm: 'Confirm removal',
      transferTitle: 'Transfer ownership to {{name}}',
      transferExplanation:
        'Make {{name}} the owner of {{family}}? They will be able to manage admins and remove members. You will become an Admin. Only the new owner can transfer ownership back to you.',
      transferConfirm: 'Confirm ownership transfer',
    },
    roleManagement: {
      title: 'Role for {{name}}',
      edit: 'Change role for {{name}}',
      explanation:
        'Family roles control access within this family. They do not change profile managers or recipe ownership. Only an owner can grant or revoke Admin.',
      current: 'Current role: {{role}}',
      save: 'Save role',
      stale:
        'This membership changed while you were editing. Refresh and choose the role again.',
      descriptions: {
        MEMBER:
          'Members can contribute their own recipes and view content shared with them.',
        READ_ONLY:
          'Read-only members can view shared content but cannot create recipes or suggestions.',
        ADMIN:
          'Admins can manage ordinary members and family relationships. They cannot change other Admins or Owners.',
      },
    },
    tree: {
      hint: 'Tap a person to view their profile. Swipe sideways to explore.',
      parentLegend: '━ Parent → child',
      partnerLegend: '┄ Partner',
      openPerson: 'View profile for {{name}}',

      title: 'Family tree',
      explanation:
        'Organize this family’s relationships. The tree shows each generation and keeps partner connections.',
      empty:
        'There are no relationships yet. People appear together until you add the first connection.',
      generation: 'Generation {{number}}',
      parents: 'Parents: {{names}}',
      partners: 'Partner: {{names}}',
      add: 'Add relationship',
      save: 'Save relationship',
      remove: 'Remove connection',
      relationships: 'Recorded connections',
      formExplanation:
        'Choose a connection and two different people. For parent and child, the order matters.',
      parent: 'Parent',
      child: 'Child',
      firstPartner: 'First person',
      secondPartner: 'Second person',
      parentLink: '{{from}} is a parent of {{to}}',
      partnerLink: '{{from}} and {{to}} are partners',
      kinds: {
        PARENT_CHILD: 'Parent and child',
        PARTNER: 'Partners',
      },
      errors: {
        load: 'We could not load the family tree. The other family features are still available.',
        people: 'Select two different people.',
        duplicate: 'This relationship already exists.',
        cycle: 'This connection would create a cycle in the family tree.',
      },
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

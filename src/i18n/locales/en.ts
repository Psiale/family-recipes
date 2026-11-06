import type { TranslationResources } from './es';

export const en = {
  capture: {
    title: 'Capture from photo, audio or video',
    privacy:
      'Files are processed on this phone and are not uploaded to AI services. Only the recipe text you review and confirm will be saved.',
    limits:
      'One image of text or a clip up to 2 minutes and 30 MB. Video uses narration and up to 8 sampled frames: text between frames may be missed, and ingredients are not inferred from appearance. Review the transcript; handwriting may be misread.',
    models:
      'Choosing a file or organizing text authorizes the initial download of the required models (may exceed 1 GB). You need free storage and a compatible phone; Wi-Fi is recommended. Once downloaded, extraction works offline. Expo Go is not supported.',
    web: 'Local capture requires the installed app on a compatible phone. You can continue with manual entry.',
    languageEs: 'Audio: Spanish (switch to English)',
    languageEn: 'Audio: English (switch to Spanish)',
    choose: 'Choose file and prepare local reading',
    download: 'Preparing models on this phone…',
    read: 'Reading file on this phone…',
    organize: 'Organizing recipe on this phone…',
    stop: 'Stop processing',
    source: 'Extracted text (you can correct it)',
    reviewSource:
      'Compare the text with the original. Correct names, quantities and missing steps before organizing it. This text is discarded when you leave capture.',
    structure: 'Organize draft locally',
    reviewDraft:
      'Review every field in the next form before saving. Times and year are left blank for you to fill from the original. No recipe has been saved.',
    untitled: 'Title needed',
    use: 'Review draft in recipe form',
    manual: 'Write recipe manually',
    errors: {
      busy: 'The previous reading is finishing. Wait a moment and retry.',
      unsupported:
        'Unsupported format. Try a JPEG/PNG photo or a compatible MP4/audio clip.',
      size: 'Choose a nonempty file up to 30 MB.',
      duration:
        'The clip must have a readable duration greater than zero and up to 2 minutes.',
      empty:
        'No text was recognized. Try a clearer image or audio with clear speech.',
      output:
        'A reliable draft could not be produced. Your text is still here: correct it and retry, or enter the recipe manually.',
      cancelled: 'Processing stopped. You can retry.',
      sourceLength:
        'The limit is 6000 characters. Shorten the text while retaining all ingredients and steps for this recipe.',
      failed:
        'Local processing failed. Check free storage and your connection for the initial download, or use manual entry. Files were not sent to an AI service.',
    },
  },
  recipes: {
    moveUp: 'Move up: {{item}}',
    moveDown: 'Move down: {{item}}',
    create: 'Create recipe',
    edit: 'Edit recipe',
    save: 'Save recipe',
    search: 'Search recipes by title',
    empty: 'No visible recipes yet. Create a recipe or change your search.',
    back: 'Back to recipes',
    familyContext: 'Family context',
    privateExplanation:
      'A new recipe is private: only you, your managers and Super Admins can see it. Enable sharing to let the entire selected family see it. Editing content does not change existing visibility.',
    shareFamily: 'Share with the entire selected family',
    ingredients: 'Ingredients',
    steps: 'Preparation',
    ingredientNumber: 'Ingredient {{number}}',
    stepNumber: 'Step {{number}}',
    addIngredient: 'Add ingredient',
    removeIngredient: 'Remove ingredient {{number}}',
    addStep: 'Add step',
    removeStep: 'Remove step {{number}}',
    owner: 'Owned by: {{name}}',
    creator: 'Originally created by: {{name}}',
    anonymous: 'Deleted person',
    preserved: 'Preserved recipe',
    editable: 'Editable recipe',
    history: 'History: latest 20 versions',
    version: 'Version {{number}} · {{date}}',
    historical: 'Historical version {{number}} (read only)',
    current: 'View current recipe',
    preservedOverride:
      'This recipe is preserved. Only a Super Admin can change it with an explicit reason recorded in the audit history.',
    invalid:
      'Check the title, at least one ingredient and one step. Use nonnegative whole numbers for times and year.',
    stale:
      'This recipe changed. Cancel and reopen it to review the current version before saving.',
    denied: 'You no longer have permission to edit this recipe.',
    onboard:
      'Create or claim your profile in My families before writing recipes.',
    joinFamily:
      'You need a family with Member, Admin or Owner access to create recipes.',
    fields: {
      title: 'Title',
      description: 'Description',
      origin_location: 'Place of origin',
      origin_year: 'Year of origin',
      story: 'Recipe story',
      servings: 'Servings',
      prep_time_minutes: 'Preparation (minutes)',
      cook_time_minutes: 'Cooking (minutes)',
      rest_time_minutes: 'Rest (minutes)',
      change_summary: 'Change summary',
      ingredient: 'Ingredient {{number}}: name',
      quantity: 'Ingredient {{number}}: quantity',
      unit: 'Ingredient {{number}}: unit',
      preparation_note: 'Ingredient {{number}}: note',
    },
  },
  profileDeletion: {
    title: 'Delete profile globally',
    explanation:
      'This action is permanent. It anonymizes the profile and removes it from every family and branch. It revokes management grants held by the account and grants over this profile, and invalidates claim codes. The login account and credentials remain; it can create a new profile. Recipes, their ownership and historical references remain under the anonymous identity. Previous audit records are retained.',
    impact:
      'Impact: {{families}} families, {{grants}} manager grants; {{recipes}} owned recipes are retained.',
    lastOwner: 'last active Owner',
    blocked:
      'First transfer ownership in each family where this is the last Owner, or delete that family separately. A profile with Super Admin access must have its platform access resolved separately first.',
    typeName: 'Type the person’s exact name',
    confirm: 'Delete profile from all families',
  },
  personAdministration: {
    deleteProfile: 'Delete profile for {{name}} globally',
    rename: 'Change name for {{name}}',
    remove: 'Remove {{name}} from this family',
    renameExplanation:
      'This change applies everywhere this person appears, across all their families. It preserves their identity, login, memberships and ownership.',
    removeExplanation:
      'Removing {{name}} from family {{family}} ends only this membership and clears their branch assignments in this family. It preserves their global profile, linked account, other families, recipes and manager grants.',
    lastOwner:
      'The last active Owner cannot be removed. They must transfer ownership from their family first, or a Super Admin can use family deletion.',
    currentName: 'Current name: {{name}}',
    proposedName: 'Proposed name: {{name}}',
    newName: 'New name',
    reason: 'Required reason',
    reviewReason: 'Reason: {{reason}}',
    reasonHint:
      'Describe the reason (up to 2000 characters). You may act on a request or on your own initiative; a ticket is optional.',
    review: 'Review change',
    confirm: 'Confirm person change',
    done: 'Person change saved and audited.',
    stale:
      'The person or membership changed. Cancel and reopen the action to review the current details.',
  },
  administration: {
    denied: 'Only Super Admins can access this screen.',
    requestedBy: 'Requested by {{name}}',
    expires: 'Expiration date: {{date}}',
    title: 'Family administration',
    name: 'Find a family by name',
    search: 'Search',
    empty: 'No matching families.',
    previous: 'Previous',
    next: 'Next',
    noRequest: 'No pending deletion request.',
    back: 'Back to results',
  },
  familyLifecycle: {
    options: 'Options',
    gestureHint: 'Swipe either way or hold a family to see its options.',
    done: 'Action completed.',
    pending: 'Deletion request: {{family}}',
    review: 'Review request',
    leave: 'Leave family',
    ownerLeave:
      'Before leaving, transfer ownership to another linked account in family information. If there is no other account, you can request deletion with super admin approval.',
    request: 'Request deletion',
    approve: 'Approve and delete family',
    cancelRequest: 'Cancel request',
    delete: 'Delete as super admin',
    waiting:
      'Awaiting approval from another linked family member or the super admin. Approval deletes the family. Requests expire after 7 days.',
    expired: 'This request expired. The owner can renew it.',
    leaveExplanation:
      'You will leave {{family}} and lose member access. Your profile, recipes and other families will remain. Global delegations are unchanged.',
    requestExplanation:
      'You will request deletion of {{family}} for everyone. Another linked member or the super admin must approve it. This family’s memberships, branches, relationships and collections will be removed. Profiles and recipes will remain.',
    cancelExplanation: 'You will cancel the deletion request for {{family}}.',
    approveExplanation:
      'You will approve the owner’s request and immediately delete {{family}} for everyone. Its memberships, branches, relationships, invitations, collections and shared recipe access will be removed. Profiles and recipes will remain. This cannot be undone.',
    deleteExplanation:
      'You will delete {{family}} for everyone using super admin permission, without another approval. Its memberships, branches, relationships, invitations, collections and shared recipe access will be removed. Profiles and recipes will remain. This cannot be undone.',
    second: 'Second confirmation: deletion is permanent.',
    typeName: 'Type the exact family name',
    confirm: 'Confirm',
    continue: 'Continue to second confirmation',
  },
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
  delegation: {
    title: 'Profile delegates',
    explanation:
      'Only you can authorize delegates for your linked profile. Access applies across all your families and includes your private recipes. Delegates cannot appoint others or transfer ownership. Removing a family membership does not revoke this access.',
    needProfile:
      'Create or claim your person profile before managing delegates.',
    current: 'People authorized by you',
    empty: 'You have not authorized any delegates.',
    unavailable: 'Unavailable account',
    choose: 'Choose a relative with an account',
    noFamily:
      'Join or create a family to choose a delegate. You can still revoke existing delegates above.',
    noCandidates:
      'No other linked family members are available. Managed profiles cannot be delegates.',
    grantTitle: 'Authorize {{name}}',
    revokeTitle: 'Revoke access for {{name}}',
    grantWarning:
      'This person will be able to access your profile and all your recipes, including private recipes across families. They may manage editable recipes and their visibility when those features are available. Preserved recipes and ownership remain protected. This authorization lasts until you revoke it here, even if either of you leaves the family.',
    revokeWarning:
      'This removes their delegated access across all families. They may still see recipes shared with their own family or branch. Your profile, recipes, and ownership are preserved.',
    confirmGrant: 'Confirm global access',
    confirmRevoke: 'Confirm revocation',
    stale:
      'This authorization changed. Cancel and review the updated delegate list before trying again.',
  },
  navigation: {
    open: 'Open menu',
    tree: 'Family tree',
    recipes: 'Recipes',
    close: 'Close menu',
    recipesSoon:
      'Your family recipes will live here. Creating and browsing recipes is coming soon.',
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
    revisit:
      'Open the menu and choose “How to use the app” to revisit this guide.',
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
    branches: {
      title: 'Family branches',
      name: 'Branch name',
      explanation:
        'Group relatives into branches, such as a household or side of the family. A person can belong to several branches. This does not change the family tree.',
      create: 'Create branch',
      empty: 'No branches yet.',
      emptyMembers: 'This branch has no members yet.',
      add: 'Add {{name}} to branch',
      remove: 'Remove {{name}} from branch',
      member: 'In this branch',
      other: 'Other family members',
      back: 'Back to family tree',
      backList: 'Back to branches',
      duplicate: 'A branch with this name already exists in this family.',
      stale:
        'This membership changed. Refresh the branches and review the current members before trying again.',
      removeExplanation:
        'Removing someone here only removes their branch assignment. Their family membership and profile stay intact.',
    },
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
    yourFamilies: 'My families',
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
      stale:
        'This membership changed. Cancel and reopen this action from the person’s profile to review the latest information before confirming.',
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

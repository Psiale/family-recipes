export const es = {
  app: {
    name: 'Recetario Familiar',
    loading: 'Cargando…',
  },
  auth: {
    email: 'Correo electrónico',
    password: 'Contraseña',
    signIn: 'Iniciar sesión',
    signingIn: 'Iniciando sesión…',
    signInTitle: 'Tu recetario familiar',
    signInSubtitle:
      'Conserva las recetas y las historias que unen a tu familia.',
    signOut: 'Cerrar sesión',
    genericError:
      'No pudimos iniciar sesión. Revisa tus datos e inténtalo de nuevo.',
    createAccount: 'Crear cuenta',
    creatingAccount: 'Creando cuenta…',
    signUpTitle: 'Crea tu cuenta',
    signUpSubtitle:
      'Empieza a conservar las recetas y las historias de tu familia.',
    bootstrapHint:
      'Si esta es la primera cuenta, usa el correo de Super Admin configurado en el servidor.',
    haveAccount: '¿Ya tienes una cuenta? Inicia sesión',
    needAccount: '¿Aún no tienes una cuenta? Créala',
    confirmPassword: 'Confirmar contraseña',
    confirmationRequiredTitle: 'Confirma tu correo',
    confirmationRequiredBody:
      'Revisa tu bandeja de entrada y confirma tu correo antes de iniciar sesión.',
    existingAccount:
      'Ya existe una cuenta con este correo. Inicia sesión o restablece tu contraseña.',
    signUpGenericError: 'No pudimos crear tu cuenta. Inténtalo de nuevo.',
  },
  home: {
    title: 'Inicio',
    welcome: 'Bienvenido a tu recetario',
    signedInAs: 'Sesión iniciada como {{email}}',
    foundationReady:
      'La base de la aplicación está lista para crear tu primera familia.',
  },
  language: {
    label: 'Idioma',
    spanish: 'Español',
    english: 'English',
  },
  validation: {
    emailRequired: 'Ingresa tu correo electrónico.',
    emailInvalid: 'Ingresa un correo electrónico válido.',
    passwordRequired: 'Ingresa tu contraseña.',
    passwordMinimum: 'La contraseña debe tener al menos 8 caracteres.',
    passwordConfirmationRequired: 'Confirma tu contraseña.',
    passwordsMismatch: 'Las contraseñas no coinciden.',
  },
  errors: {
    configurationTitle: 'Configuración incompleta',
    configurationBody:
      'Faltan variables de entorno requeridas. Revisa el archivo .env.',
    configurationHint:
      'Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY con valores válidos.',
    profileLoad: 'No pudimos cargar tu perfil.',
  },
} as const;

type DeepStringShape<T> = {
  [Key in keyof T]: T[Key] extends string ? string : DeepStringShape<T[Key]>;
};

export type TranslationResources = DeepStringShape<typeof es>;

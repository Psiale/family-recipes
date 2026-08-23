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
    signInSubtitle: 'Conserva las recetas y las historias que unen a tu familia.',
    signOut: 'Cerrar sesión',
    genericError: 'No pudimos iniciar sesión. Revisa tus datos e inténtalo de nuevo.',
  },
  home: {
    title: 'Inicio',
    welcome: 'Bienvenido a tu recetario',
    signedInAs: 'Sesión iniciada como {{email}}',
    foundationReady: 'La base de la aplicación está lista para crear tu primera familia.',
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
  },
  errors: {
    configurationTitle: 'Configuración incompleta',
    configurationBody: 'Faltan variables de entorno requeridas. Revisa el archivo .env.',
    profileLoad: 'No pudimos cargar tu perfil.',
  },
} as const;

type DeepStringShape<T> = {
  [Key in keyof T]: T[Key] extends string ? string : DeepStringShape<T[Key]>;
};

export type TranslationResources = DeepStringShape<typeof es>;

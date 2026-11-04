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
  guide: {
    label: 'Bienvenido a tu familia',
    progress: 'Paso {{current}} de {{total}}',
    next: 'Siguiente',
    back: 'Atrás',
    skip: 'Omitir por ahora',
    start: 'Empezar',
    tip: 'Para tener en cuenta',
    help: 'Cómo usar la app',
    revisit: 'Puedes volver a esta guía desde «Cómo usar la app».',
    steps: {
      welcome: {
        title: 'Vamos paso a paso',
        body: 'No necesitas configurar toda tu familia hoy. Empezaremos con lo básico para que sepas dónde ir.',
        tip: 'Primero, tu perfil. Después, tu familia y sus vínculos.',
      },
      profile: {
        title: 'Tu lugar en la familia',
        body: 'Tu cuenta te permite iniciar sesión. Tu perfil de persona te representa dentro de todas tus familias.',
        tip: 'Si alguien ya creó tu perfil, pídele un código y elige «{{claimAction}}». Así evitas crear uno duplicado.',
      },
      family: {
        title: 'Empieza con los más cercanos',
        body: 'Crea una familia y agrega a tus familiares. No necesitan una cuenta: puedes crearles un perfil gestionado con su nombre.',
        tip: 'Si ya perteneces a una familia, selecciónala. Puedes cambiar de familia sin perder tu perfil.',
      },
      tree: {
        title: 'Conecta tu árbol',
        body: 'Los vínculos de padre/madre e hijo/a ordenan las generaciones. Las parejas tienen su propio vínculo. Los propietarios y administradores pueden agregarlos.',
        tip: 'Toca una persona para ver su perfil. Toca el nombre de la familia para ver su información. Desliza hacia los lados para explorar el árbol.',
      },
    },
  },
  families: {
    onboardingTitle: 'Tu perfil de persona',
    onboardingExplanation:
      'Tu cuenta sirve para iniciar sesión. Tu perfil identifica a la persona a quien pertenecen sus recetas. Si alguien ya creó tu perfil, usa su código en lugar de crear otro.',
    createProfile: 'Crear mi perfil',
    personName: 'Nombre de la persona',
    biography: 'Historia o biografía (opcional)',
    familyName: 'Nombre de la familia',
    description: 'Descripción (opcional)',
    saving: 'Guardando…',
    cancel: 'Cancelar',
    done: 'Listo',
    retry: 'Reintentar',
    refresh: 'Actualizar familias',
    refreshPeople: 'Actualizar personas',
    welcome: 'Hola, {{name}}',
    identityExplanation:
      'Tu perfil es el mismo en todas tus familias. Cambiar de familia no cambia a quién pertenece una receta.',
    yourFamilies: 'Tus familias',
    noFamilies:
      'Aún no perteneces a una familia. Crea la primera para empezar.',
    createFamily: 'Crear familia',
    ownerExplanation:
      'Serás propietario de la nueva familia. La familia y tu membresía se crean juntas.',
    yourRole: 'Tu rol: {{role}}',
    people: 'Personas de la familia',
    addPerson: 'Agregar persona',
    managedExplanation:
      'Crea un perfil sin cuenta para alguien de esta familia. Se agregará como miembro y tú podrás gestionar su perfil. No estás creando una cuenta de acceso.',
    linked: 'Con cuenta vinculada',
    managed: 'Perfil gestionado',
    personSummary: '{{role}} · {{status}}',
    haveClaimCode: 'Ya tengo un código para vincular mi perfil',
    claimProfile: 'Vincular mi perfil',
    claimCode: 'Código de vinculación',
    claimExplanation:
      'Usa el código que te compartió la persona que gestiona tu perfil. Debes haber confirmado el correo al que se dirigió el código. Se conservarán tu perfil, tus membresías y tus recetas. Se revocarán los permisos de tus gestores anteriores.',
    claimFor: 'Vincular cuenta de {{name}}',
    issueClaim: 'Generar código',
    issueExplanation:
      'Ingresa el correo de esta persona. Solo una cuenta con ese correo verificado y sin otro perfil podrá usar el código. Vence en 7 días y reemplaza cualquier código anterior. Al vincularse, se revocarán los permisos de los gestores anteriores.',
    codeReady: 'Código listo para compartir',
    shareCode:
      'Comparte este código de forma privada con esa persona. No se ha enviado ningún correo. El código se muestra solo aquí y vence en 7 días.',
    roles: {
      OWNER: 'Propietario',
      ADMIN: 'Administrador',
      MEMBER: 'Miembro',
      READ_ONLY: 'Solo lectura',
    },
    roleManagement: {
      title: 'Rol de {{name}}',
      edit: 'Cambiar rol de {{name}}',
      explanation:
        'Los roles controlan el acceso dentro de esta familia. No cambian los administradores de perfiles ni la propiedad de recetas. Solo un propietario puede otorgar o retirar el rol de Administrador.',
      current: 'Rol actual: {{role}}',
      save: 'Guardar rol',
      stale:
        'La membresía cambió mientras la editabas. Actualiza y elige el rol de nuevo.',
      descriptions: {
        MEMBER:
          'Los miembros pueden aportar sus propias recetas y ver el contenido compartido con ellos.',
        READ_ONLY:
          'Los miembros de solo lectura pueden ver contenido compartido, pero no crear recetas ni sugerencias.',
        ADMIN:
          'Los administradores pueden gestionar miembros comunes y relaciones familiares. No pueden cambiar otros administradores ni propietarios.',
      },
    },
    tree: {
      title: 'Árbol familiar',
      explanation:
        'Organiza los parentescos de esta familia. El árbol muestra cada generación y conserva los vínculos de pareja.',
      empty:
        'Aún no hay parentescos. Las personas aparecen juntas hasta que agregues el primer vínculo.',
      generation: 'Generación {{number}}',
      parents: 'Padres: {{names}}',
      partners: 'Pareja: {{names}}',
      add: 'Agregar parentesco',
      save: 'Guardar parentesco',
      remove: 'Eliminar vínculo',
      relationships: 'Vínculos registrados',
      formExplanation:
        'Elige un vínculo y dos personas distintas. En padre/madre e hijo/a, el orden sí importa.',
      parent: 'Padre o madre',
      child: 'Hijo o hija',
      firstPartner: 'Primera persona',
      secondPartner: 'Segunda persona',
      parentLink: '{{from}} es padre o madre de {{to}}',
      partnerLink: '{{from}} y {{to}} son pareja',
      kinds: {
        PARENT_CHILD: 'Padre/madre e hijo/a',
        PARTNER: 'Pareja',
      },
      errors: {
        load: 'No pudimos cargar el árbol familiar. Las demás funciones de la familia siguen disponibles.',
        people: 'Selecciona dos personas distintas.',
        duplicate: 'Este parentesco ya existe.',
        cycle: 'Este vínculo crearía un ciclo en el árbol familiar.',
      },
    },
    validation: {
      nameRequired: 'Ingresa un nombre.',
      nameLong: 'Usa un nombre de hasta 120 caracteres.',
      descriptionLong: 'Usa una descripción de hasta 2000 caracteres.',
      claimCode: 'Ingresa el código completo de 64 caracteres.',
    },
    errors: {
      load: 'No pudimos cargar esta información. Revisa tu conexión e inténtalo de nuevo.',
      save: 'No pudimos guardar los cambios. Revisa tu conexión e inténtalo de nuevo.',
      alreadyLinked:
        'Tu cuenta ya tiene un perfil. Actualiza la pantalla para continuar.',
      permission:
        'No tienes permiso para esta acción. Para vincular un perfil, confirma primero el correo correcto.',
      invalid:
        'Los datos o el código no son válidos. El código puede haber vencido o corresponder a otro correo.',
      onboarding: 'Primero crea o vincula tu perfil de persona.',
    },
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

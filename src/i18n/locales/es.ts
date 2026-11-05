export const es = {
  personAdministration: {
    rename: 'Cambiar el nombre de {{name}}',
    remove: 'Quitar a {{name}} de esta familia',
    renameExplanation:
      'Este cambio se aplica en todas partes donde aparece esta persona, en todas sus familias. Conserva su identidad, acceso, membresías y propiedad.',
    removeExplanation:
      'Quitar a {{name}} de la familia {{family}} termina solo esta membresía y elimina sus asignaciones a ramas de esta familia. Conserva el perfil global, la cuenta vinculada, otras familias, recetas y permisos de gestión.',
    lastOwner:
      'No se puede quitar al último propietario activo. Primero debe transferir la propiedad desde su familia, o un súper administrador puede usar la eliminación de la familia.',
    currentName: 'Nombre actual: {{name}}',
    proposedName: 'Nombre propuesto: {{name}}',
    newName: 'Nuevo nombre',
    reason: 'Motivo obligatorio',
    reviewReason: 'Motivo: {{reason}}',
    reasonHint:
      'Describe el motivo (máximo 2000 caracteres). Puedes actuar por solicitud o por iniciativa propia; no se requiere un ticket.',
    review: 'Revisar cambio',
    confirm: 'Confirmar cambio de persona',
    done: 'Cambio de persona guardado y auditado.',
    stale:
      'La persona o membresía cambió. Cancela y vuelve a abrir la acción para revisar los datos actuales.',
  },
  administration: {
    denied: 'Solo los súper administradores pueden acceder a esta pantalla.',
    requestedBy: 'Solicitud de {{name}}',
    expires: 'Fecha de vencimiento: {{date}}',
    title: 'Administración de familias',
    name: 'Buscar una familia por nombre',
    search: 'Buscar',
    empty: 'No se encontraron familias.',
    previous: 'Anterior',
    next: 'Siguiente',
    noRequest: 'No hay solicitud de eliminación pendiente.',
    back: 'Volver a los resultados',
  },
  familyLifecycle: {
    options: 'Opciones',
    gestureHint:
      'Desliza hacia cualquier lado o mantén presionada una familia para ver sus opciones.',
    done: 'Acción completada.',
    pending: 'Solicitud para eliminar: {{family}}',
    review: 'Revisar solicitud',
    leave: 'Salir de la familia',
    ownerLeave:
      'Antes de salir, transfiere la propiedad a otra cuenta vinculada desde la información de la familia. Si no hay otra cuenta, puedes solicitar el borrado con aprobación del súper admin.',
    request: 'Solicitar eliminación',
    approve: 'Autorizar y eliminar familia',
    cancelRequest: 'Cancelar solicitud',
    delete: 'Eliminar como súper admin',
    waiting:
      'Pendiente de aprobación de otro miembro con cuenta vinculada o del súper admin. La aprobación eliminará la familia. La solicitud caduca a los 7 días.',
    expired: 'La solicitud caducó. El propietario puede renovarla.',
    leaveExplanation:
      'Saldrás de {{family}} y perderás el acceso de miembro. Tu perfil, tus recetas y tus otras familias se conservarán. Las delegaciones globales no cambian.',
    requestExplanation:
      'Solicitarás eliminar {{family}} para todos. Otro miembro con cuenta vinculada o el súper admin deberá autorizarlo. Se eliminarán las membresías, ramas, relaciones y colecciones de esta familia. Los perfiles y las recetas se conservarán.',
    cancelExplanation: 'Cancelarás la solicitud de eliminación de {{family}}.',
    approveExplanation:
      'Autorizarás la solicitud del propietario y eliminarás {{family}} para todos inmediatamente. Se eliminarán sus membresías, ramas, relaciones, invitaciones, colecciones y accesos compartidos a recetas. Los perfiles y las recetas se conservarán. No se puede deshacer.',
    deleteExplanation:
      'Eliminarás {{family}} para todos usando tu permiso de súper admin, sin otra aprobación. Se eliminarán sus membresías, ramas, relaciones, invitaciones, colecciones y accesos compartidos a recetas. Los perfiles y las recetas se conservarán. No se puede deshacer.',
    second: 'Segunda confirmación: este borrado es definitivo.',
    typeName: 'Escribe el nombre exacto de la familia',
    confirm: 'Confirmar',
    continue: 'Continuar a la segunda confirmación',
  },

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
    recovery: {
      forgot: '¿Olvidaste tu contraseña?',
      title: 'Restablece tu contraseña',
      instructions:
        'Ingresa el correo de tu cuenta. Solicita el enlace aquí y ábrelo en este mismo dispositivo. Usa solo el correo más reciente.',
      send: 'Enviar correo de recuperación',
      sent: 'Si existe una cuenta con este correo, recibirás un enlace de recuperación. Revisa tu bandeja de entrada y spam. Abre el enlace más reciente en este dispositivo.',
      sendError:
        'No pudimos solicitar el correo. Revisa tu conexión o espera unos minutos antes de intentarlo de nuevo.',
      newTitle: 'Elige una nueva contraseña',
      newPassword: 'Nueva contraseña',
      newInstructions:
        'Usa al menos 8 caracteres y confirma tu nueva contraseña.',
      save: 'Guardar nueva contraseña',
      updateError:
        'No pudimos actualizar tu contraseña. Revisa tu conexión. Si el enlace venció, cancela y solicita un nuevo correo.',
      samePassword: 'Elige una contraseña distinta de la actual.',
      weakPassword:
        'La contraseña no cumple los requisitos de seguridad. Elige una más segura.',
      invalidTitle: 'No se pudo verificar este enlace',
      invalid:
        'El enlace puede haber vencido, ya haberse usado o haberse solicitado en otro dispositivo. Solicita un nuevo correo desde este dispositivo.',
      sendAnother: 'Solicitar un nuevo correo',
      completeTitle: 'Contraseña actualizada',
      complete:
        'Tu nueva contraseña está guardada. Tu cuenta, perfil y datos familiares siguen intactos.',
      continue: 'Continuar a mis familias',
      cancel: 'Cancelar y volver',
      cancelError:
        'No pudimos cerrar la recuperación. Revisa tu conexión e inténtalo de nuevo.',
    },
  },
  delegation: {
    title: 'Delegados de mi perfil',
    explanation:
      'Solo tú puedes autorizar delegados de tu perfil vinculado. El acceso abarca todas tus familias e incluye tus recetas privadas. Los delegados no pueden autorizar a otros ni transferir la propiedad. Eliminar una membresía familiar no revoca este acceso.',
    needProfile:
      'Crea o vincula tu perfil de persona antes de administrar delegados.',
    current: 'Personas autorizadas por ti',
    empty: 'Todavía no has autorizado delegados.',
    unavailable: 'Cuenta no disponible',
    choose: 'Elige un familiar con cuenta',
    noFamily:
      'Únete o crea una familia para elegir un delegado. Aún puedes revocar los delegados existentes arriba.',
    noCandidates:
      'No hay otros familiares con cuenta disponibles. Los perfiles administrados no pueden ser delegados.',
    grantTitle: 'Autorizar a {{name}}',
    revokeTitle: 'Revocar acceso de {{name}}',
    grantWarning:
      'Esta persona podrá acceder a tu perfil y a todas tus recetas, incluidas las privadas de distintas familias. Podrá administrar recetas editables y su visibilidad cuando esas funciones estén disponibles. Las recetas preservadas y la propiedad siguen protegidas. La autorización dura hasta que la revoques aquí, incluso si alguno deja la familia.',
    revokeWarning:
      'Esto elimina su acceso delegado en todas las familias. Aún podrá ver recetas compartidas con su propia familia o rama. Tu perfil, recetas y propiedad se conservan.',
    confirmGrant: 'Confirmar acceso global',
    confirmRevoke: 'Confirmar revocación',
    stale:
      'Esta autorización cambió. Cancela y revisa la lista actualizada de delegados antes de intentar de nuevo.',
  },
  navigation: {
    open: 'Abrir menú',
    tree: 'Árbol familiar',
    recipes: 'Recetas',
    close: 'Cerrar menú',
    recipesSoon:
      'Aquí estarán las recetas de tu familia. Pronto podrás crear y consultar recetas.',
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
    revisit: 'Abre el menú y elige «Cómo usar la app» para volver a esta guía.',
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
    branches: {
      title: 'Ramas familiares',
      name: 'Nombre de la rama',
      explanation:
        'Agrupa a tus familiares por hogar o lado de la familia. Una persona puede pertenecer a varias ramas. Esto no cambia el árbol familiar.',
      create: 'Crear rama',
      empty: 'Todavía no hay ramas.',
      emptyMembers: 'Esta rama todavía no tiene miembros.',
      add: 'Agregar a {{name}} a la rama',
      remove: 'Quitar a {{name}} de la rama',
      member: 'En esta rama',
      other: 'Otros familiares',
      back: 'Volver al árbol familiar',
      backList: 'Volver a las ramas',
      duplicate: 'Ya existe una rama con este nombre en esta familia.',
      stale:
        'Esta membresía cambió. Actualiza las ramas y revisa los miembros actuales antes de intentar de nuevo.',
      removeExplanation:
        'Quitar a alguien aquí solo elimina su asignación a esta rama. Su membresía familiar y perfil se conservan.',
    },
    backToTree: 'Volver al árbol',
    openDetails: 'Ver detalles de {{name}}',
    viewDetails: 'Ver información de la familia ›',
    createdBy: 'Creada por: {{name}}',
    unavailableCreator: 'Perfil no disponible',
    createdOn: 'Fecha de creación: {{date}}',
    memberCount: 'Personas: {{count}}',
    personDetails: 'Perfil de la persona',

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
    yourFamilies: 'Mis familias',
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
    membership: {
      stale:
        'Esta membresía cambió. Cancela y vuelve a abrir esta acción desde el perfil de la persona para revisar la información actual antes de confirmar.',
      removeTitle: 'Quitar a {{name}} de la familia',
      removeExplanation:
        '¿Quitar a {{name}} de {{family}}? Ya no aparecerá en el árbol de esta familia ni tendrá acceso como miembro. Se conservarán su perfil, sus recetas y sus membresías en otras familias. Todavía no se puede deshacer desde la app.',
      removeConfirm: 'Confirmar eliminación de membresía',
      transferTitle: 'Transferir propiedad a {{name}}',
      transferExplanation:
        '¿Hacer a {{name}} propietario de {{family}}? Podrá gestionar administradores y quitar miembros. Tú pasarás a ser Administrador. Solo el nuevo propietario podrá devolverte la propiedad.',
      transferConfirm: 'Confirmar transferencia',
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
      hint: 'Toca una persona para ver su perfil. Desliza hacia los lados para explorar.',
      parentLegend: '━ Padre/madre → hijo/a',
      partnerLegend: '┄ Pareja',
      openPerson: 'Ver perfil de {{name}}',

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

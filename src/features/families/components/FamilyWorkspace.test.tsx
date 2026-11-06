import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import i18n from '@/i18n';

import * as api from '../api';
import { familyKeys } from '../queries';
import { familyStorageKey } from '../useFamilySelection';

import { FamilyWorkspace } from './FamilyWorkspace';

jest.mock('../api');
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.useFakeTimers();
const mockApi = jest.mocked(api);
const person: api.Person = {
  id: 'person-1',
  user_id: 'user-1',
  display_name: 'Alex',
  biography: null,
  created_by_user_id: 'user-1',
  profile_photo_path: null,
  created_at: '',
  updated_at: '',
};
const family: api.Family = {
  created_at: '2026-11-03T12:00:00Z',
  created_by_user_id: 'user-1',
  id: 'family-1',
  name: 'Familia Uno',
  description: null,
  role: 'OWNER',
};
const second: api.Family = {
  created_at: '2026-11-03T12:00:00Z',
  created_by_user_id: 'user-2',
  id: 'family-2',
  name: 'Familia Dos',
  description: null,
  role: 'MEMBER',
};
const managed: api.Person = {
  ...person,
  id: 'person-2',
  user_id: null,
  display_name: 'Abuela',
};

async function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  await render(
    <QueryClientProvider client={client}>
      <FamilyWorkspace userId="user-1" />
    </QueryClientProvider>,
  );
  return { client, user: userEvent.setup() };
}

beforeEach(async () => {
  jest.clearAllMocks();
  Object.values(mockApi).forEach((mock) => {
    if (jest.isMockFunction(mock)) mock.mockReset();
  });
  await AsyncStorage.clear();
  await i18n.changeLanguage('es');
  mockApi.getCurrentPerson.mockResolvedValue(null);
  mockApi.listFamilies.mockResolvedValue([]);
  mockApi.getFamilyLifecycle.mockResolvedValue({
    superAdmin: false,
    requests: [],
  });
  mockApi.listFamilyPeople.mockResolvedValue([]);
  mockApi.listFamilyRelationships.mockResolvedValue([]);
});

it('integrates onboarding, atomic family creation, managed creation and claim issuance through real query hooks', async () => {
  mockApi.onboardPerson.mockImplementation(async () => {
    mockApi.getCurrentPerson.mockResolvedValue(person);
    return person.id;
  });
  mockApi.createFamily.mockImplementation(async () => {
    mockApi.listFamilies.mockResolvedValue([family]);
    return family.id;
  });
  mockApi.createManagedPerson.mockImplementation(async () => {
    mockApi.listFamilyPeople.mockResolvedValue([
      {
        person: managed,
        role: 'MEMBER',
        membershipUpdatedAt: '2026-11-05T00:00:00Z',
        canIssueClaim: true,
      },
    ]);
    return managed.id;
  });
  mockApi.issueClaim.mockResolvedValue('a'.repeat(64));
  const { user, client } = await setup();
  await screen.findByRole('heading', { name: 'Tu perfil de persona' });
  await user.type(screen.getByLabelText('Nombre de la persona'), '  Alex  ');
  await user.press(screen.getByRole('button', { name: 'Crear mi perfil' }));
  await screen.findByText(
    'Aún no perteneces a una familia. Crea la primera para empezar.',
  );
  expect(mockApi.onboardPerson).toHaveBeenCalledWith(
    { name: 'Alex', description: '' },
    expect.anything(),
  );
  await user.press(screen.getByRole('button', { name: 'Crear familia' }));
  await user.type(screen.getByLabelText('Nombre de la familia'), 'Familia Uno');
  await user.press(screen.getByRole('button', { name: 'Crear familia' }));
  await screen.findByText('Tu rol: Propietario');
  expect(client.getQueryData(familyKeys.families('user-1', person.id))).toEqual(
    [family],
  );
  await user.press(screen.getByRole('button', { name: 'Agregar persona' }));
  await user.type(screen.getByLabelText('Nombre de la persona'), 'Abuela');
  await user.press(screen.getByRole('button', { name: 'Agregar persona' }));
  expect(await screen.findAllByText('Abuela')).toHaveLength(1);
  expect(mockApi.createManagedPerson).toHaveBeenCalledWith(
    { name: 'Abuela', description: '', familyId: family.id },
    expect.anything(),
  );
  await user.press(
    screen.getByRole('button', { name: 'Ver perfil de Abuela' }),
  );
  await user.press(
    screen.getByRole('button', { name: 'Vincular cuenta de Abuela' }),
  );
  await user.type(
    screen.getByLabelText('Correo electrónico'),
    'abuela@example.com',
  );
  await user.press(screen.getByRole('button', { name: 'Generar código' }));
  expect(await screen.findByText('a'.repeat(64))).toBeOnTheScreen();
  expect(await AsyncStorage.getItem(familyStorageKey('user-1'))).toBe(
    family.id,
  );
  expect(await AsyncStorage.getAllKeys()).toEqual([familyStorageKey('user-1')]);
});

it('claims an existing Person and refreshes inherited memberships without creating a duplicate', async () => {
  mockApi.claimPerson.mockImplementation(async () => {
    mockApi.getCurrentPerson.mockResolvedValue({
      ...managed,
      user_id: 'user-1',
    });
    mockApi.listFamilies.mockResolvedValue([{ ...family, role: 'MEMBER' }]);
    return managed.id;
  });
  const { user } = await setup();
  await user.press(
    await screen.findByRole('button', {
      name: 'Ya tengo un código para vincular mi perfil',
    }),
  );
  await user.type(
    screen.getByLabelText('Código de vinculación'),
    'b'.repeat(64),
  );
  await user.press(screen.getByRole('button', { name: 'Vincular mi perfil' }));
  expect(
    await screen.findByRole('button', { name: 'Mis familias' }),
  ).toBeOnTheScreen();
  expect(await screen.findByText('Tu rol: Miembro')).toBeOnTheScreen();
  expect(mockApi.onboardPerson).not.toHaveBeenCalled();
  expect(
    screen.queryByRole('button', { name: 'Agregar persona' }),
  ).not.toBeOnTheScreen();
});

it('validates Spanish name and claim fields before sending writes', async () => {
  const { user } = await setup();
  await user.press(
    await screen.findByRole('button', { name: 'Crear mi perfil' }),
  );
  expect(screen.getByText('Ingresa un nombre.')).toBeOnTheScreen();
  expect(mockApi.onboardPerson).not.toHaveBeenCalled();
  await user.press(
    screen.getByRole('button', {
      name: 'Ya tengo un código para vincular mi perfil',
    }),
  );
  await user.press(screen.getByRole('button', { name: 'Vincular mi perfil' }));
  expect(
    screen.getByText('Ingresa el código completo de 64 caracteres.'),
  ).toBeOnTheScreen();
  expect(mockApi.claimPerson).not.toHaveBeenCalled();
});

it('keeps form input after a denied claim and shows a localized error', async () => {
  mockApi.claimPerson.mockRejectedValue({
    code: '22023',
    message: 'raw private error',
  });
  const { user } = await setup();
  await user.press(
    await screen.findByRole('button', {
      name: 'Ya tengo un código para vincular mi perfil',
    }),
  );
  await user.type(
    screen.getByLabelText('Código de vinculación'),
    'c'.repeat(64),
  );
  await user.press(screen.getByRole('button', { name: 'Vincular mi perfil' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    /Los datos o el código no son válidos\./,
  );
  expect(screen.getByLabelText('Código de vinculación')).toHaveDisplayValue(
    'c'.repeat(64),
  );
  expect(screen.queryByText('raw private error')).not.toBeOnTheScreen();
});

it('switches families with isolated member queries and persists the selection', async () => {
  mockApi.getCurrentPerson.mockResolvedValue(person);
  mockApi.listFamilies.mockResolvedValue([family, second]);
  mockApi.listFamilyPeople.mockImplementation(async (_userId, familyId) => [
    {
      person: {
        ...managed,
        display_name:
          familyId === family.id ? 'Primera persona' : 'Segunda persona',
      },
      role: 'MEMBER',
      membershipUpdatedAt: '2026-11-05T00:00:00Z',
      canIssueClaim: false,
    },
  ]);
  const { user } = await setup();
  expect(await screen.findAllByText('Primera persona')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: second.name })).toBeNull();
  expect(screen.queryByText('Hola, Alex')).toBeNull();
  await user.press(screen.getByRole('button', { name: 'Mis familias' }));
  await user.press(screen.getByRole('button', { name: second.name }));
  expect(await screen.findAllByText('Segunda persona')).toHaveLength(1);
  expect(screen.queryByText('Primera persona')).not.toBeOnTheScreen();
  expect(await AsyncStorage.getItem(familyStorageKey('user-1'))).toBe(
    second.id,
  );
  expect(mockApi.listFamilyPeople).toHaveBeenCalledWith('user-1', second.id);
});

it('restores only the current account’s valid family preference', async () => {
  await AsyncStorage.setItem(familyStorageKey('other-user'), family.id);
  await AsyncStorage.setItem(familyStorageKey('user-1'), second.id);
  mockApi.getCurrentPerson.mockResolvedValue(person);
  mockApi.listFamilies.mockResolvedValue([family, second]);
  await setup();
  expect(await screen.findByText('Tu rol: Miembro')).toBeOnTheScreen();
  expect(mockApi.listFamilyPeople).toHaveBeenCalledWith('user-1', second.id);
  expect(mockApi.listFamilyPeople).not.toHaveBeenCalledWith(
    'user-1',
    family.id,
  );
});

it('falls back when saved family access has been removed', async () => {
  await AsyncStorage.setItem(familyStorageKey('user-1'), 'removed-family');
  mockApi.getCurrentPerson.mockResolvedValue(person);
  mockApi.listFamilies.mockResolvedValue([family]);
  await setup();
  expect(await screen.findByText('Tu rol: Propietario')).toBeOnTheScreen();
  expect(mockApi.listFamilyPeople).not.toHaveBeenCalledWith(
    'user-1',
    'removed-family',
  );
});

it('hides managed-person writes for read-only users and claim issuance without a grant', async () => {
  mockApi.getCurrentPerson.mockResolvedValue(person);
  mockApi.listFamilies.mockResolvedValue([{ ...family, role: 'READ_ONLY' }]);
  mockApi.listFamilyPeople.mockResolvedValue([
    {
      person: managed,
      role: 'MEMBER',
      membershipUpdatedAt: '2026-11-05T00:00:00Z',
      canIssueClaim: false,
    },
  ]);
  await setup();
  expect(await screen.findAllByText('Abuela')).toHaveLength(1);
  expect(
    screen.queryByRole('button', { name: 'Agregar persona' }),
  ).not.toBeOnTheScreen();
  expect(
    screen.queryByRole('button', { name: 'Vincular cuenta de Abuela' }),
  ).not.toBeOnTheScreen();
});

it('recovers from a failed initial query without showing the wrong onboarding state', async () => {
  mockApi.getCurrentPerson
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(person);
  const { user } = await setup();
  await screen.findByRole('alert');
  expect(
    screen.queryByRole('button', { name: 'Crear mi perfil' }),
  ).not.toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('Hola, Alex')).toBeOnTheScreen();
});

it('keeps family people available when only the tree query fails', async () => {
  mockApi.getCurrentPerson.mockResolvedValue(person);
  mockApi.listFamilies.mockResolvedValue([family]);
  mockApi.listFamilyPeople.mockResolvedValue([
    {
      person: managed,
      role: 'MEMBER',
      membershipUpdatedAt: '2026-11-05T00:00:00Z',
      canIssueClaim: false,
    },
  ]);
  mockApi.listFamilyRelationships.mockRejectedValue({ code: 'PGRST205' });

  await setup();

  expect(await screen.findByText('Árbol familiar')).toBeOnTheScreen();
  expect(screen.getAllByText('Abuela')).toHaveLength(1);
  expect(
    screen.getByText(
      'No pudimos cargar el árbol familiar. Las demás funciones de la familia siguen disponibles.',
    ),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: 'Agregar persona' }),
  ).toBeOnTheScreen();
});

it('renders English onboarding and validation', async () => {
  await i18n.changeLanguage('en');
  const { user } = await setup();
  await user.press(
    await screen.findByRole('button', { name: 'Create my profile' }),
  );
  expect(screen.getByText('Enter a name.')).toBeOnTheScreen();
  await screen.unmount();
  await i18n.changeLanguage('es');
});

it('lets an owner promote a family member and refreshes their displayed role', async () => {
  await i18n.changeLanguage('en');
  mockApi.getCurrentPerson.mockResolvedValue(person);
  mockApi.listFamilies.mockResolvedValue([family]);
  mockApi.listFamilyPeople.mockResolvedValue([
    {
      person,
      role: 'OWNER',
      membershipUpdatedAt: '2026-11-05T00:00:00Z',
      canIssueClaim: false,
    },
    {
      person: managed,
      role: 'MEMBER',
      membershipUpdatedAt: '2026-11-05T00:00:00Z',
      canIssueClaim: true,
    },
  ]);
  mockApi.changeFamilyRole.mockImplementation(async () => {
    mockApi.listFamilyPeople.mockResolvedValue([
      {
        person,
        role: 'OWNER',
        membershipUpdatedAt: '2026-11-05T00:00:00Z',
        canIssueClaim: false,
      },
      {
        person: managed,
        role: 'ADMIN',
        membershipUpdatedAt: '2026-11-05T00:00:00Z',
        canIssueClaim: true,
      },
    ]);
  });
  const { user } = await setup();
  await user.press(
    await screen.findByRole('button', { name: 'View profile for Abuela' }),
  );
  await user.press(
    await screen.findByRole('button', { name: 'Change role for Abuela' }),
  );
  expect(
    screen.queryByRole('button', { name: 'Change role for Alex' }),
  ).toBeNull();
  await user.press(screen.getByRole('button', { name: 'Admin' }));
  await user.press(screen.getByRole('button', { name: 'Save role' }));
  await user.press(
    await screen.findByRole('button', { name: 'View profile for Abuela' }),
  );
  await screen.findByText('Admin · Managed profile');
  expect(mockApi.changeFamilyRole).toHaveBeenCalledWith(
    {
      familyId: family.id,
      personId: managed.id,
      role: 'ADMIN',
      expectedRole: 'MEMBER',
    },
    expect.anything(),
  );
});

it('limits admin controls to ordinary members and rejects a stale edit visibly', async () => {
  await i18n.changeLanguage('en');
  mockApi.getCurrentPerson.mockResolvedValue(person);
  mockApi.listFamilies.mockResolvedValue([{ ...family, role: 'ADMIN' }]);
  mockApi.listFamilyPeople.mockResolvedValue([
    {
      person,
      role: 'ADMIN',
      membershipUpdatedAt: '2026-11-05T00:00:00Z',
      canIssueClaim: false,
    },
    {
      person: managed,
      role: 'MEMBER',
      membershipUpdatedAt: '2026-11-05T00:00:00Z',
      canIssueClaim: false,
    },
    {
      person: { ...person, id: 'owner', display_name: 'Owner' },
      role: 'OWNER',
      membershipUpdatedAt: '2026-11-05T00:00:00Z',
      canIssueClaim: false,
    },
  ]);
  mockApi.changeFamilyRole.mockRejectedValue({ code: 'PT409' });
  const { user } = await setup();
  await user.press(
    await screen.findByRole('button', { name: 'View profile for Abuela' }),
  );
  await screen.findByRole('button', { name: 'Change role for Abuela' });
  expect(
    screen.queryByRole('button', { name: 'Change role for Alex' }),
  ).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Change role for Owner' }),
  ).toBeNull();
  await user.press(
    screen.getByRole('button', { name: 'Change role for Abuela' }),
  );
  expect(screen.queryByRole('button', { name: 'Admin' })).toBeNull();
  await user.press(screen.getByRole('button', { name: 'Read-only' }));
  await user.press(screen.getByRole('button', { name: 'Save role' }));
  await screen.findByRole('alert', {
    name: 'This membership changed while you were editing. Refresh and choose the role again.',
  });
});

it.each(['MEMBER', 'READ_ONLY'] as const)(
  'does not expose role editing to %s',
  async (role) => {
    await i18n.changeLanguage('en');
    mockApi.getCurrentPerson.mockResolvedValue(person);
    mockApi.listFamilies.mockResolvedValue([{ ...family, role }]);
    mockApi.listFamilyPeople.mockResolvedValue([
      {
        person: managed,
        role: 'MEMBER',
        membershipUpdatedAt: '2026-11-05T00:00:00Z',
        canIssueClaim: false,
      },
    ]);
    const { user } = await setup();
    await user.press(
      await screen.findByRole('button', { name: 'View profile for Abuela' }),
    );
    await screen.findByText('Member · Managed profile');
    expect(
      screen.queryByRole('button', { name: 'Change role for Abuela' }),
    ).toBeNull();
  },
);

it('opens family metadata separately from a person profile and returns to the tree', async () => {
  mockApi.getCurrentPerson.mockResolvedValue(person);
  mockApi.listFamilies.mockResolvedValue([
    { ...family, description: 'Nuestra historia' },
  ]);
  mockApi.listFamilyPeople.mockResolvedValue([
    {
      person,
      role: 'OWNER',
      membershipUpdatedAt: '2026-11-05T00:00:00Z',
      canIssueClaim: false,
    },
    {
      person: { ...managed, biography: 'Su historia' },
      role: 'MEMBER',
      membershipUpdatedAt: '2026-11-05T00:00:00Z',
      canIssueClaim: true,
    },
  ]);
  const { user } = await setup();
  await user.press(
    await screen.findByRole('button', { name: 'Ver detalles de Familia Uno' }),
  );
  expect(screen.getByText('Creada por: Alex')).toBeOnTheScreen();
  expect(screen.getByText('Nuestra historia')).toBeOnTheScreen();
  expect(screen.getByText('Personas: 2')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Volver al árbol' }));
  await user.press(
    screen.getByRole('button', { name: 'Ver perfil de Abuela' }),
  );
  expect(screen.getByText('Su historia')).toBeOnTheScreen();
  expect(screen.getByText('Miembro · Perfil gestionado')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Volver al árbol' }));
  expect(screen.queryByText('Su historia')).not.toBeOnTheScreen();
  expect(screen.getByText('Árbol familiar')).toBeOnTheScreen();
});

it('confirms removal, preserves cancellation, and removes inactive people and links from the tree', async () => {
  mockApi.getCurrentPerson.mockResolvedValue(person);
  mockApi.listFamilies.mockResolvedValue([family]);
  const ownerEntry = {
    person,
    role: 'OWNER' as const,
    membershipUpdatedAt: '2026-11-05T00:00:00Z',
    canIssueClaim: false,
  };
  mockApi.listFamilyPeople.mockResolvedValue([
    ownerEntry,
    {
      person: managed,
      role: 'MEMBER',
      membershipUpdatedAt: '2026-11-05T00:00:00Z',
      canIssueClaim: true,
    },
  ]);
  mockApi.listFamilyRelationships.mockResolvedValue([
    {
      id: 'link',
      family_id: family.id,
      kind: 'PARENT_CHILD',
      from_person_id: managed.id,
      to_person_id: person.id,
      created_at: '',
      created_by_user_id: 'user-1',
    },
  ]);
  mockApi.removeFamilyMember.mockImplementation(async () => {
    mockApi.listFamilyPeople.mockResolvedValue([ownerEntry]);
  });
  const { user } = await setup();
  await user.press(
    await screen.findByRole('button', { name: 'Ver perfil de Abuela' }),
  );
  await user.press(
    screen.getByRole('button', { name: 'Quitar a Abuela de la familia' }),
  );
  expect(mockApi.removeFamilyMember).not.toHaveBeenCalled();
  await user.press(screen.getByRole('button', { name: 'Cancelar' }));
  expect(
    screen.getByRole('button', { name: 'Vincular cuenta de Abuela' }),
  ).toBeOnTheScreen();
  await user.press(
    screen.getByRole('button', { name: 'Quitar a Abuela de la familia' }),
  );
  await user.press(
    screen.getByRole('button', { name: 'Confirmar eliminación de membresía' }),
  );
  await screen.findByText('Árbol familiar');
  expect(
    screen.queryByRole('button', { name: 'Ver perfil de Abuela' }),
  ).toBeNull();
  expect(
    screen.queryByTestId('tree-edge-link', { includeHiddenElements: true }),
  ).toBeNull();
  expect(mockApi.removeFamilyMember).toHaveBeenCalledWith(
    { familyId: family.id, personId: managed.id, expectedRole: 'MEMBER' },
    expect.anything(),
  );
});

it('offers ownership only for linked non-owners and refreshes the former owner’s permissions', async () => {
  mockApi.getCurrentPerson.mockResolvedValue(person);
  mockApi.listFamilies.mockResolvedValue([family]);
  const linked = { ...managed, user_id: 'user-2' };
  mockApi.listFamilyPeople.mockResolvedValue([
    {
      person,
      role: 'OWNER',
      membershipUpdatedAt: '2026-11-05T00:00:00Z',
      canIssueClaim: false,
    },
    {
      person: linked,
      role: 'READ_ONLY',
      membershipUpdatedAt: '2026-11-05T00:00:00Z',
      canIssueClaim: false,
    },
  ]);
  mockApi.transferFamilyOwnership.mockImplementation(async () => {
    mockApi.listFamilies.mockResolvedValue([{ ...family, role: 'ADMIN' }]);
    mockApi.listFamilyPeople.mockResolvedValue([
      {
        person,
        role: 'ADMIN',
        membershipUpdatedAt: '2026-11-05T00:00:00Z',
        canIssueClaim: false,
      },
      {
        person: linked,
        role: 'OWNER',
        membershipUpdatedAt: '2026-11-05T00:00:00Z',
        canIssueClaim: false,
      },
    ]);
  });
  const { user } = await setup();
  await user.press(
    await screen.findByRole('button', { name: 'Ver perfil de Alex' }),
  );
  expect(
    screen.queryByRole('button', { name: 'Quitar a Alex de la familia' }),
  ).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Transferir propiedad a Alex' }),
  ).toBeNull();
  await user.press(screen.getByRole('button', { name: 'Volver al árbol' }));
  await user.press(
    screen.getByRole('button', { name: 'Ver perfil de Abuela' }),
  );
  await user.press(
    screen.getByRole('button', { name: 'Transferir propiedad a Abuela' }),
  );
  expect(mockApi.transferFamilyOwnership).not.toHaveBeenCalled();
  await user.press(
    screen.getByRole('button', { name: 'Confirmar transferencia' }),
  );
  await screen.findByText('Tu rol: Administrador');
  await user.press(
    screen.getByRole('button', { name: 'Ver perfil de Abuela' }),
  );
  expect(
    screen.getByText('Propietario · Con cuenta vinculada'),
  ).toBeOnTheScreen();
  expect(
    screen.queryByRole('button', { name: 'Quitar a Abuela de la familia' }),
  ).toBeNull();
  expect(mockApi.transferFamilyOwnership).toHaveBeenCalledWith(
    { familyId: family.id, personId: managed.id, expectedRole: 'READ_ONLY' },
    expect.anything(),
  );
});

it.each(['OWNER', 'READ_ONLY'] as const)(
  'refreshes branch people and the current %s role after another device makes changes',
  async (updatedRole) => {
    mockApi.getCurrentPerson.mockResolvedValue(person);
    mockApi.listFamilies.mockResolvedValue([family]);
    mockApi.listFamilyPeople.mockResolvedValue([
      {
        person,
        role: 'OWNER',
        membershipUpdatedAt: '2026-11-05T00:00:00Z',
        canIssueClaim: false,
      },
    ]);
    const branch = {
      id: 'branch-1',
      family_id: family.id,
      name: 'North',
      description: null,
      created_by_user_id: 'user-1',
      created_at: '',
      updated_at: '',
      branch_memberships: [] as { person_id: string }[],
    };
    mockApi.listFamilyBranches.mockResolvedValue([branch]);
    const { user } = await setup();
    await user.press(
      await screen.findByRole('button', {
        name: 'Ver detalles de Familia Uno',
      }),
    );
    await user.press(screen.getByRole('button', { name: 'Ramas familiares' }));
    await user.press(await screen.findByRole('button', { name: 'North' }));
    expect(
      screen.getByText('Esta rama todavía no tiene miembros.'),
    ).toBeOnTheScreen();

    mockApi.listFamilyPeople.mockResolvedValue([
      {
        person,
        role: updatedRole,
        membershipUpdatedAt: '2026-11-05T00:00:00Z',
        canIssueClaim: false,
      },
      {
        person: managed,
        role: 'MEMBER',
        membershipUpdatedAt: '2026-11-05T00:00:00Z',
        canIssueClaim: false,
      },
    ]);
    mockApi.listFamilies.mockResolvedValue([{ ...family, role: updatedRole }]);
    mockApi.listFamilyBranches.mockResolvedValue([
      { ...branch, branch_memberships: [{ person_id: managed.id }] },
    ]);
    await user.press(
      screen.getAllByRole('button', { name: 'Actualizar familias' }).at(-1)!,
    );
    expect(await screen.findByText('Abuela')).toBeOnTheScreen();
    expect(
      screen.queryByText('Esta rama todavía no tiene miembros.'),
    ).toBeNull();
    if (updatedRole === 'OWNER') {
      expect(
        await screen.findByRole('button', {
          name: 'Quitar a Abuela de la rama',
        }),
      ).toBeOnTheScreen();
    } else {
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Quitar a Abuela de la rama' }),
        ).toBeNull(),
      );
      expect(
        screen.queryByRole('button', { name: 'Agregar a Alex a la rama' }),
      ).toBeNull();
    }
  },
);

it('closes the family picker without changing selection and creates a family from it', async () => {
  mockApi.getCurrentPerson.mockResolvedValue(person);
  mockApi.listFamilies.mockResolvedValue([family]);
  mockApi.createFamily.mockImplementation(async () => {
    mockApi.listFamilies.mockResolvedValue([family, second]);
    return second.id;
  });
  const { user } = await setup();
  await user.press(await screen.findByRole('button', { name: 'Mis familias' }));
  expect(
    screen.getByRole('button', { name: family.name, selected: true }),
  ).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Volver al árbol' }));
  expect(screen.queryByRole('button', { name: 'Crear familia' })).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Ver detalles de Familia Uno' }),
  ).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Mis familias' }));
  await user.press(screen.getByRole('button', { name: 'Crear familia' }));
  await user.type(screen.getByLabelText('Nombre de la familia'), 'Familia Dos');
  await user.press(screen.getByRole('button', { name: 'Crear familia' }));
  expect(
    await screen.findByRole('button', { name: 'Ver detalles de Familia Dos' }),
  ).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Crear familia' })).toBeNull();
  expect(await AsyncStorage.getItem(familyStorageKey('user-1'))).toBe(
    second.id,
  );
});

it('keeps family switching available when the selected family cannot load people', async () => {
  mockApi.getCurrentPerson.mockResolvedValue(person);
  mockApi.listFamilies.mockResolvedValue([family, second]);
  mockApi.listFamilyPeople.mockImplementation(async (_user, id) => {
    if (id === family.id) throw new Error('network');
    return [];
  });
  const { user } = await setup();
  await screen.findByRole('alert');
  await user.press(screen.getByRole('button', { name: 'Mis familias' }));
  await user.press(screen.getByRole('button', { name: second.name }));
  expect(
    await screen.findByRole('button', { name: 'Ver detalles de Familia Dos' }),
  ).toBeOnTheScreen();
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';

import i18n from '@/i18n';

import * as api from '../api';
import { familyKeys } from '../queries';
import { familyStorageKey } from '../useFamilySelection';

import { FamilyWorkspace } from './FamilyWorkspace';

jest.mock('../api');
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
  id: 'family-1',
  name: 'Familia Uno',
  description: null,
  role: 'OWNER',
};
const second: api.Family = {
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
  mockApi.listFamilyPeople.mockResolvedValue([]);
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
      { person: managed, role: 'MEMBER', canIssueClaim: true },
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
  await screen.findByText('Abuela');
  expect(mockApi.createManagedPerson).toHaveBeenCalledWith(
    { name: 'Abuela', description: '', familyId: family.id },
    expect.anything(),
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
  expect(await screen.findByText('Hola, Abuela')).toBeOnTheScreen();
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
      canIssueClaim: false,
    },
  ]);
  const { user } = await setup();
  await screen.findByText('Primera persona');
  await user.press(screen.getByRole('button', { name: second.name }));
  expect(await screen.findByText('Segunda persona')).toBeOnTheScreen();
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
    { person: managed, role: 'MEMBER', canIssueClaim: false },
  ]);
  await setup();
  await screen.findByText('Abuela');
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

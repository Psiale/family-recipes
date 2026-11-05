import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';

import * as familyApi from '@/features/families/api';

import * as api from './api';
import { DelegationScreen } from './DelegationScreen';

jest.mock('./api');
jest.mock('@/features/families/api');
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: jest.fn() }),
}));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.useFakeTimers();
const family = { id: 'f', name: 'Family', role: 'MEMBER' } as familyApi.Family;
const person = {
  id: 'p',
  user_id: 'u',
  display_name: 'Alex',
} as familyApi.Person;
beforeEach(() => {
  jest.clearAllMocks();
  Object.values({ ...familyApi, ...api }).forEach((mock) => {
    if (jest.isMockFunction(mock)) mock.mockReset();
  });
  jest.mocked(familyApi.getCurrentPerson).mockResolvedValue(person);
  jest.mocked(familyApi.listFamilies).mockResolvedValue([family]);
  jest.mocked(familyApi.listFamilyPeople).mockResolvedValue([
    { person, role: 'MEMBER', canIssueClaim: false },
    {
      person: { ...person, id: 'p2', user_id: 'u2', display_name: 'Rosa' },
      role: 'READ_ONLY',
      canIssueClaim: false,
    },
    {
      person: { ...person, id: 'p3', user_id: null, display_name: 'Managed' },
      role: 'MEMBER',
      canIssueClaim: false,
    },
  ]);
  jest.mocked(api.listMyManagers).mockResolvedValue([]);
});
async function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await render(
    <QueryClientProvider client={client}>
      <DelegationScreen userId="u" />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
it('requires confirmation of global access and excludes self and unlinked people', async () => {
  jest.mocked(api.setPersonManager).mockImplementation(async () => {
    jest
      .mocked(api.listMyManagers)
      .mockResolvedValue([{ manager_user_id: 'u2', display_name: 'Rosa' }]);
  });
  const user = await setup();
  await user.press(
    await screen.findByRole('button', { name: 'Autorizar a Rosa' }),
  );
  expect(api.setPersonManager).not.toHaveBeenCalled();
  expect(
    screen.getByText(/incluidas las privadas de distintas familias/),
  ).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('button', { name: 'Autorizar a Alex' })).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Autorizar a Managed' }),
  ).toBeNull();
  await user.press(screen.getByRole('button', { name: 'Autorizar a Rosa' }));
  await user.press(
    screen.getByRole('button', { name: 'Confirmar acceso global' }),
  );
  expect(
    await screen.findByRole('button', { name: 'Revocar acceso de Rosa' }),
  ).toBeOnTheScreen();
  expect(jest.mocked(api.setPersonManager).mock.calls[0]?.[0]).toEqual({
    managerUserId: 'u2',
    familyId: 'f',
    enabled: true,
    expectedEnabled: false,
    name: 'Rosa',
  });
});
it('allows revocation after all family memberships have ended', async () => {
  jest.mocked(familyApi.listFamilies).mockResolvedValue([]);
  jest
    .mocked(api.listMyManagers)
    .mockResolvedValue([{ manager_user_id: 'u2', display_name: 'Rosa' }]);
  jest.mocked(api.setPersonManager).mockImplementation(async () => {
    jest.mocked(api.listMyManagers).mockResolvedValue([]);
  });
  const user = await setup();
  await user.press(
    await screen.findByRole('button', { name: 'Revocar acceso de Rosa' }),
  );
  expect(api.setPersonManager).not.toHaveBeenCalled();
  await user.press(
    screen.getByRole('button', { name: 'Confirmar revocación' }),
  );
  expect(
    await screen.findByText('Todavía no has autorizado delegados.'),
  ).toBeOnTheScreen();
  expect(jest.mocked(api.setPersonManager).mock.calls[0]?.[0]).toEqual({
    managerUserId: 'u2',
    enabled: false,
    expectedEnabled: true,
    name: 'Rosa',
  });
});
it('keeps a stale confirmation open with recovery instructions', async () => {
  jest
    .mocked(api.setPersonManager)
    .mockRejectedValue({ code: 'PT409', message: 'internal detail' });
  const user = await setup();
  await user.press(
    await screen.findByRole('button', { name: 'Autorizar a Rosa' }),
  );
  await user.press(
    screen.getByRole('button', { name: 'Confirmar acceso global' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    /Cancela y revisa/,
  );
  expect(screen.queryByText('internal detail')).toBeNull();
});
it('shows an error instead of an empty delegate list when loading fails', async () => {
  jest.mocked(api.listMyManagers).mockRejectedValue(new Error('offline'));
  await setup();
  expect(await screen.findByRole('alert')).toBeOnTheScreen();
  expect(screen.queryByText('Todavía no has autorizado delegados.')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Autorizar a Rosa' })).toBeNull();
});

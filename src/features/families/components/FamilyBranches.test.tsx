import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';

import * as api from '../api';

import { FamilyBranches } from './FamilyBranches';

jest.mock('../api');
jest.useFakeTimers();
const family = { id: 'f', name: 'Family', role: 'OWNER' } as api.Family;
const people = [
  {
    person: { id: 'p', display_name: 'Alex' },
    role: 'MEMBER',
    membershipUpdatedAt: '2026-11-05T00:00:00Z',
    canIssueClaim: true,
  },
] as api.FamilyPerson[];
const branch = {
  id: 'b',
  family_id: 'f',
  name: 'North',
  description: 'Our branch',
  branch_memberships: [],
} as unknown as Awaited<ReturnType<typeof api.listFamilyBranches>>[number];
async function mount(role: api.FamilyRole = 'OWNER') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = await render(
    <QueryClientProvider client={client}>
      <FamilyBranches
        userId="u"
        family={{ ...family, role }}
        people={people}
        onClose={jest.fn()}
      />
    </QueryClientProvider>,
  );
  return { ...view, client };
}
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(api.listFamilyBranches).mockResolvedValue([branch]);
});
it('creates a branch and opens its members', async () => {
  const user = userEvent.setup();
  jest.mocked(api.listFamilyBranches).mockResolvedValue([]);
  jest.mocked(api.createFamilyBranch).mockImplementation(async () => {
    jest.mocked(api.listFamilyBranches).mockResolvedValue([branch]);
    return 'b';
  });
  await mount();
  expect(await screen.findByText('Todavía no hay ramas.')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Crear rama' }));
  await user.type(screen.getByLabelText('Nombre de la rama'), 'North');
  await user.press(screen.getByRole('button', { name: 'Crear rama' }));
  expect(
    await screen.findByText('Esta rama todavía no tiene miembros.'),
  ).toBeOnTheScreen();
  expect(jest.mocked(api.createFamilyBranch).mock.calls[0]?.[0]).toEqual({
    familyId: 'f',
    name: 'North',
    description: '',
  });
});
it('refreshes branch membership after adding and removing a person', async () => {
  const user = userEvent.setup();
  jest
    .mocked(api.setBranchMembership)
    .mockImplementation(async ({ isMember }) => {
      jest.mocked(api.listFamilyBranches).mockResolvedValue([
        {
          ...branch,
          branch_memberships: isMember ? [{ person_id: 'p' }] : [],
        },
      ]);
    });
  await mount();
  await user.press(await screen.findByRole('button', { name: 'North' }));
  await user.press(
    screen.getByRole('button', { name: 'Agregar a Alex a la rama' }),
  );
  await user.press(
    await screen.findByRole('button', { name: 'Quitar a Alex de la rama' }),
  );
  expect(jest.mocked(api.setBranchMembership).mock.calls.at(-1)?.[0]).toEqual({
    familyId: 'f',
    branchId: 'b',
    personId: 'p',
    expectedMember: true,
    isMember: false,
  });
  expect(
    await screen.findByRole('button', { name: 'Agregar a Alex a la rama' }),
  ).toBeOnTheScreen();
});
it.each(['MEMBER', 'READ_ONLY'] as const)(
  'allows %s to view without editing',
  async (role) => {
    jest
      .mocked(api.listFamilyBranches)
      .mockResolvedValue([
        { ...branch, branch_memberships: [{ person_id: 'p' }] },
      ]);
    const user = userEvent.setup();
    await mount(role);
    expect(screen.queryByRole('button', { name: 'Crear rama' })).toBeNull();
    await user.press(await screen.findByRole('button', { name: 'North' }));
    expect(screen.getByText('Alex')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Alex/ })).toBeNull();
  },
);
it('keeps cached branches visible after a failed refresh', async () => {
  const user = userEvent.setup();
  await mount();
  await screen.findByRole('button', { name: 'North' });
  jest.mocked(api.listFamilyBranches).mockRejectedValue(new Error('offline'));
  await user.press(screen.getByRole('button', { name: 'Actualizar familias' }));
  expect(await screen.findByRole('alert')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'North' })).toBeOnTheScreen();
});
it('explains stale changes without exposing server details', async () => {
  const user = userEvent.setup();
  jest
    .mocked(api.setBranchMembership)
    .mockRejectedValue({ code: 'PT409', message: 'private detail' });
  await mount('ADMIN');
  await user.press(await screen.findByRole('button', { name: 'North' }));
  await user.press(
    screen.getByRole('button', { name: 'Agregar a Alex a la rama' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    /Actualiza las ramas/,
  );
  expect(screen.queryByText('private detail')).toBeNull();
});

it('reports duplicate branch names without leaving the form', async () => {
  const user = userEvent.setup();
  jest.mocked(api.createFamilyBranch).mockRejectedValue({ code: '23505' });
  await mount();
  await user.press(screen.getByRole('button', { name: 'Crear rama' }));
  await user.type(screen.getByLabelText('Nombre de la rama'), 'North');
  await user.press(screen.getByRole('button', { name: 'Crear rama' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    /Ya existe una rama/,
  );
  expect(screen.getByLabelText('Nombre de la rama')).toHaveDisplayValue(
    'North',
  );
});

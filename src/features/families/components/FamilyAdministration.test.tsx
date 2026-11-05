import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';

import i18n from '@/i18n';

import * as api from '../api';
import { familyKeys } from '../queries';

import { FamilyAdministration } from './FamilyAdministration';
jest.mock('../api');
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
const mocks = jest.mocked(api);
async function openScreen(superAdmin: boolean, cachedRole?: boolean) {
  await i18n.changeLanguage('es');
  mocks.isSuperAdmin.mockResolvedValue(superAdmin);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
  if (cachedRole !== undefined) {
    client.setQueryData(
      [...familyKeys.root('tester'), 'super-admin'],
      cachedRole,
    );
  }
  await render(
    <QueryClientProvider client={client}>
      <FamilyAdministration userId="tester" />
    </QueryClientProvider>,
  );
}
beforeEach(() => jest.clearAllMocks());
it('withholds the directory until the cached platform grant has been rechecked', async () => {
  await openScreen(false, true);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    i18n.t('administration.denied'),
  );
  expect(mocks.searchFamilies).not.toHaveBeenCalled();
});

it.each(['cancel', 'approve'] as const)(
  'searches outside memberships, inspects the request and confirms %s',
  async (action) => {
    const family = {
      id: 'foreign',
      name: 'Luna',
      description: null,
      created_at: '',
      created_by_user_id: 'owner',
    };
    mocks.searchFamilies.mockImplementation(async (name) => ({
      families: name === 'Luna' ? [family] : [],
      more: false,
    }));
    mocks.listFamilyPeople.mockResolvedValue([
      {
        person: {
          id: 'p',
          display_name: 'Ana',
          user_id: 'owner',
          biography: null,
          created_at: '',
          created_by_user_id: null,
          profile_photo_path: null,
          updated_at: '',
        },
        role: 'OWNER',
        membershipUpdatedAt: '2026-11-05T00:00:00Z',
        canIssueClaim: false,
      },
    ]);
    mocks.listDeletionRequests.mockResolvedValue([
      {
        id: 'request',
        family_id: family.id,
        requested_by_user_id: 'owner',
        family,
        created_at: '',
        expires_at: '2099-01-01',
      },
    ]);
    mocks.familyLifecycleAction.mockResolvedValue(family.id);
    await openScreen(true);
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText(i18n.t('administration.name')),
      'Luna',
    );
    await user.press(screen.getByRole('button', { name: 'Buscar' }));
    await user.press(await screen.findByRole('button', { name: 'Luna' }));
    expect(await screen.findByText(/Ana ·/)).toBeOnTheScreen();
    expect(screen.getByText('Solicitud de Ana')).toBeOnTheScreen();
    expect(screen.getByText(/Fecha de vencimiento: .*209/)).toBeOnTheScreen();
    await user.press(
      screen.getByRole('button', {
        name: i18n.t(
          action === 'approve'
            ? 'familyLifecycle.approve'
            : 'familyLifecycle.cancelRequest',
        ),
      }),
    );
    if (action === 'approve') {
      expect(
        screen.getByRole('button', { name: i18n.t('familyLifecycle.confirm') }),
      ).toBeDisabled();
      await user.type(
        screen.getByLabelText(i18n.t('familyLifecycle.typeName')),
        family.name,
      );
    }
    expect(mocks.familyLifecycleAction).not.toHaveBeenCalled();
    await user.press(
      screen.getByRole('button', { name: i18n.t('familyLifecycle.confirm') }),
    );
    expect(
      await screen.findByText(i18n.t('familyLifecycle.done')),
    ).toBeOnTheScreen();
    expect(mocks.familyLifecycleAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action,
        familyId: family.id,
        requestId: 'request',
      }),
      expect.anything(),
    );
  },
);

it.each(['rename', 'remove'] as const)(
  'opens %s from an unrelated family roster without joining it',
  async (action) => {
    const family = {
      id: 'foreign',
      name: 'Luna',
      description: null,
      created_at: '',
      created_by_user_id: 'owner',
    };
    mocks.searchFamilies.mockResolvedValue({ families: [family], more: false });
    mocks.listDeletionRequests.mockResolvedValue([]);
    mocks.listFamilyPeople.mockResolvedValue([
      {
        person: {
          id: 'p',
          display_name: 'Ana',
          user_id: null,
          biography: null,
          created_at: '',
          created_by_user_id: null,
          profile_photo_path: null,
          updated_at: 'person-version',
        },
        role: 'MEMBER',
        membershipUpdatedAt: 'member-version',
        canIssueClaim: false,
      },
    ]);
    mocks.adminRenamePerson.mockResolvedValue();
    mocks.adminRemoveFamilyMember.mockResolvedValue();
    await openScreen(true);
    const user = userEvent.setup();
    await user.press(await screen.findByRole('button', { name: 'Luna' }));
    await user.press(
      await screen.findByRole('button', {
        name: i18n.t(`personAdministration.${action}`, { name: 'Ana' }),
      }),
    );
    if (action === 'rename') {
      await user.clear(
        screen.getByLabelText(i18n.t('personAdministration.newName')),
      );
      await user.type(
        screen.getByLabelText(i18n.t('personAdministration.newName')),
        'Anita',
      );
    }
    await user.type(
      screen.getByLabelText(i18n.t('personAdministration.reason')),
      'Correction',
    );
    await user.press(
      screen.getByRole('button', {
        name: i18n.t('personAdministration.review'),
      }),
    );
    expect(mocks.adminRenamePerson).not.toHaveBeenCalled();
    expect(mocks.adminRemoveFamilyMember).not.toHaveBeenCalled();
    await user.press(
      screen.getByRole('button', {
        name: i18n.t('personAdministration.confirm'),
      }),
    );
    expect(
      await screen.findByText(i18n.t('personAdministration.done')),
    ).toBeOnTheScreen();
    expect(mocks.listFamilyPeople).toHaveBeenCalledWith('tester', 'foreign');
    expect(
      action === 'rename'
        ? mocks.adminRenamePerson
        : mocks.adminRemoveFamilyMember,
    ).toHaveBeenCalledTimes(1);
    expect(mocks.createFamily).not.toHaveBeenCalled();
  },
);

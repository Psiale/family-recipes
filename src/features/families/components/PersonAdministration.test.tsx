import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';

import i18n from '@/i18n';

import * as api from '../api';

import { PersonAdministration } from './PersonAdministration';

jest.mock('../api');
const mocks = jest.mocked(api);
const member: api.FamilyPerson = {
  person: {
    id: 'person',
    user_id: 'linked',
    display_name: 'Ana',
    deleted_at: null,
    biography: null,
    profile_photo_path: null,
    created_by_user_id: null,
    created_at: '',
    updated_at: 'person-stamp',
  },
  role: 'MEMBER',
  membershipUpdatedAt: 'member-stamp',
  canIssueClaim: false,
};
const family: api.DirectoryFamily = {
  id: 'unrelated-family',
  name: 'Luna',
  description: null,
  created_at: '',
  created_by_user_id: 'owner',
};
const done = jest.fn(),
  close = jest.fn();
async function open(
  action: 'rename' | 'remove',
  language = 'es',
  linked = true,
) {
  await i18n.changeLanguage(language);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
  await render(
    <QueryClientProvider client={client}>
      <PersonAdministration
        userId="super-without-membership"
        family={family}
        member={{
          ...member,
          person: { ...member.person, user_id: linked ? 'linked' : null },
        }}
        action={action}
        onDone={done}
        onClose={close}
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  mocks.adminRenamePerson.mockResolvedValue();
  mocks.adminRemoveFamilyMember.mockResolvedValue();
});
it.each(['es', 'en'])(
  'reviews current/proposed global names and required reason in %s',
  async (language) => {
    await open('rename', language);
    const user = userEvent.setup();
    expect(
      screen.getByRole('button', {
        name: i18n.t('personAdministration.review'),
      }),
    ).toBeDisabled();
    await user.clear(
      screen.getByLabelText(i18n.t('personAdministration.newName')),
    );
    await user.type(
      screen.getByLabelText(i18n.t('personAdministration.newName')),
      'Anita',
    );
    await user.type(
      screen.getByLabelText(i18n.t('personAdministration.reason')),
      'Correction',
    );
    await user.press(
      screen.getByRole('button', {
        name: i18n.t('personAdministration.review'),
      }),
    );
    expect(
      screen.getByText(
        i18n.t('personAdministration.currentName', { name: 'Ana' }),
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        i18n.t('personAdministration.proposedName', { name: 'Anita' }),
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(i18n.t('personAdministration.renameExplanation')),
    ).toBeOnTheScreen();
    expect(mocks.adminRenamePerson).not.toHaveBeenCalled();
    await user.press(
      screen.getByRole('button', {
        name: i18n.t('personAdministration.confirm'),
      }),
    );
    expect(mocks.adminRenamePerson).toHaveBeenCalledWith({
      personId: 'person',
      expectedName: 'Ana',
      expectedUpdatedAt: 'person-stamp',
      name: 'Anita',
      reason: 'Correction',
    });
    expect(mocks.adminRemoveFamilyMember).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
  },
);
it('removes an unclaimed person only from the named family after explicit review', async () => {
  await open('remove', 'es', false);
  const user = userEvent.setup();
  expect(
    screen.getByText(
      i18n.t('personAdministration.removeExplanation', {
        name: 'Ana',
        family: 'Luna',
      }),
    ),
  ).toBeOnTheScreen();
  await user.type(
    screen.getByLabelText(i18n.t('personAdministration.reason')),
    'Mistaken family',
  );
  await user.press(
    screen.getByRole('button', { name: i18n.t('personAdministration.review') }),
  );
  expect(mocks.adminRemoveFamilyMember).not.toHaveBeenCalled();
  await user.press(
    screen.getByRole('button', {
      name: i18n.t('personAdministration.confirm'),
    }),
  );
  expect(mocks.adminRemoveFamilyMember).toHaveBeenCalledWith({
    familyId: 'unrelated-family',
    personId: 'person',
    expectedRole: 'MEMBER',
    expectedUpdatedAt: 'member-stamp',
    expectedName: 'Ana',
    expectedFamilyName: 'Luna',
    reason: 'Mistaken family',
  });
  expect(mocks.adminRenamePerson).not.toHaveBeenCalled();
});
it.each([
  ['PT409', 'stale'],
  ['PT412', 'lastOwner'],
] as const)('requires reopening after %s', async (code, key) => {
  mocks.adminRemoveFamilyMember.mockRejectedValue({ code });
  await open('remove');
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText(i18n.t('personAdministration.reason')),
    'Correction',
  );
  await user.press(
    screen.getByRole('button', { name: i18n.t('personAdministration.review') }),
  );
  await user.press(
    screen.getByRole('button', {
      name: i18n.t('personAdministration.confirm'),
    }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    i18n.t(`personAdministration.${key}`),
  );
  expect(
    screen.getByRole('button', {
      name: i18n.t('personAdministration.confirm'),
    }),
  ).toBeDisabled();
  expect(done).not.toHaveBeenCalled();
  await user.press(
    screen.getByRole('button', { name: i18n.t('families.cancel') }),
  );
  expect(close).toHaveBeenCalled();
});
it('preserves reviewed values through a failed save and retry', async () => {
  mocks.adminRemoveFamilyMember.mockRejectedValueOnce(new Error('offline'));
  await open('remove');
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText(i18n.t('personAdministration.reason')),
    'Keep reason',
  );
  await user.press(
    screen.getByRole('button', { name: i18n.t('personAdministration.review') }),
  );
  await user.press(
    screen.getByRole('button', {
      name: i18n.t('personAdministration.confirm'),
    }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    i18n.t('families.errors.save'),
  );
  expect(
    screen.getByText(
      i18n.t('personAdministration.reviewReason', { reason: 'Keep reason' }),
    ),
  ).toBeOnTheScreen();
  await user.press(
    screen.getByRole('button', {
      name: i18n.t('personAdministration.confirm'),
    }),
  );
  expect(mocks.adminRemoveFamilyMember).toHaveBeenCalledTimes(2);
  expect(done).toHaveBeenCalledTimes(1);
});

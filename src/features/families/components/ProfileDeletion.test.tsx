import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';

import i18n from '@/i18n';

import * as api from '../api';

import { ProfileDeletion } from './ProfileDeletion';
jest.mock('../api');
const mocks = jest.mocked(api);
const impact: api.ProfileDeletionImpact = {
  person_id: 'p',
  name: 'Ana',
  linked: true,
  families: [
    { id: 'a', name: 'Luna', role: 'MEMBER', last_owner: false },
    { id: 'b', name: 'Sol', role: 'ADMIN', last_owner: false },
  ],
  manager_grants: 3,
  owned_recipes: 2,
  platform_admin: false,
  expected_state: 'snapshot',
};
const done = jest.fn();
async function open(lang = 'es') {
  await i18n.changeLanguage(lang);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
  await render(
    <QueryClientProvider client={client}>
      <ProfileDeletion
        userId="nonmember-super"
        personId="p"
        onClose={jest.fn()}
        onDone={done}
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  mocks.getProfileDeletionImpact.mockResolvedValue(impact);
  mocks.adminDeletePersonProfile.mockResolvedValue();
});
it.each(['es', 'en'])(
  'requires a global review, reason and exact typed name in %s',
  async (lang) => {
    await open(lang);
    const user = userEvent.setup();
    expect(await screen.findByText('Ana')).toBeOnTheScreen();
    expect(screen.getByText(/Luna ·/)).toBeOnTheScreen();
    expect(screen.getByText(/Sol ·/)).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: i18n.t('personAdministration.review'),
      }),
    ).toBeDisabled();
    await user.type(
      screen.getByLabelText(i18n.t('personAdministration.reason')),
      'Duplicate',
    );
    await user.press(
      screen.getByRole('button', {
        name: i18n.t('personAdministration.review'),
      }),
    );
    expect(
      screen.getByText(i18n.t('profileDeletion.explanation')),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: i18n.t('profileDeletion.confirm') }),
    ).toBeDisabled();
    expect(mocks.adminDeletePersonProfile).not.toHaveBeenCalled();
    await user.type(
      screen.getByLabelText(i18n.t('profileDeletion.typeName')),
      'Ana',
    );
    await user.press(
      screen.getByRole('button', { name: i18n.t('profileDeletion.confirm') }),
    );
    expect(mocks.adminDeletePersonProfile).toHaveBeenCalledWith({
      personId: 'p',
      expectedState: 'snapshot',
      confirmName: 'Ana',
      reason: 'Duplicate',
    });
    expect(done).toHaveBeenCalled();
  },
);
it('blocks a profile that is the last Owner in any family', async () => {
  mocks.getProfileDeletionImpact.mockResolvedValue({
    ...impact,
    families: [{ ...impact.families[0]!, last_owner: true }],
  });
  await open();
  const user = userEvent.setup();
  await screen.findByText('Ana');
  await user.type(
    screen.getByLabelText(i18n.t('personAdministration.reason')),
    'Reason',
  );
  expect(
    screen.getByRole('button', { name: i18n.t('personAdministration.review') }),
  ).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent(
    i18n.t('profileDeletion.blocked'),
  );
});
it('retains reviewed impact and blocks retry after a stale confirmation', async () => {
  mocks.adminDeletePersonProfile.mockRejectedValue({ code: 'PT409' });
  await open();
  const user = userEvent.setup();
  await screen.findByText('Ana');
  await user.type(
    screen.getByLabelText(i18n.t('personAdministration.reason')),
    'Reason',
  );
  await user.press(
    screen.getByRole('button', { name: i18n.t('personAdministration.review') }),
  );
  await user.type(
    screen.getByLabelText(i18n.t('profileDeletion.typeName')),
    'Ana',
  );
  await user.press(
    screen.getByRole('button', { name: i18n.t('profileDeletion.confirm') }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    i18n.t('personAdministration.stale'),
  );
  expect(
    screen.getByRole('button', { name: i18n.t('profileDeletion.confirm') }),
  ).toBeDisabled();
  expect(done).not.toHaveBeenCalled();
});

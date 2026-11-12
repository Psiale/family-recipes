import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { useAudioPlayer } from 'expo-audio';

import i18n from '@/i18n';

import * as api from './api';
import * as media from './media';
import { RecipeAudienceEditor } from './RecipeAudienceEditor';
import { RecipeCollections } from './RecipeCollections';
import { RecipeMediaView } from './RecipeMedia';
import { RecipePreservation } from './RecipePreservation';

jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  setPreservation: jest.fn(),
  listCollections: jest.fn(),
  collectionRecipes: jest.fn(),
  saveCollection: jest.fn(),
}));
jest.mock('./media', () => ({
  ...jest.requireActual('./media'),
  authorizedMediaSource: jest.fn().mockResolvedValue({
    uri: 'https://example.com/authorized.wav',
    headers: { Authorization: 'test-only' },
  }),
}));
const options: api.RecipeOptions = {
  people: [],
  families: [
    {
      id: 'f',
      name: 'Luna',
      can_write: true,
      can_manage: true,
      branches: [{ id: 'b', name: 'Materna' }],
    },
  ],
};
const collection: api.Collection = {
  id: 'c',
  family_id: 'f',
  localization_key: null,
  custom_name: 'Favoritas de Abuela',
  description: null,
  created_at: '2026-11-09T00:00:00Z',
  updated_at: '2026-11-09T00:00:00.123456Z',
  created_by_user_id: 'u',
};
const preserved: api.RecipeDetail = {
  recipe: {
    id: 'r',
    title: 'Huevos',
    description: null,
    origin_location: null,
    origin_year: null,
    story: null,
    servings: null,
    prep_time_minutes: null,
    cook_time_minutes: null,
    rest_time_minutes: null,
    owner_person_id: 'p',
    original_creator_person_id: 'p',
    entered_by_user_id: 'u',
    preservation_status: 'PRESERVED',
    updated_at: 'stamp',
  },
  ingredients: [],
  steps: [],
  media: [],
  visibilities: [],
  can_edit: false,
  can_preserve: true,
  latest_revision: 4,
  revisions: [],
  owner_name: 'Ana',
  owner_deleted: false,
  creator_name: 'Ana',
  creator_deleted: false,
};
async function show(ui: React.ReactNode) {
  const c = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  await render(<QueryClientProvider client={c}>{ui}</QueryClientProvider>);
  return c;
}
beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('es');
  jest.mocked(api.listCollections).mockResolvedValue([
    collection,
    {
      ...collection,
      id: 'default',
      localization_key: 'breakfast',
      custom_name: null,
    },
  ]);
  jest.mocked(api.collectionRecipes).mockResolvedValue([]);
});
it('switching to a branch removes whole-family sharing for that family', async () => {
  const change = jest.fn();
  await render(
    <RecipeAudienceEditor
      options={options}
      value={[{ family_id: 'f', branch_id: null }]}
      onChange={change}
      disabled={false}
    />,
  );
  await fireEvent(
    screen.getByRole('switch', {
      name: i18n.t('recipes.audiences.choice', {
        family: 'Luna',
        audience: 'Materna',
      }),
    }),
    'valueChange',
    true,
  );
  expect(change).toHaveBeenCalledWith([{ family_id: 'f', branch_id: 'b' }]);
});
it('requires a reason to unlock, and sends the exact current revision', async () => {
  jest.mocked(api.setPreservation).mockResolvedValue(undefined);
  const changed = jest.fn();
  await show(<RecipePreservation detail={preserved} onChanged={changed} />);
  const user = userEvent.setup();
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.preservation.unlock') }),
  );
  expect(
    screen.getByRole('button', {
      name: i18n.t('recipes.preservation.confirm'),
    }),
  ).toBeDisabled();
  await user.type(
    screen.getByLabelText(i18n.t('personAdministration.reason')),
    'Revisar cantidades',
  );
  await user.press(
    screen.getByRole('button', {
      name: i18n.t('recipes.preservation.confirm'),
    }),
  );
  await waitFor(() =>
    expect(api.setPreservation).toHaveBeenCalledWith(
      'r',
      4,
      false,
      'Revisar cantidades',
    ),
  );
  expect(changed).toHaveBeenCalledTimes(1);
});
it('does not expose preservation controls without server authorization', async () => {
  await show(
    <RecipePreservation
      detail={{ ...preserved, can_preserve: false }}
      onChanged={jest.fn()}
    />,
  );
  expect(screen.queryByRole('button')).toBeNull();
});
it.each(['es', 'en'])(
  'localizes defaults but keeps custom collection names unchanged in %s',
  async (locale) => {
    await i18n.changeLanguage(locale);
    await show(
      <RecipeCollections
        userId="u"
        options={options}
        onClose={jest.fn()}
        onOpenRecipe={jest.fn()}
      />,
    );
    expect(
      await screen.findByRole('button', {
        name: i18n.t('recipes.collections.defaults.breakfast'),
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Favoritas de Abuela' }),
    ).toBeOnTheScreen();
  },
);
it('read-only collection viewers cannot create or organize collections', async () => {
  await show(
    <RecipeCollections
      userId="u"
      options={{
        ...options,
        families: options.families.map((f) => ({
          ...f,
          can_write: false,
          can_manage: false,
        })),
      }}
      onClose={jest.fn()}
      onOpenRecipe={jest.fn()}
    />,
  );
  const user = userEvent.setup();
  await user.press(
    await screen.findByRole('button', { name: 'Favoritas de Abuela' }),
  );
  expect(
    screen.queryByRole('button', {
      name: i18n.t('recipes.collections.create'),
    }),
  ).toBeNull();
  expect(
    screen.queryByRole('button', { name: i18n.t('recipes.collections.edit') }),
  ).toBeNull();
  expect(
    screen.queryByRole('button', { name: i18n.t('recipes.collections.add') }),
  ).toBeNull();
});
it('blocks repeated collection confirmation after a stale response', async () => {
  jest.mocked(api.saveCollection).mockRejectedValue({ code: 'PT409' });
  await show(
    <RecipeCollections
      userId="u"
      options={options}
      onClose={jest.fn()}
      onOpenRecipe={jest.fn()}
    />,
  );
  const user = userEvent.setup();
  await user.press(
    await screen.findByRole('button', { name: 'Favoritas de Abuela' }),
  );
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.collections.edit') }),
  );
  await user.clear(screen.getByLabelText(i18n.t('recipes.collections.name')));
  await user.type(
    screen.getByLabelText(i18n.t('recipes.collections.name')),
    'Favoritas nuevas',
  );
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.collections.save') }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    i18n.t('recipes.collections.stale'),
  );
  expect(
    screen.getByRole('button', { name: i18n.t('recipes.collections.save') }),
  ).toBeDisabled();
  expect(api.saveCollection).toHaveBeenCalledTimes(1);
});
it('loads a private recording on demand, plays it and unmounts its player when closed', async () => {
  await show(
    <RecipeMediaView
      viewerId="u"
      media={[
        {
          id: 'a',
          kind: 'AUDIO',
          storage_path: 'u/a',
          file_name: 'Abuela.wav',
          caption: null,
          alt_text: null,
        },
      ]}
    />,
  );
  expect(media.authorizedMediaSource).not.toHaveBeenCalled();
  const user = userEvent.setup();
  await user.press(
    screen.getByRole('button', {
      name: i18n.t('recipes.media.open', { name: 'Abuela.wav' }),
    }),
  );
  const play = await screen.findByRole('button', {
    name: i18n.t('recipes.media.play'),
  });
  await user.press(play);
  const player = jest.mocked(useAudioPlayer).mock.results.at(-1)?.value;
  expect(player.play).toHaveBeenCalledTimes(1);
  await user.press(
    screen.getByRole('button', {
      name: i18n.t('recipes.media.close', { name: 'Abuela.wav' }),
    }),
  );
  expect(
    screen.queryByRole('button', { name: i18n.t('recipes.media.play') }),
  ).toBeNull();
});

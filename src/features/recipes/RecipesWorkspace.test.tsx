import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';

import i18n from '@/i18n';

import * as api from './api';
import { RecipesWorkspace } from './RecipesWorkspace';

jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  listRecipes: jest.fn(),
  getRecipe: jest.fn(),
  getRevision: jest.fn(),
  saveRecipe: jest.fn(),
}));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
const mocks = jest.mocked(api);
const detail: api.RecipeDetail = {
  recipe: {
    id: 'r',
    title: 'Sopa',
    description: null,
    origin_location: null,
    origin_year: null,
    story: 'Historia',
    servings: '4',
    prep_time_minutes: 10,
    cook_time_minutes: 20,
    rest_time_minutes: null,
    owner_person_id: 'p',
    original_creator_person_id: 'p',
    entered_by_user_id: 'u',
    preservation_status: 'EDITABLE',
    updated_at: 'stamp',
  },
  ingredients: [
    {
      ingredient: 'Tomate',
      quantity: '2',
      unit: null,
      preparation_note: null,
      section_name: null,
    },
  ],
  steps: [
    { instruction: 'Hervir', section_name: null, duration_minutes: null },
  ],
  owner_name: 'Ana',
  owner_deleted: false,
  creator_name: 'Ana',
  creator_deleted: false,
  can_edit: false,
  latest_revision: 2,
  revisions: [
    {
      revision_number: 1,
      change_summary: 'Primera versión',
      created_at: '2026-11-06T00:00:00Z',
    },
  ],
};
async function open() {
  await i18n.changeLanguage('es');
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
  await render(
    <QueryClientProvider client={client}>
      <RecipesWorkspace userId="u" />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  mocks.listRecipes.mockResolvedValue({
    recipes: [
      {
        id: 'r',
        title: 'Sopa',
        description: null,
        owner_name: 'Ana',
        owner_deleted: false,
        preservation_status: 'EDITABLE',
        updated_at: 'stamp',
      },
    ],
    more: false,
  });
  mocks.getRecipe.mockResolvedValue(detail);
  mocks.getRevision.mockResolvedValue({
    ...detail,
    recipe: { ...detail.recipe, title: 'Sopa original' },
  });
});
it('searches literally, displays full recipe and opens immutable historical content without edit controls', async () => {
  await open();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(i18n.t('recipes.search')), '*_%');
  await user.press(
    screen.getByRole('button', { name: i18n.t('administration.search') }),
  );
  expect(mocks.listRecipes).toHaveBeenCalledWith('*_%', 0);
  await user.press(await screen.findByRole('button', { name: 'Sopa' }));
  expect(await screen.findByText('1. Hervir')).toBeOnTheScreen();
  expect(screen.getByText('2 · Tomate')).toBeOnTheScreen();
  expect(
    screen.queryByRole('button', { name: i18n.t('recipes.edit') }),
  ).toBeNull();
  await user.press(screen.getByRole('button', { name: /Versión 1 ·/ }));
  expect(await screen.findByText('Sopa original')).toBeOnTheScreen();
  expect(mocks.getRevision).toHaveBeenCalledWith('r', 1);
});
it('uses anonymous attribution for a globally deleted profile', async () => {
  mocks.getRecipe.mockResolvedValue({
    ...detail,
    owner_deleted: true,
    creator_deleted: true,
  });
  await open();
  await userEvent
    .setup()
    .press(await screen.findByRole('button', { name: 'Sopa' }));
  expect(
    await screen.findByText('Propiedad de: Persona eliminada'),
  ).toBeOnTheScreen();
  expect(
    screen.getByText('Creación original: Persona eliminada'),
  ).toBeOnTheScreen();
});

import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';

import type { Family } from '@/features/families/api';
import i18n from '@/i18n';

import type { RecipeDetail } from './api';
import { RecipeForm } from './RecipeForm';

const family = { id: 'family', name: 'Luna', role: 'OWNER' } as Family;
beforeEach(async () => {
  await i18n.changeLanguage('es');
});
it.each(['es', 'en'])(
  'writes ordered ingredients/steps and private-by-default content in %s',
  async (language) => {
    await i18n.changeLanguage(language);
    const save = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    await render(
      <RecipeForm families={[family]} onSave={save} onCancel={jest.fn()} />,
    );
    await user.type(
      screen.getByLabelText(i18n.t('recipes.fields.title')),
      'Sopa',
    );
    await user.type(
      screen.getByLabelText(i18n.t('recipes.fields.ingredient', { number: 1 })),
      'Tomate',
    );
    await user.type(
      screen.getByLabelText(i18n.t('recipes.stepNumber', { number: 1 })),
      'Hervir',
    );
    await user.press(
      screen.getByRole('button', { name: i18n.t('recipes.addIngredient') }),
    );
    await user.type(
      screen.getByLabelText(i18n.t('recipes.fields.ingredient', { number: 2 })),
      'Sal',
    );
    await user.press(
      screen.getByRole('button', { name: i18n.t('recipes.addStep') }),
    );
    await user.type(
      screen.getByLabelText(i18n.t('recipes.stepNumber', { number: 2 })),
      'Servir',
    );
    await user.press(
      screen.getByRole('button', { name: i18n.t('recipes.save') }),
    );
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: 'family',
        shareWithFamily: false,
        content: expect.objectContaining({
          title: 'Sopa',
          ingredients: [
            expect.objectContaining({ ingredient: 'Tomate' }),
            expect.objectContaining({ ingredient: 'Sal' }),
          ],
          steps: [
            expect.objectContaining({ instruction: 'Hervir' }),
            expect.objectContaining({ instruction: 'Servir' }),
          ],
        }),
      }),
    );
  },
);
it('keeps the draft on network failure, then rejects retry on stale confirmation', async () => {
  const save = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockRejectedValueOnce({ code: 'PT409' });
  const user = userEvent.setup();
  await render(
    <RecipeForm families={[family]} onSave={save} onCancel={jest.fn()} />,
  );
  await user.type(
    screen.getByLabelText(i18n.t('recipes.fields.title')),
    'Sopa',
  );
  await user.type(
    screen.getByLabelText(i18n.t('recipes.fields.ingredient', { number: 1 })),
    'Tomate',
  );
  await user.type(
    screen.getByLabelText(i18n.t('recipes.stepNumber', { number: 1 })),
    'Hervir',
  );
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.save') }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    i18n.t('families.errors.save'),
  );
  expect(
    screen.getByLabelText(i18n.t('recipes.fields.title')),
  ).toHaveDisplayValue('Sopa');
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.save') }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    i18n.t('recipes.stale'),
  );
  expect(
    screen.getByRole('button', { name: i18n.t('recipes.save') }),
  ).toBeDisabled();
});
it('requires title, ingredient and step instead of submitting an empty aggregate', async () => {
  const save = jest.fn();
  await render(
    <RecipeForm families={[family]} onSave={save} onCancel={jest.fn()} />,
  );
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: i18n.t('recipes.save') }));
  expect(screen.getByRole('alert')).toHaveTextContent(
    i18n.t('recipes.invalid'),
  );
  expect(save).not.toHaveBeenCalled();
});

async function fillRequired() {
  await fireEvent.changeText(
    screen.getByLabelText(i18n.t('recipes.fields.title')),
    'Sopa',
  );
  await fireEvent.changeText(
    screen.getByLabelText(i18n.t('recipes.fields.ingredient', { number: 1 })),
    'Tomate',
  );
  await fireEvent.changeText(
    screen.getByLabelText(i18n.t('recipes.stepNumber', { number: 1 })),
    'Hervir',
  );
}
const existing: RecipeDetail = {
  recipe: {
    id: 'recipe',
    title: 'Sopa',
    description: 'Familiar',
    origin_location: 'Puebla',
    origin_year: 1970,
    story: 'De mi abuela',
    servings: '4',
    prep_time_minutes: 10,
    cook_time_minutes: 20,
    rest_time_minutes: 5,
    owner_person_id: 'person',
    original_creator_person_id: 'person',
    entered_by_user_id: 'user',
    preservation_status: 'EDITABLE',
    updated_at: 'stamp',
  },
  ingredients: [
    {
      ingredient: 'Sal',
      quantity: 'un puñito',
      unit: null,
      preparation_note: 'al final',
      section_name: 'Caldo',
    },
  ],
  steps: [
    { instruction: 'Hervir', section_name: 'Caldo', duration_minutes: 7 },
  ],
  owner_name: 'Ana',
  owner_deleted: false,
  creator_name: 'Ana',
  creator_deleted: false,
  can_edit: true,
  latest_revision: 1,
  revisions: [],
};
it.each(['es', 'en'])(
  'keeps optional metadata out of the initial editor and retains it after collapsing in %s',
  async (language) => {
    await i18n.changeLanguage(language);
    const save = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    await render(
      <RecipeForm families={[family]} onSave={save} onCancel={jest.fn()} />,
    );
    expect(
      screen.queryByLabelText(i18n.t('recipes.fields.servings')),
    ).toBeNull();
    expect(screen.queryByLabelText(i18n.t('recipes.fields.story'))).toBeNull();
    await fillRequired();
    await user.press(
      screen.getByRole('button', { name: i18n.t('recipes.editor.timing') }),
    );
    await fireEvent.changeText(
      screen.getByLabelText(i18n.t('recipes.fields.servings')),
      '4',
    );
    await fireEvent.changeText(
      screen.getByLabelText(i18n.t('recipes.fields.prep_time_minutes')),
      '15',
    );
    await user.press(
      screen.getByRole('button', { name: i18n.t('recipes.editor.timing') }),
    );
    await user.press(
      screen.getByRole('button', { name: i18n.t('recipes.editor.story') }),
    );
    await fireEvent.changeText(
      screen.getByLabelText(i18n.t('recipes.fields.story')),
      'De mi abuela',
    );
    await user.press(
      screen.getByRole('button', { name: i18n.t('recipes.editor.story') }),
    );
    expect(screen.queryByLabelText(i18n.t('recipes.fields.story'))).toBeNull();
    await user.press(
      screen.getByRole('button', { name: i18n.t('recipes.save') }),
    );
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        shareWithFamily: false,
        content: expect.objectContaining({
          servings: '4',
          prep_time_minutes: 15,
          story: 'De mi abuela',
        }),
      }),
    );
  },
);
it('preserves existing collapsed fields, section names and per-step durations when editing without changing audiences', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  await render(
    <RecipeForm
      initial={existing}
      families={[family]}
      onSave={save}
      onCancel={jest.fn()}
    />,
  );
  expect(screen.queryByLabelText(i18n.t('recipes.fields.story'))).toBeNull();
  expect(screen.queryByRole('switch')).toBeNull();
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: i18n.t('recipes.save') }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      familyId: null,
      shareWithFamily: false,
      content: expect.objectContaining({
        origin_location: 'Puebla',
        origin_year: 1970,
        story: 'De mi abuela',
        prep_time_minutes: 10,
        ingredients: existing.ingredients,
        steps: existing.steps,
      }),
    }),
  );
});
it('moves and removes rows without attaching quantities or notes to a different ingredient', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  await render(
    <RecipeForm families={[family]} onSave={save} onCancel={jest.fn()} />,
  );
  await fillRequired();
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.addIngredient') }),
  );
  await fireEvent.changeText(
    screen.getByLabelText(i18n.t('recipes.fields.ingredient', { number: 2 })),
    'Sal',
  );
  await fireEvent.changeText(
    screen.getByLabelText(i18n.t('recipes.fields.quantity', { number: 2 })),
    'un puñito',
  );
  await user.press(
    screen.getByRole('button', {
      name: i18n.t('recipes.editor.ingredientDetails', { number: 2 }),
    }),
  );
  await fireEvent.changeText(
    screen.getByLabelText(
      i18n.t('recipes.fields.preparation_note', { number: 2 }),
    ),
    'al final',
  );
  await fireEvent.changeText(
    screen.getByLabelText(
      i18n.t('recipes.fields.ingredient_section', { number: 2 }),
    ),
    'Caldo',
  );
  await user.press(
    screen.getByRole('button', {
      name: i18n.t('recipes.moveUp', {
        item: i18n.t('recipes.ingredientNumber', { number: 2 }),
      }),
    }),
  );
  expect(
    screen.getByLabelText(i18n.t('recipes.fields.ingredient', { number: 1 })),
  ).toHaveDisplayValue('Sal');
  await user.press(
    screen.getByRole('button', {
      name: i18n.t('recipes.editor.remove', {
        item: i18n.t('recipes.ingredientNumber', { number: 2 }),
      }),
    }),
  );
  expect(
    screen.getByRole('button', {
      name: i18n.t('recipes.editor.remove', {
        item: i18n.t('recipes.ingredientNumber', { number: 1 }),
      }),
    }),
  ).toBeDisabled();
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.save') }),
  );
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      content: expect.objectContaining({
        ingredients: [
          expect.objectContaining({
            ingredient: 'Sal',
            quantity: 'un puñito',
            preparation_note: 'al final',
            section_name: 'Caldo',
          }),
        ],
      }),
    }),
  );
});
it('reveals invalid timing hidden in a collapsed section so it can be corrected', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  await render(
    <RecipeForm families={[family]} onSave={save} onCancel={jest.fn()} />,
  );
  await fillRequired();
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.editor.timing') }),
  );
  await fireEvent.changeText(
    screen.getByLabelText(i18n.t('recipes.fields.cook_time_minutes')),
    'bad',
  );
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.editor.timing') }),
  );
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.save') }),
  );
  expect(save).not.toHaveBeenCalled();
  expect(
    screen.getByLabelText(i18n.t('recipes.fields.cook_time_minutes')),
  ).toHaveDisplayValue('bad');
  await fireEvent.changeText(
    screen.getByLabelText(i18n.t('recipes.fields.cook_time_minutes')),
    '20',
  );
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.save') }),
  );
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      content: expect.objectContaining({ cook_time_minutes: 20 }),
    }),
  );
});
it('keeps the explicit audited reason requirement for preserved recipes', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  await render(
    <RecipeForm
      initial={{
        ...existing,
        recipe: { ...existing.recipe, preservation_status: 'PRESERVED' },
      }}
      families={[family]}
      onSave={save}
      onCancel={jest.fn()}
    />,
  );
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.save') }),
  );
  expect(save).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText(i18n.t('personAdministration.reason')),
    'Correct a transcription',
  );
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.save') }),
  );
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ overrideReason: 'Correct a transcription' }),
  );
});

it('shares only after an explicit choice and names the selected family', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  await render(
    <RecipeForm
      families={[
        family,
        { ...family, id: 'second', name: 'Sol', role: 'ADMIN' },
      ]}
      onSave={save}
      onCancel={jest.fn()}
    />,
  );
  await fillRequired();
  expect(
    screen.getByText(i18n.t('recipes.editor.privateVisibility')),
  ).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Sol' }));
  await fireEvent(screen.getByRole('switch'), 'valueChange', true);
  expect(
    screen.getByText(
      i18n.t('recipes.editor.familyVisibility', { family: 'Sol' }),
    ),
  ).toBeOnTheScreen();
  await user.press(
    screen.getByRole('button', { name: i18n.t('recipes.save') }),
  );
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ familyId: 'second', shareWithFamily: true }),
  );
});

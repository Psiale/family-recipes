import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';

import type { Family } from '@/features/families/api';
import i18n from '@/i18n';

import { RecipeForm } from './RecipeForm';

const family = { id: 'family', name: 'Luna', role: 'OWNER' } as Family;
it('makes captured section labels reviewable and saves only explicitly accepted edited recipe text', async () => {
  await i18n.changeLanguage('es');
  const save = jest.fn().mockResolvedValue(undefined);
  await render(
    <RecipeForm
      families={[family]}
      onSave={save}
      onCancel={jest.fn()}
      draft={{
        title: 'Sopa',
        description: null,
        story: null,
        origin_location: null,
        origin_year: null,
        servings: null,
        prep_time_minutes: null,
        cook_time_minutes: null,
        rest_time_minutes: null,
        ingredients: [
          {
            ingredient: 'Sal',
            quantity: 'un puñito',
            unit: null,
            preparation_note: null,
            section_name: 'Salsa',
          },
        ],
        steps: [
          {
            instruction: 'Hervir',
            duration_minutes: null,
            section_name: 'Salsa',
          },
        ],
      }}
    />,
  );
  expect(save).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText(
      i18n.t('recipes.fields.ingredient_section', { number: 1 }),
    ),
    'Caldo',
  );
  await fireEvent.changeText(
    screen.getByLabelText(i18n.t('recipes.fields.step_section', { number: 1 })),
    'Caldo',
  );
  await userEvent
    .setup()
    .press(screen.getByRole('button', { name: i18n.t('recipes.save') }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      shareWithFamily: false,
      content: expect.objectContaining({
        ingredients: [
          expect.objectContaining({
            section_name: 'Caldo',
            quantity: 'un puñito',
          }),
        ],
        steps: [
          expect.objectContaining({
            section_name: 'Caldo',
            instruction: 'Hervir',
          }),
        ],
      }),
    }),
  );
  expect(save.mock.calls[0]?.[0].content).not.toHaveProperty('source_text');
});
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

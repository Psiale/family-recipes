import { render, screen, userEvent } from '@testing-library/react-native';

import type { Family } from '@/features/families/api';
import i18n from '@/i18n';

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

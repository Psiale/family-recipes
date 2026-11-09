import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import i18n from '@/i18n';

import { RecipeUnitField } from './RecipeUnitField';

function Field({ initial = '', disabled = false }) {
  const [value, setValue] = useState(initial);
  return (
    <RecipeUnitField
      value={value}
      onChange={setValue}
      number={1}
      disabled={disabled}
    />
  );
}
it.each(['es', 'en'])(
  'shows, searches and selects units in %s',
  async (language) => {
    await i18n.changeLanguage(language);
    await render(<Field />);
    await fireEvent.press(
      screen.getByRole('button', {
        name: i18n.t('recipes.units.show', { number: 1 }),
      }),
    );
    expect(
      screen.getByRole('button', { name: i18n.t('recipes.units.options.cup') }),
    ).toBeOnTheScreen();
    const input = screen.getByLabelText(
      i18n.t('recipes.fields.unit', { number: 1 }),
    );
    await fireEvent.changeText(input, 'cucharad');
    expect(
      screen.queryByRole('button', {
        name: i18n.t('recipes.units.options.cup'),
      }),
    ).toBeNull();
    await fireEvent.press(
      screen.getByRole('button', {
        name: i18n.t('recipes.units.options.tablespoon'),
      }),
    );
    expect(input).toHaveDisplayValue(
      i18n.t('recipes.units.options.tablespoon'),
    );
    expect(
      screen.getByRole('button', {
        name: i18n.t('recipes.units.show', { number: 1 }),
      }),
    ).toBeOnTheScreen();
  },
);

it('keeps a custom unit editable and selectable, including values loaded from older recipes', async () => {
  await i18n.changeLanguage('es');
  await render(<Field initial="vasitos de mi abuela" />);
  const input = screen.getByLabelText(
    i18n.t('recipes.fields.unit', { number: 1 }),
  );
  expect(input).toHaveDisplayValue('vasitos de mi abuela');
  await fireEvent.changeText(input, '  puñitos  ');
  await fireEvent.press(screen.getByRole('button', { name: 'Usar «puñitos»' }));
  expect(input).toHaveDisplayValue('puñitos');
});

it('disables typing and opening while a recipe is saving', async () => {
  await i18n.changeLanguage('es');
  await render(<Field disabled />);
  expect(
    screen.getByLabelText(i18n.t('recipes.fields.unit', { number: 1 })),
  ).toHaveProp('editable', false);
  expect(
    screen.getByRole('button', {
      name: i18n.t('recipes.units.show', { number: 1 }),
    }),
  ).toBeDisabled();
});

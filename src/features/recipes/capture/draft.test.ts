import {
  captureResultSchema,
  normalizeRecipeDraft,
  type CaptureResult,
} from './draft';

const result: CaptureResult = {
  recipe: {
    title: '  Mole de la abuela  ',
    description: null,
    origin_location: null,
    origin_year: null,
    story: null,
    servings: 'alcanza para 4 o 5',
    prep_time_minutes: null,
    cook_time_minutes: null,
    rest_time_minutes: null,
    ingredients: [
      {
        ingredient: '  Chile  ',
        quantity: 'un puñito',
        unit: null,
        preparation_note: 'al gusto',
        section_name: null,
      },
    ],
    steps: [
      {
        instruction: 'Cocer hasta que esté listo.',
        section_name: null,
        duration_minutes: null,
      },
    ],
  },
  source_text: 'Un puñito de chile, al gusto. Cocer hasta que esté listo.',
  issues: [
    {
      field: 'cook_time_minutes',
      kind: 'missing',
      note: 'La fuente no indica un tiempo concreto.',
      evidence: 'hasta que esté listo',
    },
  ],
};
it('keeps source quantities and uncertain missing values without inventing numeric conversions', () => {
  const draft = normalizeRecipeDraft(captureResultSchema.parse(result));
  expect(draft.title).toBe('Mole de la abuela');
  expect(draft.ingredients[0]?.quantity).toBe('un puñito');
  expect(draft.ingredients[0]?.unit).toBeNull();
  expect(draft.cook_time_minutes).toBeNull();
  expect(draft.servings).toBe('alcanza para 4 o 5');
  expect('owner_person_id' in draft).toBe(false);
});
it('allows an incomplete extraction draft while rejecting ownership or privilege fields', () => {
  const incomplete = {
    ...result,
    recipe: { ...result.recipe, title: null, ingredients: [], steps: [] },
  };
  expect(
    normalizeRecipeDraft(captureResultSchema.parse(incomplete)),
  ).toMatchObject({ title: '', ingredients: [], steps: [] });
  expect(
    captureResultSchema.safeParse({
      ...result,
      recipe: { ...result.recipe, owner_person_id: 'other-person' },
    }).success,
  ).toBe(false);
});
it('rejects malformed or excessively large draft output instead of passing it into the form', () => {
  expect(
    captureResultSchema.safeParse({
      ...result,
      recipe: { ...result.recipe, prep_time_minutes: -1 },
    }).success,
  ).toBe(false);
  expect(
    captureResultSchema.safeParse({ ...result, source_text: 'x'.repeat(10001) })
      .success,
  ).toBe(false);
});

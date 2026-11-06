import { normalizeRecipeDraft } from './draft';
import {
  CaptureError,
  MAX_SOURCE_CHARS,
  organizePhotoText,
  validateLocalSource,
} from './pipeline';

it('maps a Spanish recipe without converting vague quantities or guessing times', () => {
  const source =
    'Sopa de papa\nIngredientes:\n2 papas\nun puñito de sal\n1 litro de agua\nPreparación:\n1. Hervir las papas\nen el agua hasta que estén listas.\n2. Agregar la sal y servir.';
  const result = organizePhotoText(source);
  expect(result.recipe.title).toBe('Sopa de papa');
  expect(result.recipe.ingredients).toEqual([
    expect.objectContaining({ ingredient: 'papas', quantity: '2', unit: null }),
    expect.objectContaining({
      ingredient: 'sal',
      quantity: 'un puñito',
      unit: null,
    }),
    expect.objectContaining({
      ingredient: 'agua',
      quantity: '1',
      unit: 'litro',
    }),
  ]);
  expect(result.recipe.steps[0]?.instruction).toBe(
    'Hervir las papas\nen el agua hasta que estén listas.',
  );
  expect(result.recipe.cook_time_minutes).toBeNull();
  expect(result.source_text).toBe(source);
  expect(normalizeRecipeDraft(result).capture_source_text).toBe(source);
});
it('recognizes English headings, fractions and ingredient/step section labels', () => {
  const result = organizePhotoText(
    "Grandma's soup\nIngredients\nSauce:\n½ cup milk\n1/2 tsp salt\nDirections\nSauce:\nMix well.",
  );
  expect(result.recipe.ingredients[0]).toMatchObject({
    ingredient: 'milk',
    quantity: '½',
    unit: 'cup',
    section_name: 'Sauce',
  });
  expect(result.recipe.ingredients[1]?.quantity).toBe('1/2');
  expect(result.recipe.steps[0]).toMatchObject({
    instruction: 'Mix well.',
    section_name: 'Sauce',
  });
});
it('retains unmapped source for manual review instead of inventing ingredients or a story', () => {
  const source = 'Receta antigua\nPorciones: 4\nCocer hasta que esté listo.';
  const result = organizePhotoText(source);
  expect(result.recipe.ingredients).toEqual([]);
  expect(result.recipe.steps).toEqual([]);
  expect(result.recipe.story).toBeNull();
  expect(result.recipe.servings).toBeNull();
  expect(result.issues.length).toBeGreaterThan(0);
  expect(normalizeRecipeDraft(result).capture_source_text).toBe(source);
});
it('does not discard long ingredient lines or overflowing lists without a review warning', () => {
  const source =
    'Sopa\nIngredientes\n' + 'x'.repeat(241) + '\nPreparación\nHervir.';
  const result = organizePhotoText(source);
  expect(result.recipe.ingredients).toEqual([]);
  expect(result.issues.some((issue) => issue.field === 'ingredients')).toBe(
    true,
  );
  expect(result.source_text).toBe(source);
});
it('rejects remote/file-provider URIs, empty/oversized photos and excessive source text', () => {
  expect(() =>
    validateLocalSource('https://example.com/photo.jpg', 100),
  ).toThrow(CaptureError);
  expect(() => validateLocalSource('content://media/1', 100)).toThrow(
    CaptureError,
  );
  expect(() =>
    validateLocalSource('file:///cache/photo.jpg', 31 * 1024 * 1024),
  ).toThrow(CaptureError);
  expect(() => validateLocalSource('file:///cache/photo.jpg', 0)).toThrow(
    CaptureError,
  );
  expect(() => organizePhotoText('x'.repeat(MAX_SOURCE_CHARS + 1))).toThrow(
    CaptureError,
  );
  expect(() => organizePhotoText(' ')).toThrow(CaptureError);
});

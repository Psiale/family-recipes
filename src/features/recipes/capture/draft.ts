import { z } from 'zod';

import type { RecipeContent } from '../api';

// Extraction is allowed to be incomplete. Validation for saving a finished
// recipe remains in contentSchema and the transactional recipe RPC.
const optionalText = (limit: number) => z.string().max(limit).nullable();
const optionalMinutes = z.number().int().min(0).max(999999).nullable();
export const extractedRecipeSchema = z
  .object({
    title: optionalText(160),
    description: optionalText(2000),
    origin_location: optionalText(120),
    origin_year: optionalMinutes,
    story: optionalText(10000),
    servings: optionalText(120),
    prep_time_minutes: optionalMinutes,
    cook_time_minutes: optionalMinutes,
    rest_time_minutes: optionalMinutes,
    ingredients: z
      .array(
        z
          .object({
            ingredient: optionalText(240),
            quantity: optionalText(240),
            unit: optionalText(240),
            preparation_note: optionalText(240),
            section_name: optionalText(240),
          })
          .strict(),
      )
      .max(100),
    steps: z
      .array(
        z
          .object({
            instruction: optionalText(4000),
            section_name: optionalText(240),
            duration_minutes: optionalMinutes,
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export const captureResultSchema = z
  .object({
    recipe: extractedRecipeSchema,
    source_text: z.string().max(10000),
    issues: z
      .array(
        z
          .object({
            field: z.string().max(160),
            kind: z.enum(['missing', 'unclear', 'conflict']),
            note: z.string().max(500),
            evidence: z.string().max(1000).nullable(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export type CaptureResult = z.infer<typeof captureResultSchema>;
export type RecipeDraft = Omit<RecipeContent, 'change_summary'> & {
  capture_source_text?: string;
};
const clean = (value: string | null) =>
  value === null ? null : value.trim() || null;
export function normalizeRecipeDraft(result: CaptureResult): RecipeDraft {
  const recipe = result.recipe;
  return {
    capture_source_text: result.source_text,
    title: clean(recipe.title) ?? '',
    description: clean(recipe.description),
    origin_location: clean(recipe.origin_location),
    origin_year: recipe.origin_year,
    story: clean(recipe.story),
    servings: clean(recipe.servings),
    prep_time_minutes: recipe.prep_time_minutes,
    cook_time_minutes: recipe.cook_time_minutes,
    rest_time_minutes: recipe.rest_time_minutes,
    ingredients: recipe.ingredients.map((item) => ({
      ingredient: clean(item.ingredient) ?? '',
      quantity: clean(item.quantity),
      unit: clean(item.unit),
      preparation_note: clean(item.preparation_note),
      section_name: clean(item.section_name),
    })),
    steps: recipe.steps.map((item) => ({
      instruction: clean(item.instruction) ?? '',
      section_name: clean(item.section_name),
      duration_minutes: item.duration_minutes,
    })),
  };
}

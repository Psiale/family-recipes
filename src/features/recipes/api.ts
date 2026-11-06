import { z } from 'zod';

import { getSupabaseClient } from '@/lib/supabase/client';

const text = z.string().nullable();
const minutes = z.number().int().nonnegative().nullable();
export const ingredientSchema = z.object({
  ingredient: z.string().trim().min(1).max(240),
  quantity: text,
  unit: text,
  preparation_note: text,
  section_name: text,
});
export const stepSchema = z.object({
  instruction: z.string().trim().min(1).max(4000),
  section_name: text,
  duration_minutes: minutes,
});
export const contentSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: text,
  origin_location: text,
  origin_year: minutes,
  story: text,
  servings: text,
  prep_time_minutes: minutes,
  cook_time_minutes: minutes,
  rest_time_minutes: minutes,
  ingredients: z.array(ingredientSchema).min(1).max(100),
  steps: z.array(stepSchema).min(1).max(100),
  change_summary: text,
});
export type RecipeContent = z.infer<typeof contentSchema>;
const recipeSchema = contentSchema
  .omit({ ingredients: true, steps: true, change_summary: true })
  .extend({
    id: z.string(),
    owner_person_id: z.string(),
    original_creator_person_id: z.string(),
    entered_by_user_id: z.string(),
    preservation_status: z.enum(['EDITABLE', 'PRESERVED']),
    updated_at: z.string(),
  });
const snapshotSchema = z.object({
  recipe: recipeSchema,
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema),
});
const detailSchema = snapshotSchema.extend({
  owner_name: z.string(),
  owner_deleted: z.boolean(),
  creator_name: z.string(),
  creator_deleted: z.boolean(),
  can_edit: z.boolean(),
  latest_revision: z.number(),
  revisions: z.array(
    z.object({
      revision_number: z.number(),
      change_summary: text,
      created_at: z.string(),
    }),
  ),
});
export type RecipeDetail = z.infer<typeof detailSchema>;
const cardsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    description: text,
    preservation_status: z.enum(['EDITABLE', 'PRESERVED']),
    updated_at: z.string(),
    owner_name: z.string(),
    owner_deleted: z.boolean(),
  }),
);
export async function listRecipes(search: string, page: number) {
  const { data, error } = await getSupabaseClient().rpc('list_recipe_cards', {
    p_search: search,
    p_offset: page * 25,
  });
  if (error) throw error;
  const rows = cardsSchema.parse(data);
  return { recipes: rows.slice(0, 25), more: rows.length > 25 };
}
export async function getRecipe(id: string) {
  const { data, error } = await getSupabaseClient().rpc('get_recipe_detail', {
    p_recipe_id: id,
  });
  if (error) throw error;
  return detailSchema.parse(data);
}
export async function getRevision(recipeId: string, revision: number) {
  const { data, error } = await getSupabaseClient()
    .from('recipe_revisions')
    .select('snapshot')
    .eq('recipe_id', recipeId)
    .eq('revision_number', revision)
    .single();
  if (error) throw error;
  return snapshotSchema.parse(data.snapshot);
}
export async function saveRecipe(values: {
  id: string | null;
  expectedRevision: number;
  familyId: string | null;
  shareWithFamily: boolean;
  content: RecipeContent;
  overrideReason: string;
}) {
  const { data, error } = await getSupabaseClient().rpc('save_recipe', {
    ...(values.id === null ? {} : { p_recipe_id: values.id }),
    p_expected_revision: values.expectedRevision,
    ...(values.familyId === null ? {} : { p_family_id: values.familyId }),
    p_share_with_family: values.shareWithFamily,
    p_content: values.content,
    ...(values.overrideReason.trim()
      ? { p_override_reason: values.overrideReason.trim() }
      : {}),
  });
  if (error) throw error;
  return data;
}

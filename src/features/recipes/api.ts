import { z } from 'zod';

import { getSupabaseClient } from '@/lib/supabase/client';

import { recipeRequest } from './request';

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
  ingredients: z.array(ingredientSchema).max(100),
  steps: z.array(stepSchema).max(100),
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
export const mediaSchema = z.object({
  id: z.string(),
  kind: z.enum(['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT']),
  storage_path: z.string(),
  caption: text,
  alt_text: text,
  upload_id: z.string().nullable().optional(),
  file_name: text.optional(),
  content_type: text.optional(),
  byte_size: z.number().nullable().optional(),
});
export type RecipeMedia = z.infer<typeof mediaSchema>;
export const audienceSchema = z.object({
  family_id: z.string(),
  branch_id: z.string().nullable(),
});
export type RecipeAudience = z.infer<typeof audienceSchema>;
export const optionsSchema = z.object({
  people: z.array(
    z.object({ id: z.string(), display_name: z.string(), own: z.boolean() }),
  ),
  families: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      can_write: z.boolean(),
      can_manage: z.boolean(),
      branches: z.array(z.object({ id: z.string(), name: z.string() })),
    }),
  ),
});
export type RecipeOptions = z.infer<typeof optionsSchema>;
export function validateRecipeContent(value: unknown, recording: boolean) {
  return contentSchema
    .superRefine((v, ctx) => {
      if (!recording && (!v.ingredients.length || !v.steps.length))
        ctx.addIssue({
          code: 'custom',
          message: 'Written ingredients and steps required',
          path: ['steps'],
        });
    })
    .safeParse(value);
}
const snapshotSchema = z.object({
  recipe: recipeSchema,
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema),
  media: z.array(mediaSchema).default([]),
  visibilities: z.array(audienceSchema).default([]),
});
const detailSchema = snapshotSchema.extend({
  owner_name: z.string(),
  owner_deleted: z.boolean(),
  creator_name: z.string(),
  creator_deleted: z.boolean(),
  can_edit: z.boolean(),
  can_preserve: z.boolean().default(false),
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
  const { data, error } = await recipeRequest((signal) =>
    getSupabaseClient()
      .rpc('list_recipe_cards', {
        p_search: search,
        p_offset: page * 25,
      })
      .abortSignal(signal),
  );
  if (error) throw error;
  const rows = cardsSchema.parse(data);
  return { recipes: rows.slice(0, 25), more: rows.length > 25 };
}
export async function getRecipe(id: string) {
  const { data, error } = await recipeRequest((signal) =>
    getSupabaseClient()
      .rpc('get_recipe_detail', {
        p_recipe_id: id,
      })
      .abortSignal(signal),
  );
  if (error) throw error;
  return detailSchema.parse(data);
}
export async function getRevision(recipeId: string, revision: number) {
  const { data, error } = await recipeRequest((signal) =>
    getSupabaseClient()
      .from('recipe_revisions')
      .select('snapshot')
      .eq('recipe_id', recipeId)
      .eq('revision_number', revision)
      .abortSignal(signal)
      .single(),
  );
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
  ownerPersonId?: string | null;
  media?: Pick<RecipeMedia, 'id' | 'caption' | 'alt_text'>[];
  audiences?: RecipeAudience[];
}) {
  const { data, error } = await recipeRequest(
    (signal) =>
      getSupabaseClient()
        .rpc('save_recipe_v2', {
          ...(values.id === null ? {} : { p_recipe_id: values.id }),
          p_expected_revision: values.expectedRevision,
          ...(values.familyId === null ? {} : { p_family_id: values.familyId }),
          ...(values.ownerPersonId
            ? { p_owner_person_id: values.ownerPersonId }
            : {}),
          ...(values.media ? { p_media: values.media } : {}),
          ...(values.audiences
            ? { p_audiences: values.audiences }
            : values.id === null && values.shareWithFamily && values.familyId
              ? {
                  p_audiences: [
                    { family_id: values.familyId, branch_id: null },
                  ],
                }
              : {}),
          p_content: values.content,
          ...(values.overrideReason.trim()
            ? { p_override_reason: values.overrideReason.trim() }
            : {}),
        })
        .abortSignal(signal),
    true,
  );
  if (error) throw error;
  return z.string().parse(data);
}

export async function recipeOptions() {
  const { data, error } = await recipeRequest((signal) =>
    getSupabaseClient().rpc('recipe_options').abortSignal(signal),
  );
  if (error) throw error;
  return optionsSchema.parse(data);
}
export async function setPreservation(
  id: string,
  expectedRevision: number,
  preserved: boolean,
  reason: string,
) {
  const { error } = await recipeRequest(
    (signal) =>
      getSupabaseClient()
        .rpc('set_recipe_preservation', {
          p_recipe_id: id,
          p_expected_revision: expectedRevision,
          p_preserved: preserved,
          p_reason: reason,
        })
        .abortSignal(signal),
    true,
  );
  if (error) throw error;
}
export async function listCollections(familyId: string) {
  const { data, error } = await recipeRequest((signal) =>
    getSupabaseClient()
      .from('collections')
      .select('*')
      .eq('family_id', familyId)
      .order('localization_key')
      .order('custom_name')
      .abortSignal(signal),
  );
  if (error) throw error;
  return data;
}
export type Collection = Awaited<ReturnType<typeof listCollections>>[number];
export async function collectionRecipes(id: string) {
  const { data, error } = await recipeRequest((signal) =>
    getSupabaseClient()
      .from('recipe_collections')
      .select('recipe:recipes!inner(id,title)')
      .eq('collection_id', id)
      .order('created_at')
      .abortSignal(signal),
  );
  if (error) throw error;
  return data.map((v) => v.recipe);
}
export async function saveCollection(
  familyId: string,
  name: string,
  description: string,
  initial?: Collection,
  remove = false,
) {
  const { data, error } = await recipeRequest(
    (signal) =>
      getSupabaseClient()
        .rpc('save_collection', {
          p_family_id: familyId,
          p_name: name,
          p_description: description,
          ...(initial
            ? {
                p_collection_id: initial.id,
                p_expected_updated_at: initial.updated_at,
              }
            : {}),
          p_delete: remove,
        })
        .abortSignal(signal),
    true,
  );
  if (error) throw error;
  return data;
}
export async function setCollectionRecipe(
  collection: Collection,
  recipeId: string,
  add: boolean,
) {
  const { error } = await recipeRequest(
    (signal) =>
      getSupabaseClient()
        .rpc('set_collection_recipe', {
          p_collection_id: collection.id,
          p_recipe_id: recipeId,
          p_add: add,
          p_expected_updated_at: collection.updated_at,
        })
        .abortSignal(signal),
    true,
  );
  if (error) throw error;
}
export async function familyRecipes(familyId: string, page: number) {
  const { data, error } = await recipeRequest((signal) =>
    getSupabaseClient()
      .from('recipe_visibilities')
      .select('recipe_id,recipe:recipes!inner(id,title)')
      .eq('family_id', familyId)
      .order('recipe_id')
      .range(page * 25, page * 25 + 25)
      .abortSignal(signal),
  );
  if (error) throw error;
  return {
    recipes: [
      ...new Map(
        data.slice(0, 25).map((v) => [v.recipe.id, v.recipe]),
      ).values(),
    ],
    more: data.length > 25,
  };
}

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { z } from 'zod';

import { getPublicEnv } from '@/config/env';
import { getSupabaseClient } from '@/lib/supabase/client';

import type { RecipeMedia } from './api';
import { recipeRequest } from './request';

export const MAX_ATTACHMENTS = 8;
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const manifest = z.object({
  id: z.string(),
  kind: z.enum(['IMAGE', 'AUDIO', 'VIDEO']),
  storage_path: z.string(),
  file_name: z.string(),
  content_type: z.string(),
  byte_size: z.number(),
});
export const allowedTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];
export type PickedMedia = {
  uri: string;
  name: string;
  mimeType?: string | undefined;
  size?: number | undefined;
  file?: Blob | undefined;
};
export async function pickMedia(photo: boolean): Promise<PickedMedia | null> {
  if (photo) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: false,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) return null;
    return {
      uri: asset.uri,
      name: asset.fileName ?? 'recipe.jpg',
      mimeType: asset.mimeType,
      size: asset.fileSize,
      file: asset.file,
    };
  }
  const result = await DocumentPicker.getDocumentAsync({
    type: ['audio/*', 'video/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  return result.canceled ? null : (result.assets[0] ?? null);
}
export function validateMediaFile(type: string, size: number) {
  if (
    !allowedTypes.includes(type) ||
    size <= 0 ||
    size > (type.startsWith('image/') ? 10 : 50) * 1024 * 1024
  )
    throw new Error('Unsupported media type or size');
}
export async function uploadMedia(
  asset: PickedMedia,
  recipeId: string | null,
): Promise<RecipeMedia> {
  const file = Platform.OS === 'web' ? asset.file : new File(asset.uri);
  if (!file) throw new Error('File unavailable');
  const type = asset.mimeType ?? '';
  const size = asset.size ?? file.size;
  let staged: z.infer<typeof manifest> | undefined;
  try {
    validateMediaFile(type, size);
    const { data, error } = await recipeRequest((signal) =>
      getSupabaseClient()
        .rpc('begin_recipe_upload', {
          p_file_name: asset.name,
          p_content_type: type,
          p_byte_size: size,
          ...(recipeId ? { p_recipe_id: recipeId } : {}),
        })
        .abortSignal(signal),
    );
    if (error) throw error;
    staged = manifest.parse(data);
    const path = staged.storage_path;
    await recipeRequest(
      async (signal) => {
        const { data: auth, error: authError } =
          await getSupabaseClient().auth.getSession();
        if (authError || !auth.session)
          throw new Error('Authentication required');
        const body = await file.arrayBuffer();
        const env = getPublicEnv();
        const response = await fetch(
          `${env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/recipe-media/${path}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${auth.session.access_token}`,
              apikey: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
              'Content-Type': type,
              'cache-control': 'no-store',
              'x-upsert': 'false',
            },
            body,
            signal,
          },
        );
        if (!response.ok) throw new Error('Attachment upload failed');
      },
      false,
      120_000,
    );
    return { ...staged, upload_id: staged.id, caption: '', alt_text: '' };
  } catch (error) {
    if (staged) await discardStagedMedia(staged).catch(() => {});
    throw error;
  } finally {
    if (Platform.OS !== 'web' && asset.uri.startsWith(Paths.cache.uri)) {
      try {
        new File(asset.uri).delete();
      } catch {
        /* OS may already have removed the picker copy. */
      }
    }
  }
}
// Attached bytes are sealed for history. Storage RLS refuses their deletion.
export async function discardStagedMedia(
  media: Pick<RecipeMedia, 'id' | 'storage_path'>,
) {
  const client = getSupabaseClient();
  await recipeRequest(async () => {
    const { error } = await client.storage
      .from('recipe-media')
      .remove([media.storage_path]);
    if (error) throw error;
  });
  const { error } = await recipeRequest((signal) =>
    client
      .rpc('cancel_recipe_upload', { p_upload_id: media.id })
      .abortSignal(signal),
  );
  if (error) throw error;
}
export type AuthorizedMediaSource = {
  uri: string;
  headers?: Record<string, string>;
};
export async function authorizedMediaSource(
  path: string,
  parentSignal?: AbortSignal,
): Promise<AuthorizedMediaSource> {
  return recipeRequest(
    async (signal) => {
      const { data, error } = await getSupabaseClient().auth.getSession();
      if (error || !data.session) throw new Error('Authentication required');
      const env = getPublicEnv();
      const uri = `${env.EXPO_PUBLIC_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/recipe-media/${path}`;
      const headers = {
        Authorization: `Bearer ${data.session.access_token}`,
        apikey: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      };
      if (Platform.OS !== 'web') return { uri, headers };
      // Browser media elements cannot attach Authorization headers. Download an
      // authenticated Blob and release its local URL when the viewer closes.
      const controller = new AbortController();
      const abort = () => controller.abort();
      const signals = [signal, ...(parentSignal ? [parentSignal] : [])];
      for (const s of signals) {
        if (s.aborted) controller.abort();
        else s.addEventListener('abort', abort, { once: true });
      }
      try {
        const response = await fetch(uri, {
          headers,
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Media access denied');
        const blob = await response.blob();
        if (
          blob.size < 1 ||
          blob.size > 50 * 1024 * 1024 ||
          controller.signal.aborted
        )
          throw new Error('Media unavailable');
        const localUri = URL.createObjectURL(blob);
        parentSignal?.addEventListener(
          'abort',
          () => URL.revokeObjectURL(localUri),
          { once: true },
        );
        return { uri: localUri };
      } finally {
        for (const s of signals) s.removeEventListener('abort', abort);
      }
    },
    false,
    Platform.OS === 'web' ? 120_000 : 20_000,
  );
}

// An expired stage cannot be attached. Cleanup is bounded and only sees the
// authenticated uploader's unattached rows through RLS.
export async function cleanupExpiredUploads() {
  const { data, error } = await recipeRequest((signal) =>
    getSupabaseClient()
      .from('recipe_uploads')
      .select('id,storage_path')
      .is('recipe_id', null)
      .lt('expires_at', 'now')
      .limit(24)
      .abortSignal(signal),
  );
  if (error) throw error;
  for (const row of data) await discardStagedMedia(row);
}

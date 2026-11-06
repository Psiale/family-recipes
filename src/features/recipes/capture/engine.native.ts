import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import reader from '../../../../modules/recipe-photo';

import {
  CaptureError,
  checkCancelled,
  organizePhotoText,
  validateCacheCopyUri,
  validateLocalSource,
  type CaptureOptions,
  type PhotoReadResult,
} from './pipeline';

let activeUri: string | null = null;
let preparation: Promise<void> | null = null;
async function prepare(signal: AbortSignal) {
  checkCancelled(signal);
  preparation ??= reader.prepareAsync().finally(() => {
    preparation = null;
  });
  const current = preparation;
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(new CaptureError('cancelled'));
    };
    signal.addEventListener('abort', abort);
    current.then(
      () => {
        signal.removeEventListener('abort', abort);
        resolve();
      },
      (failure: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(new CaptureError('reader', failure));
      },
    );
    if (signal.aborted) abort();
  });
}
export async function readSourceFile(
  uri: string,
  mimeType: string,
  options: CaptureOptions,
): Promise<PhotoReadResult> {
  if (activeUri) throw new CaptureError('busy');
  validateCacheCopyUri(uri, Paths.cache.uri);
  const file = new File(uri);
  activeUri = uri;
  let context: ReturnType<typeof ImageManipulator.manipulate> | undefined;
  let image:
    Awaited<ReturnType<NonNullable<typeof context>['renderAsync']>> | undefined;
  let previewUri: string | undefined;
  let retained = false;
  try {
    validateLocalSource(uri, file.size);
    if (
      !['image/jpeg', 'image/png', 'image/heic', 'image/heif'].includes(
        mimeType,
      )
    )
      throw new CaptureError('unsupported');
    checkCancelled(options.signal);
    options.onProgress('prepare');
    await prepare(options.signal);
    checkCancelled(options.signal);
    options.onProgress('read');
    context = ImageManipulator.manipulate(uri, {
      maxWidth: 2000,
      maxHeight: 2000,
    });
    image = await context.renderAsync();
    const saved = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.95,
    });
    previewUri = saved.uri;
    checkCancelled(options.signal);
    const text = await reader.recognizeAsync(saved.uri, options.language);
    checkCancelled(options.signal);
    if (!text.trim()) throw new CaptureError('empty');
    retained = true;
    return {
      text,
      previewUri: saved.uri,
      dispose: () => {
        const preview = new File(saved.uri);
        if (preview.exists) preview.delete();
      },
    };
  } finally {
    // Attempt every cleanup even if one release fails; always release the lease.
    let cleanupError: unknown;
    for (const clean of [
      () => image?.release(),
      () => context?.release(),
      () => {
        if (file.exists) file.delete();
      },
      () => {
        if (previewUri && !retained) {
          const preview = new File(previewUri);
          if (preview.exists) preview.delete();
        }
      },
    ]) {
      try {
        clean();
      } catch (failure) {
        cleanupError ??= failure;
      }
    }
    activeUri = null;
    if (cleanupError) {
      // A rejected read has no UI owner to dispose the retained preview.
      if (previewUri && retained) {
        const preview = new File(previewUri);
        if (preview.exists) preview.delete();
      }
      throw cleanupError;
    }
  }
}
export async function chooseAndRead(
  options: CaptureOptions,
): Promise<PhotoReadResult | null> {
  if (activeUri) throw new CaptureError('busy');
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/jpeg', 'image/png', 'image/heic', 'image/heif'],
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const photo = result.assets[0]!;
  try {
    return await readSourceFile(photo.uri, photo.mimeType ?? '', options);
  } catch (failure) {
    // Release a new picker copy if a previous screen acquired the lease first.
    if (activeUri !== photo.uri) {
      try {
        validateCacheCopyUri(photo.uri, Paths.cache.uri);
        const copy = new File(photo.uri);
        if (copy.exists) copy.delete();
      } catch {
        /* Keep URIs outside the owned cache untouched. */
      }
    }
    throw failure;
  }
}
export async function organizeSource(source: string, options: CaptureOptions) {
  checkCancelled(options.signal);
  options.onProgress('organize');
  return organizePhotoText(source);
}

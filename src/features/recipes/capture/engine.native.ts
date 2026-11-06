import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createVideoPlayer, type VideoThumbnail } from 'expo-video';
import { decode } from 'jpeg-js';
import { decodeAudioData, getAudioDuration } from 'react-native-audio-api';
import {
  createLLMChatSession,
  createPaddleOcr,
  createWhisperSpeechToText,
  download,
  models,
  setTelemetryEnabled,
  type PaddleOcr,
} from 'react-native-executorch';

import type { CaptureResult } from './draft';
import {
  CaptureError,
  checkCancelled,
  extractionPrompt,
  parseExtraction,
  validateDuration,
  validateLocalSource,
  type CaptureOptions,
} from './pipeline';

setTelemetryEnabled(false);
export const captureSupported = true;
let working = false;
async function exclusive<T>(work: () => Promise<T>): Promise<T> {
  if (working) throw new CaptureError('busy');
  working = true;
  try {
    return await work();
  } finally {
    working = false;
  }
}
// Only fixed public model URLs reach download(). Media URIs never reach it.
const configs = {
  ocr: models.ocr.PADDLE.PPOCRV6_SMALL.XNNPACK,
  speech: models.speechToText.WHISPER.TINY.XNNPACK_INT8,
  text: models.llm.LFM2_5_1_2B.XNNPACK_8DA4W,
};
async function model<T>(config: T, options: CaptureOptions): Promise<T> {
  checkCancelled(options.signal);
  options.onProgress('download', 0);
  const local = await download(config, {
    signal: options.signal,
    onProgress: (progress) => options.onProgress('download', progress),
  });
  checkCancelled(options.signal);
  return local;
}
function remove(uri: string) {
  const file = new File(uri);
  if (file.exists) file.delete();
}
async function readImage(
  source: string | VideoThumbnail,
  ocr: PaddleOcr,
  options: CaptureOptions,
) {
  checkCancelled(options.signal);
  const context = ImageManipulator.manipulate(source, {
    maxWidth: 1600,
    maxHeight: 1600,
  });
  let image: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  let uri: string | undefined;
  try {
    image = await context.renderAsync();
    const saved = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.95,
    });
    uri = saved.uri;
    const pixels = decode(await new File(uri).bytes(), {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: 4,
      maxMemoryUsageInMB: 64,
    });
    checkCancelled(options.signal);
    const detections = await ocr.recognizeCharacters({
      data: pixels.data,
      width: pixels.width,
      height: pixels.height,
      format: 'rgba',
      layout: 'hwc',
    });
    checkCancelled(options.signal);
    return detections.map((d) => d.text).join('\n');
  } finally {
    if (uri) remove(uri);
    image?.release();
    context.release();
  }
}
async function speech(uri: string, options: CaptureOptions): Promise<string> {
  validateDuration(await getAudioDuration(uri));
  const config = await model(configs.speech, options);
  options.onProgress('read');
  const task = await createWhisperSpeechToText(config);
  const stop = () => task.transcribeStop();
  options.signal.addEventListener('abort', stop);
  try {
    checkCancelled(options.signal);
    const audio = await decodeAudioData(uri, 16000);
    validateDuration(audio.duration);
    const mono = new Float32Array(audio.length);
    for (let channel = 0; channel < audio.numberOfChannels; channel++) {
      const samples = audio.getChannelData(channel);
      for (let i = 0; i < mono.length; i++)
        mono[i] = mono[i]! + samples[i]! / audio.numberOfChannels;
    }
    checkCancelled(options.signal);
    const text = await task.transcribe(mono, { language: options.language });
    checkCancelled(options.signal);
    return text;
  } finally {
    options.signal.removeEventListener('abort', stop);
    task.dispose();
  }
}
async function video(uri: string, options: CaptureOptions): Promise<string> {
  const player = createVideoPlayer(null);
  player.muted = true;
  let thumbnails: VideoThumbnail[] = [];
  try {
    // Android replaceAsync resolves after prepare(), before metadata is ready.
    const duration = await new Promise<number>((resolve, reject) => {
      const loaded = player.addListener('sourceLoad', ({ duration: seconds }) =>
        finish(undefined, seconds),
      );
      const status = player.addListener(
        'statusChange',
        ({ status: next, error }) => {
          if (next === 'error')
            finish(error ?? new CaptureError('unsupported'));
        },
      );
      const timer = setTimeout(
        () => finish(new CaptureError('duration')),
        15000,
      );
      const abort = () => finish(new CaptureError('cancelled'));
      function finish(error?: unknown, seconds?: number) {
        loaded.remove();
        status.remove();
        clearTimeout(timer);
        options.signal.removeEventListener('abort', abort);
        if (error) reject(error);
        else resolve(seconds!);
      }
      options.signal.addEventListener('abort', abort);
      if (options.signal.aborted) abort();
      else void player.replaceAsync({ uri }).catch(finish);
    });
    checkCancelled(options.signal);
    validateDuration(duration);
    // Sparse sampling is explicit in the UI; never claim to inspect every frame.
    const count = Math.min(8, Math.max(1, Math.ceil(duration / 15)));
    thumbnails = await player.generateThumbnailsAsync(
      Array.from({ length: count }, (_, index) => (index * duration) / count),
      { maxWidth: 1600, maxHeight: 1600 },
    );
    checkCancelled(options.signal);
    const ocr = await createPaddleOcr(await model(configs.ocr, options));
    const texts: string[] = [];
    try {
      options.onProgress('read');
      for (const thumbnail of thumbnails)
        texts.push(await readImage(thumbnail, ocr, options));
    } finally {
      ocr.dispose();
    }
    // A missing audio track is valid. Never silently discard a failed track.
    const transcript = player.availableAudioTracks.length
      ? await speech(uri, options)
      : '';
    return [transcript, ...texts].filter((text) => text.trim()).join('\n\n');
  } finally {
    thumbnails.forEach((thumbnail) => thumbnail.release());
    player.release();
  }
}
async function chooseAndReadInternal(
  options: CaptureOptions,
): Promise<string | null> {
  const selection = await DocumentPicker.getDocumentAsync({
    type: [
      'image/jpeg',
      'image/png',
      'image/heic',
      'audio/*',
      'video/mp4',
      'video/quicktime',
    ],
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (selection.canceled) return null;
  const asset = selection.assets[0]!;
  return consumeCacheFile(asset.uri, asset.mimeType ?? '', options);
}
/** Consumes an app-cache copy; removes it after success, failure or cancellation. */
async function consumeCacheFile(
  uri: string,
  mimeType: string,
  options: CaptureOptions,
): Promise<string> {
  if (!uri.startsWith(Paths.cache.uri)) throw new CaptureError('unsupported');
  // Only the picker-owned cache copy is deleted, never the provider's original.
  const file = new File(uri);
  try {
    validateLocalSource(uri, file.size);
    checkCancelled(options.signal);
    let text: string;
    if (mimeType.startsWith('image/')) {
      const task = await createPaddleOcr(await model(configs.ocr, options));
      try {
        options.onProgress('read');
        text = await readImage(uri, task, options);
      } finally {
        task.dispose();
      }
    } else if (mimeType.startsWith('audio/')) {
      text = await speech(uri, options);
    } else if (mimeType.startsWith('video/')) {
      text = await video(uri, options);
    } else throw new CaptureError('unsupported');
    checkCancelled(options.signal);
    if (!text.trim()) throw new CaptureError('empty');
    return text;
  } finally {
    if (file.exists) file.delete();
  }
}
async function organizeSourceInternal(
  source: string,
  options: CaptureOptions,
): Promise<CaptureResult> {
  const prompt = extractionPrompt(source);
  const session = await createLLMChatSession(
    await model(configs.text, options),
    {
      generationConfig: {
        temperature: 0,
        maxNewTokens: 2600,
        enableThinking: false,
      },
    },
  );
  const stop = () => session.stop();
  options.signal.addEventListener('abort', stop);
  try {
    checkCancelled(options.signal);
    options.onProgress('organize');
    const response = await session.sendMessage(prompt);
    checkCancelled(options.signal);
    const message = response.messages.at(-1);
    if (message?.role !== 'assistant' || typeof message.content !== 'string')
      throw new CaptureError('output');
    return parseExtraction(message.content, source);
  } finally {
    options.signal.removeEventListener('abort', stop);
    session.dispose();
  }
}
// An aborted OCR/native load may still be settling after its screen unmounts.
// Keep a process-wide lease until disposal; never load a second model over it.
export const chooseAndRead = (options: CaptureOptions) =>
  exclusive(() => chooseAndReadInternal(options));
export const readSourceFile = (
  uri: string,
  mimeType: string,
  options: CaptureOptions,
) => exclusive(() => consumeCacheFile(uri, mimeType, options));
export const organizeSource = (source: string, options: CaptureOptions) =>
  exclusive(() => organizeSourceInternal(source, options));

import { chooseAndRead, readSourceFile } from './engine.native';
import { CaptureError, type CaptureOptions } from './pipeline';

const mockPrepare = jest.fn();
const mockRecognize = jest.fn();
const mockPick = jest.fn();
const mockReleaseImage = jest.fn();
const mockReleaseContext = jest.fn();
const mockFiles = new Map<string, number>();

jest.mock('expo', () => ({
  requireNativeModule: () => ({
    prepareAsync: (...args: unknown[]) => mockPrepare(...args),
    recognizeAsync: (...args: unknown[]) => mockRecognize(...args),
  }),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockPick(...args),
}));
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  File: class {
    uri: string;
    constructor(mockUri: string) {
      this.uri = mockUri;
    }
    get size() {
      return mockFiles.get(this.uri) ?? 0;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    delete() {
      mockFiles.delete(this.uri);
    }
  },
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      renderAsync: async () => ({
        saveAsync: async () => {
          mockFiles.set('file:///cache/preview.jpg', 90);
          return { uri: 'file:///cache/preview.jpg' };
        },
        release: mockReleaseImage,
      }),
      release: mockReleaseContext,
    }),
  },
}));
const options = (): CaptureOptions => ({
  signal: new AbortController().signal,
  language: 'es',
  onProgress: jest.fn(),
});
beforeEach(() => {
  jest.clearAllMocks();
  mockFiles.clear();
  mockFiles.set('file:///cache/input.jpg', 100);
  mockPrepare.mockResolvedValue(undefined);
  mockRecognize.mockResolvedValue(
    'Sopa\nIngredientes\nSal\nPreparación\nHervir.',
  );
});
it('reads only a normalized local photo, consumes its private copy and retains a disposable preview', async () => {
  const result = await readSourceFile(
    'file:///cache/input.jpg',
    'image/jpeg',
    options(),
  );
  expect(mockRecognize).toHaveBeenCalledWith('file:///cache/preview.jpg', 'es');
  expect(result.text).toContain('Sopa');
  expect(mockFiles.has('file:///cache/input.jpg')).toBe(false);
  expect(mockFiles.has(result.previewUri)).toBe(true);
  expect(mockReleaseImage).toHaveBeenCalledTimes(1);
  expect(mockReleaseContext).toHaveBeenCalledTimes(1);
  result.dispose();
  result.dispose();
  expect(mockFiles.has(result.previewUri)).toBe(false);
});
it('rejects audio/video and remote or non-cache paths without invoking OCR', async () => {
  await expect(
    readSourceFile('https://example.com/recipe.jpg', 'image/jpeg', options()),
  ).rejects.toThrow(CaptureError);
  await expect(
    readSourceFile('file:///original/photo.jpg', 'image/jpeg', options()),
  ).rejects.toThrow(CaptureError);
  await expect(
    readSourceFile('file:///cache/input.jpg', 'audio/wav', options()),
  ).rejects.toThrow(CaptureError);
  expect(mockPrepare).not.toHaveBeenCalled();
  expect(mockRecognize).not.toHaveBeenCalled();
  expect(mockFiles.has('file:///cache/input.jpg')).toBe(false);
});
it('cleans up source and preview after OCR failure and releases the operation lease', async () => {
  mockRecognize.mockRejectedValueOnce(new Error('reader failed'));
  await expect(
    readSourceFile('file:///cache/input.jpg', 'image/jpeg', options()),
  ).rejects.toThrow('reader failed');
  expect(mockFiles.size).toBe(0);
  expect(mockReleaseContext).toHaveBeenCalledTimes(1);
  mockFiles.set('file:///cache/input.jpg', 100);
  const next = await readSourceFile(
    'file:///cache/input.jpg',
    'image/jpeg',
    options(),
  );
  next.dispose();
});
it('cancels after reader preparation without touching the image or leaking the source copy', async () => {
  const abort = new AbortController();
  mockPrepare.mockImplementationOnce(async () => {
    abort.abort();
  });
  await expect(
    readSourceFile('file:///cache/input.jpg', 'image/jpeg', {
      ...options(),
      signal: abort.signal,
    }),
  ).rejects.toThrow('cancelled');
  expect(mockRecognize).not.toHaveBeenCalled();
  expect(mockFiles.size).toBe(0);
});
it('limits the picker to photos and leaves the current draft alone on dismissal', async () => {
  mockPick.mockResolvedValue({ canceled: true });
  expect(await chooseAndRead(options())).toBeNull();
  expect(mockPick).toHaveBeenCalledWith(
    expect.objectContaining({
      type: ['image/jpeg', 'image/png', 'image/heic', 'image/heif'],
      multiple: false,
      copyToCacheDirectory: true,
    }),
  );
  expect(mockRecognize).not.toHaveBeenCalled();
});
it('rejects encoded cache traversal without reading or deleting the original file', async () => {
  mockFiles.set('file:///original/photo.jpg', 123);
  for (const uri of [
    'file:///cache/../original/photo.jpg',
    'file:///cache/%2e%2e/original/photo.jpg',
    'file:///cache/%2f..%2foriginal/photo.jpg',
  ]) {
    await expect(readSourceFile(uri, 'image/jpeg', options())).rejects.toThrow(
      'unsupported',
    );
  }
  expect(mockRecognize).not.toHaveBeenCalled();
  expect(mockFiles.get('file:///original/photo.jpg')).toBe(123);
});
it('cancels promptly during model preparation and shares the pending setup with the next photo', async () => {
  let finish!: () => void;
  mockPrepare.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const abort = new AbortController();
  const first = readSourceFile('file:///cache/input.jpg', 'image/jpeg', {
    ...options(),
    signal: abort.signal,
  });
  abort.abort();
  await expect(first).rejects.toThrow('cancelled');
  expect(mockFiles.has('file:///cache/input.jpg')).toBe(false);
  mockFiles.set('file:///cache/input.jpg', 100);
  const next = readSourceFile(
    'file:///cache/input.jpg',
    'image/jpeg',
    options(),
  );
  expect(mockPrepare).toHaveBeenCalledTimes(1);
  finish();
  const result = await next;
  result.dispose();
});

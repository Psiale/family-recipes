import type { CaptureResult } from './draft';
import { CaptureError, type CaptureOptions } from './pipeline';

export const captureSupported = false;
export async function chooseAndRead(
  _options: CaptureOptions,
): Promise<string | null> {
  throw new CaptureError('unsupported');
}
export async function organizeSource(
  _source: string,
  _options: CaptureOptions,
): Promise<CaptureResult> {
  throw new CaptureError('unsupported');
}

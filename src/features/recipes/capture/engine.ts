import type { CaptureResult } from './draft';
import {
  CaptureError,
  type CaptureOptions,
  type PhotoReadResult,
} from './pipeline';

export async function chooseAndRead(
  _options: CaptureOptions,
): Promise<PhotoReadResult | null> {
  throw new CaptureError('unsupported');
}
export async function organizeSource(
  _source: string,
  _options: CaptureOptions,
): Promise<CaptureResult> {
  throw new CaptureError('unsupported');
}

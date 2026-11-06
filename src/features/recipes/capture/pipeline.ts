import { captureResultSchema, type CaptureResult } from './draft';

export type CaptureLanguage = 'es' | 'en';
export type CaptureStage = 'prepare' | 'read' | 'organize';
export type CaptureOptions = {
  signal: AbortSignal;
  language: CaptureLanguage;
  onProgress: (stage: CaptureStage) => void;
};
export type PhotoReadResult = {
  text: string;
  previewUri: string;
  dispose: () => void;
};
export class CaptureError extends Error {
  constructor(
    public readonly code:
      | 'busy'
      | 'unsupported'
      | 'size'
      | 'empty'
      | 'output'
      | 'cancelled'
      | 'sourceLength'
      | 'reader',
    public readonly nativeError?: unknown,
  ) {
    super(code);
  }
}
export const MAX_FILE_BYTES = 30 * 1024 * 1024;
export const MAX_SOURCE_CHARS = 10000;
export function checkCancelled(signal: AbortSignal) {
  if (signal.aborted) throw new CaptureError('cancelled');
}
export function validateLocalSource(uri: string, bytes: number) {
  if (!uri.startsWith('file://')) throw new CaptureError('unsupported');
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_FILE_BYTES)
    throw new CaptureError('size');
}
export function validateCacheCopyUri(uri: string, cacheUri: string) {
  const prefix = cacheUri.endsWith('/') ? cacheUri : cacheUri + '/';
  if (!uri.startsWith(prefix) || uri.includes('?') || uri.includes('#'))
    throw new CaptureError('unsupported');
  let path: string;
  try {
    path = decodeURIComponent(uri.slice(prefix.length));
  } catch {
    throw new CaptureError('unsupported');
  }
  if (
    !path ||
    path.includes('\\') ||
    path.includes('\0') ||
    path.split('/').some((part) => part === '.' || part === '..')
  )
    throw new CaptureError('unsupported');
}
const heading = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[:：]\s*$/, '')
    .trim();
const ingredientHeadings = new Set(['ingredientes', 'ingredients']);
const stepHeadings = new Set([
  'preparacion',
  'procedimiento',
  'elaboracion',
  'modo de preparacion',
  'instrucciones',
  'pasos',
  'preparation',
  'instructions',
  'directions',
  'method',
  'steps',
]);
const unbullet = (text: string) =>
  text.replace(/^(?:[•*–—-]\s+|\d+[.)]\s+)/, '').trim();
const quantityPrefix =
  /^(un puñito|un puñado|una pizca|un poco|al gusto|a pinch|a handful|to taste|\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])(?=\s|$)/i;
const unitPrefix =
  /^(kg|g|gr|mg|ml|l|gramos?|kilogramos?|litros?|mililitros?|cucharadas?|cucharaditas?|tazas?|piezas?|cups?|tbsp|tsp|tablespoons?|teaspoons?|grams?|kilograms?|liters?|milliliters?|oz|lb)(?=\s|$)/i;
function ingredient(line: string, section: string | null) {
  const text = unbullet(line);
  const quantity = text.match(quantityPrefix)?.[0] ?? null;
  let name = quantity ? text.slice(quantity.length).trim() : text;
  const unit = quantity ? (name.match(unitPrefix)?.[0] ?? null) : null;
  if (unit) name = name.slice(unit.length).trim();
  if (quantity) name = name.replace(/^(?:de|of)\s+/i, '');
  // Ambiguous quantities remain original text; never manufacture a name.
  if (!name)
    return {
      ingredient: text,
      quantity: null,
      unit: null,
      preparation_note: null,
      section_name: section,
    };
  return {
    ingredient: name,
    quantity,
    unit,
    preparation_note: null,
    section_name: section,
  };
}
/** Conservative heading-based mapping. The complete reviewed source remains local. */
export function organizePhotoText(source: string): CaptureResult {
  if (!source.trim()) throw new CaptureError('empty');
  if (source.length > MAX_SOURCE_CHARS) throw new CaptureError('sourceLength');
  const result: CaptureResult = {
    recipe: {
      title: null,
      description: null,
      origin_location: null,
      origin_year: null,
      story: null,
      servings: null,
      prep_time_minutes: null,
      cook_time_minutes: null,
      rest_time_minutes: null,
      ingredients: [],
      steps: [],
    },
    source_text: source,
    issues: [],
  };
  let mode: 'preamble' | 'ingredients' | 'steps' = 'preamble';
  let section: string | null = null;
  let hasNumberedSteps = false;
  const issue = (field: string, evidence: string | null) =>
    result.issues.length < 100 &&
    result.issues.push({
      field,
      kind: evidence === null ? 'missing' : 'unclear',
      note: 'manual_review',
      evidence: evidence?.slice(0, 1000) ?? null,
    });
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const normalized = heading(line);
    if (ingredientHeadings.has(normalized)) {
      mode = 'ingredients';
      section = null;
      continue;
    }
    if (stepHeadings.has(normalized)) {
      mode = 'steps';
      section = null;
      continue;
    }
    if (mode === 'preamble') {
      if (
        result.recipe.title === null &&
        line.length <= 160 &&
        !line.includes(':')
      )
        result.recipe.title = line;
      else issue('source', line);
      continue;
    }
    if (line.endsWith(':') && line.length <= 241) {
      section = line.slice(0, -1).trim() || null;
      continue;
    }
    if (mode === 'ingredients') {
      if (line.length > 240 || result.recipe.ingredients.length >= 100) {
        issue('ingredients', line);
        continue;
      }
      result.recipe.ingredients.push(ingredient(line, section));
    } else {
      const numbered = /^\d+[.)]\s+/.test(line);
      const instruction = unbullet(line);
      const previous = result.recipe.steps.at(-1);
      if (!numbered && hasNumberedSteps && previous?.section_name === section) {
        if (
          previous.instruction &&
          previous.instruction.length + instruction.length + 1 <= 4000
        )
          previous.instruction += '\n' + instruction;
        else issue('steps', line);
      } else if (
        instruction.length <= 4000 &&
        result.recipe.steps.length < 100
      ) {
        result.recipe.steps.push({
          instruction,
          section_name: section,
          duration_minutes: null,
        });
      } else issue('steps', line);
      if (numbered) hasNumberedSteps = true;
    }
  }
  if (!result.recipe.title) issue('title', null);
  if (!result.recipe.ingredients.length) issue('ingredients', null);
  if (!result.recipe.steps.length) issue('steps', null);
  return captureResultSchema.parse(result);
}

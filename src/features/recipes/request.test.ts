import { recipeRequest, RECIPE_REQUEST_TIMEOUT_MS } from './request';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('bounds a save even when the SDK never starts fetch, aborts it, and never retries', async () => {
  let signal: AbortSignal | undefined;
  const run = jest.fn((current: AbortSignal) => {
    signal = current;
    return new Promise<never>(() => {});
  });
  const request = recipeRequest(run, true);
  const rejected = expect(request).rejects.toMatchObject({
    code: 'RECIPE_SAVE_UNCONFIRMED',
  });
  await jest.advanceTimersByTimeAsync(RECIPE_REQUEST_TIMEOUT_MS);
  await rejected;
  expect(signal?.aborted).toBe(true);
  expect(run).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it('returns a successful result and removes its deadline', async () => {
  await expect(recipeRequest(async () => 'saved', true)).resolves.toBe('saved');
  expect(jest.getTimerCount()).toBe(0);
});

it('preserves server authorization/stale errors rather than reporting a timeout', async () => {
  const error = { code: 'PT409' };
  await expect(recipeRequest(() => Promise.reject(error), true)).rejects.toBe(
    error,
  );
  expect(jest.getTimerCount()).toBe(0);
});

it('reports a read timeout separately from an uncertain write', async () => {
  const request = recipeRequest(() => new Promise<never>(() => {}));
  const rejected = expect(request).rejects.toMatchObject({
    code: 'RECIPE_REQUEST_TIMEOUT',
  });
  await jest.advanceTimersByTimeAsync(RECIPE_REQUEST_TIMEOUT_MS);
  await rejected;
});

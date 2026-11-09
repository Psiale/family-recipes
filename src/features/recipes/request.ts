export const RECIPE_REQUEST_TIMEOUT_MS = 20_000;

export class RecipeRequestTimeout extends Error {
  readonly code: string;

  constructor(write: boolean) {
    super('Recipe request exceeded its deadline');
    this.code = write ? 'RECIPE_SAVE_UNCONFIRMED' : 'RECIPE_REQUEST_TIMEOUT';
  }
}

// Cover the whole SDK operation, including any wait for an Auth token before
// fetch starts. Aborting fetch alone does not bound that earlier wait.
export async function recipeRequest<T>(
  run: (signal: AbortSignal) => PromiseLike<T>,
  write = false,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new RecipeRequestTimeout(write));
    }, RECIPE_REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => run(controller.signal)),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

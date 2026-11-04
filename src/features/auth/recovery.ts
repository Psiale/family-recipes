export const recoveryStorageKey = 'family-recipes:password-recovery-user';

// Never log or persist the callback URL or its one-time authorization code.
export function readAuthCallback(url: string, redirectTo: string) {
  try {
    const incoming = new URL(url);
    const expected = new URL(redirectTo);
    const exactTarget =
      incoming.protocol === expected.protocol &&
      incoming.host === expected.host &&
      incoming.pathname === expected.pathname;
    const mobileTarget =
      incoming.protocol === 'familyrecipes:' &&
      ((incoming.hostname === '' && incoming.pathname === '/sign-in') ||
        (incoming.hostname === 'sign-in' && incoming.pathname === ''));
    if (!exactTarget && !mobileTarget) return null;

    const fragment = new URLSearchParams(incoming.hash.slice(1));
    if (incoming.searchParams.has('error') || fragment.has('error'))
      return { error: true } as const;
    const codes = incoming.searchParams.getAll('code');
    if (codes.length !== 1 || !codes[0] || codes[0].length > 8192) return null;
    return { code: codes[0] } as const;
  } catch {
    return null;
  }
}

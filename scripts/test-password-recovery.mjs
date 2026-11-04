import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

function unwrap({ data, error }) {
  if (error)
    throw new Error(
      `Recovery integration failed (${error.code ?? error.status})`,
    );
  return data;
}

export async function testPasswordRecovery(config, db) {
  // This helper is called only by the local-only integration runner. Never
  // print reset URLs, authorization codes, session tokens, or passwords.
  const base = new URL(config.API_URL);
  const mailpit = new URL(config.MAILPIT_URL ?? config.INBUCKET_URL);
  for (const url of [base, mailpit]) {
    assert.ok(
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname),
      'Local recovery test only',
    );
  }
  const options = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  };
  const service = createClient(base.href, config.SERVICE_ROLE_KEY, options);
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  const recoveryOptions = {
    auth: {
      storage,
      flowType: 'pkce',
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
  };
  const requester = createClient(base.href, config.ANON_KEY, recoveryOptions);
  const restarted = createClient(base.href, config.ANON_KEY, recoveryOptions);
  const otherDevice = createClient(base.href, config.ANON_KEY, {
    auth: {
      ...options.auth,
      flowType: 'pkce',
    },
  });
  const email = `recovery-${randomUUID()}@example.com`;
  const oldPassword = `Old-${randomUUID()}!`;
  const newPassword = `New-${randomUUID()}!`;
  const { user } = unwrap(
    await service.auth.admin.createUser({
      email,
      password: oldPassword,
      email_confirm: true,
    }),
  );
  try {
    unwrap(
      await requester.auth.resetPasswordForEmail(email, {
        redirectTo: 'familyrecipes:///sign-in',
      }),
    );
    let messageId;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const response = await fetch(new URL('/api/v1/messages', mailpit), {
        signal: AbortSignal.timeout(5000),
      });
      assert.ok(response.ok, 'Local email capture must be available');
      const { messages } = await response.json();
      messageId = messages.find((message) =>
        message.To?.some((to) => to.Address === email),
      )?.ID;
      if (messageId) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(messageId, 'A recovery email must be captured locally');
    const messageResponse = await fetch(
      new URL(`/api/v1/message/${messageId}`, mailpit),
      { signal: AbortSignal.timeout(5000) },
    );
    assert.ok(messageResponse.ok, 'Recovery email must be readable');
    const message = await messageResponse.json();
    const links = [...message.HTML.matchAll(/href="([^"]+)"/g)].map((match) =>
      match[1].replaceAll('&amp;', '&'),
    );
    const recoveryLink = links.find((link) => {
      const url = new URL(link);
      return (
        url.pathname === '/auth/v1/verify' &&
        url.searchParams.get('type') === 'recovery'
      );
    });
    assert.ok(recoveryLink, 'Email must contain a recovery verification link');
    const verificationUrl = new URL(recoveryLink);
    assert.ok(
      verificationUrl.origin === base.origin,
      'Verification must stay on local Auth',
    );
    const verification = await fetch(verificationUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    assert.ok(
      verification.status === 302 || verification.status === 303,
      'Recovery must redirect into the app',
    );
    const location = verification.headers.get('location');
    assert.ok(location, 'Recovery redirect must exist');
    const callback = new URL(location);
    assert.ok(
      callback.protocol === 'familyrecipes:' &&
        callback.pathname === '/sign-in',
      'Recovery must return to the existing mobile callback',
    );
    const code = callback.searchParams.get('code');
    assert.ok(code, 'PKCE recovery must provide an authorization code');
    assert.ok(
      (await otherDevice.auth.exchangeCodeForSession(code)).error,
      'Another device must not exchange a code without the verifier',
    );
    const events = [];
    const {
      data: { subscription },
    } = restarted.auth.onAuthStateChange((event) => events.push(event));
    try {
      const recovered = unwrap(
        await restarted.auth.exchangeCodeForSession(code),
      );
      assert.equal(recovered.user.id, user.id);
      assert.ok(
        events.includes('PASSWORD_RECOVERY'),
        'PKCE recovery must emit PASSWORD_RECOVERY, not only SIGNED_IN',
      );
      unwrap(await restarted.auth.updateUser({ password: newPassword }));
      unwrap(await restarted.auth.signOut({ scope: 'local' }));
      assert.ok(
        (
          await restarted.auth.signInWithPassword({
            email,
            password: oldPassword,
          })
        ).error,
        'Old password must stop working',
      );
      const signedIn = unwrap(
        await restarted.auth.signInWithPassword({
          email,
          password: newPassword,
        }),
      );
      assert.equal(signedIn.user.id, user.id);
      assert.ok(
        (await restarted.auth.exchangeCodeForSession(code)).error,
        'A recovery code must not be reusable',
      );
      const { rows } = await db.query(
        'select id from public.app_users where id=$1',
        [user.id],
      );
      assert.equal(
        rows.length,
        1,
        'Recovery must preserve the existing account projection',
      );
    } finally {
      subscription.unsubscribe();
    }
    console.log(
      'Real captured-email PKCE recovery, restart, wrong-device denial, password update, and single-use checks passed.',
    );
  } finally {
    await Promise.allSettled(
      [requester, restarted, otherDevice].map((client) =>
        client.auth.signOut({ scope: 'local' }),
      ),
    );
    await db.query('delete from auth.users where id=$1', [user.id]);
  }
}

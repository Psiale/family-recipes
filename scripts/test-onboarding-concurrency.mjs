import assert from 'node:assert/strict';

import pg from 'pg';

export async function testOnboardingConcurrency(connectionString) {
  const admin = new pg.Client({ connectionString });
  const left = new pg.Client({ connectionString });
  const right = new pg.Client({ connectionString });
  await Promise.all([admin.connect(), left.connect(), right.connect()]);
  try {
    await admin.query(`insert into auth.users (id,email,email_confirmed_at) values
      ('02000000-0000-0000-0000-000000000001','psialedev@gmail.com',now()),
      ('02000000-0000-0000-0000-000000000002','concurrent@example.com',now()),
      ('02000000-0000-0000-0000-000000000003','claim-concurrent@example.com',now())`);
    for (const client of [left, right]) {
      await client.query("set role authenticated; set statement_timeout='5s'");
      await client.query(
        "select set_config('request.jwt.claim.sub',$1,false)",
        ['02000000-0000-0000-0000-000000000002'],
      );
    }
    const onboarding = await Promise.allSettled(
      [left, right].map((client) =>
        client.query("select public.onboard_person('Concurrent')"),
      ),
    );
    assert.equal(onboarding.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(
      onboarding.find((r) => r.status === 'rejected').reason.code,
      '23505',
    );
    const {
      rows: [{ id: familyId }],
    } = await left.query(
      "select public.create_family('Concurrency family') as id",
    );
    const {
      rows: [{ id: personId }],
    } = await left.query(
      "select public.create_managed_person($1,'Claim target') as id",
      [familyId],
    );
    const {
      rows: [{ token }],
    } = await left.query(
      "select public.issue_person_claim($1,'claim-concurrent@example.com') as token",
      [personId],
    );
    for (const client of [left, right]) {
      await client.query(
        "select set_config('request.jwt.claim.sub',$1,false)",
        ['02000000-0000-0000-0000-000000000003'],
      );
    }
    const claims = await Promise.allSettled(
      [left, right].map((client) =>
        client.query('select public.claim_managed_person($1) as id', [token]),
      ),
    );
    assert.equal(claims.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(
      claims.find((r) => r.status === 'rejected').reason.code,
      '23505',
    );
    const {
      rows: [{ count }],
    } = await admin.query(
      'select count(*)::int as count from public.people where user_id=$1',
      ['02000000-0000-0000-0000-000000000003'],
    );
    assert.equal(count, 1);
    console.log('Concurrent onboarding and single-use claiming passed.');
  } finally {
    await Promise.all([admin.end(), left.end(), right.end()]);
  }
}

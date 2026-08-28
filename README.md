# Family Recipe Tree

Private, cross-platform family recipe application built around families, branches,
people, and durable recipe lineage.

The governing architectural rule is:

> Identity != Ownership != Visibility != Lineage

## Architecture foundation

- [Domain model](docs/domain-model.md)
- [Authorization matrix](docs/authorization-matrix.md)
- [Row Level Security design](docs/rls-design.md)
- [Implementation plan](docs/implementation-plan.md)
- [Initial PostgreSQL schema](supabase/migrations/0001_initial_schema.sql)

Spanish is the default application language. English is supported from the first
release. Application-authored copy must use localization keys; user content is
stored and displayed exactly as entered.

## Frontend foundation

The Expo application lives in `src/` and uses Expo Router protected routes,
Supabase Auth, TanStack Query, React Hook Form with Zod, and i18next. The
committed database types are generated from the local migrated schema.

### Local setup

1. Install Node.js 22.13 or newer and run `npm ci`.
2. Copy `.env.example` to `.env`.
3. Start Docker and run `npm run db:start`. This applies `SUPER_ADMIN_EMAIL`
   from `.env` after the local database starts.
4. Copy the local API URL and publishable/anon key printed by Supabase into
   `.env`.
5. The default Super Admin email is `psialedev@gmail.com`; that verified Auth
   account must register before other users.
6. For the iPhone simulator, run `npm run ios` to build and install the native
   development app and start Metro. Keep that terminal running while using the
   app. To select a simulator, use `npm run ios -- --device`.
7. After the development app is installed, use `npm start` and press `i` to
   reopen it. Run `npm run ios` again after changing native dependencies. For
   Android, use `npm run android` for the first build.

Keep only route screens and layouts in `src/app/`: Expo Router bundles files in
that directory as application routes, including `*.test.tsx` files. Route tests
belong in `src/test/`; other tests can remain next to their components outside
`src/app/`.

Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are
embedded in the Expo bundle. `SUPABASE_DB_URL` and `SUPER_ADMIN_EMAIL` are
server-only values used by local database scripts and CI; never expose them with
an `EXPO_PUBLIC_` prefix. The app displays localized recovery guidance when its
public configuration is missing or invalid.

Useful checks:

- `npm run lint`
- `npm run typecheck`
- `npm run check:ios-bundle` (catches native bundling errors without Xcode)
- `npm test`
- `npm run format:check`
- `npm run db:test`
- `npm run db:types:check`
- `npm run db:configure` after changing `SUPER_ADMIN_EMAIL`
- `npm run db:types` after every migration

EAS includes `development`, `development-simulator`, `preview`, and
`production` build profiles. Configure the two public Supabase variables in the
matching EAS environment before cloud builds.

The CI workflow runs frontend quality checks and, in a separate isolated local
Supabase stack, applies every migration, executes the transactional SQL/RLS
suite, and verifies that generated database types are current.

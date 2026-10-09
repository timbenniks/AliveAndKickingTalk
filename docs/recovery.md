# Alive and Kicking recovery

The app runs again against hosted Supabase and Contentstack. Recovery completed on 9 October 2026 without upgrading Nuxt beyond 3.10.0. The original paused Supabase project and downloaded backup are unchanged. No local database was created.

## Run the app

```sh
nvm use
npm ci
npm run dev
```

For the production build:

```sh
npm run build
npm run preview
```

The verified Node version is 22.23.1. `.nvmrc` selects Node 22. Use npm and the new `package-lock.json`; the stale Yarn lockfile was removed. `@parcel/watcher` is pinned to 2.5.1 to fix installation, and Rollup to the original 4.9.4 because the newer resolved version incorrectly removed Nuxt context lookup during server bundling. Vue is pinned to 3.4.15 and the existing app dependencies are pinned for reproducibility.

Local `.env` contains the replacement project's URL, anon key and server-only service-role key. It also contains the Contentstack delivery endpoint and token. It is Git-ignored. Deployment must supply the same configuration; `npm run preview` loads `.env`, but starting `.output/server/index.mjs` directly does not. Matching Nuxt runtime overrides are `NUXT_CONTENTSTACK_HOST`, `NUXT_CONTENTSTACK_TOKEN` and `NUXT_PLAUSIBLE_KEY`; the legacy variable names in `.env.example` are read at build time. Set credentials in the host environment when deploying, then rebuild as needed.

OAuth client IDs and secrets belong in **Supabase → Authentication → Sign In / Providers**, not the app environment. Temporary credential-transfer entries should be removed from `.env` after provider configuration. The database password is only needed for database administration, not app runtime.

## Hosted database

[Alive and Kicking Recovery](https://supabase.com/dashboard/project/wrgvlelotyxwkplymwux) is in the existing free organization, Frankfurt, running PostgreSQL 17.11.

The restore used an encrypted session-pooler connection to `aws-1-eu-central-1.pooler.supabase.com:5432`, username `postgres.wrgvlelotyxwkplymwux`, database `postgres`. Homebrew was blocked by the Xcode license, so the client used Python's PostgreSQL driver. Podman was briefly started as a possible client host and then stopped; it did not host a database.

| Restored table | Rows |
| --- | ---: |
| auth.users | 936 |
| auth.identities | 948 |
| auth.sessions | 1,104 |
| auth.mfa_amr_claims | 1,104 |
| auth.refresh_tokens | 2,236 |
| auth.flow_state | 950 |
| auth.audit_log_entries | 4,777 |
| public.config | 2 |
| public.votes | 83 |
| public.shares | 304 |
| public.songs_played | 0 |

Auth/session counts can change during login testing. Application row counts were verified before traffic and the test vote was removed. The original administrator UUID remains `c9d34b15-6255-4500-9396-9f18f350073d`, verified by signing in and opening `/config`.

The app schema, data, view, indexes and sequence values were restored in one transaction. Supabase's current managed schemas, internal functions and migration history were preserved instead of replacing them with their PostgreSQL 15-era definitions. Every nonempty backup data block was accounted for: app/Auth data was imported; only old managed migration-history records were intentionally excluded. Storage buckets and objects are empty, as is the storage ZIP.

The dump's permissive policies were replaced before commit using [supabase/recovery.sql](../supabase/recovery.sql). Configuration and played-song writes now require the original administrator; vote writes require the current user's ID, with admin deletion retained. Shares remain publicly readable, but insertion requires ownership. Anonymous clients cannot write, and blanket TRUNCATE grants were removed. Realtime publishes inserts, updates and deletes for config, votes and played songs.

Read-only restore checks are in [verify-supabase-restore.sql](verify-supabase-restore.sql). The policy/Realtime SQL is for the one-time recovery, not an idempotent migration to replay against an already-configured database.

## Backup and restore record

Original file: `supabase-backups/db_cluster-22-03-2025@22-18-59.backup.gz`.

SHA-256: `11384aaa99545d8d73bc9b6fe5a293702f9254d189c976d93c33467f810c7eee`.

This is the March 2025 snapshot, exported from PostgreSQL 15.6 using pg_dump 15.12. The original cluster dump includes role changes and an empty `template1` database section. A database-only copy, extracted public schema, restore script and restore log are retained in the ignored `supabase-backups/` directory. All COPY blocks were preserved in the database-only copy. Do not commit this directory: it contains personal data and authentication material.

The prepared `restore-hosted.py` is a one-off restore record, uses `psycopg` and `sqlparse`, and refuses a destination with existing app tables/users. It was run against the new hosted project. Do not rerun the raw dump into the now-populated project.

The [Supabase dashboard restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/dashboard-restore) describes the general recovery route. This restore narrowed the import to app schema and compatible Auth data to avoid replacing managed infrastructure or requiring deprecated `pgjwt`/`pgsodium` extensions.

## Content and behavior changes

- `/api/songs` fetches the nine published Contentstack songs with the delivery token held server-side. The store and band screen share the same normalization. The incompatible old GraphQL queries and build-time code-generation module were removed.
- Song IDs are unchanged, preserving votes and shares. All nine referenced MP3 files are present under `public/`.
- Contentstack artwork URLs render directly, with centered positioning because the CMS no longer has the old positioning metadata. Cloudinary share composites use the song's cover as their background because Contentstack assets have no Cloudinary public ID.
- The query supports up to 50 songs and 20 artwork assets per song. An incomplete song catalogue causes a clear upstream error rather than silently missing songs; add pagination if the catalogue grows beyond this scope.
- Analytics runs through `/api/visitors`; its token is no longer public. Missing/unavailable analytics returns no count and does not prevent the rest of `/stats` from loading.
- Realtime vote/played-song listeners handle deletion and clean up channels on unmount.
- OAuth redirects explicitly to the current origin's `/confirm`. Localhost callback is allowed in the hosted project's Auth settings. Legal pages remain accessible without login.

## Verification

Passed: clean `npm ci`, production `npm run build`, and `node --experimental-strip-types tests/contentstack.mjs`. No lint or typecheck tasks exist in this repository.

Verified against hosted Supabase: restore counts, anonymous and non-admin write rejection, admin config writes inside a rolled-back transaction, all three Realtime tables/events, GitHub login, original administrator access, one test vote and its removal updating the live display, all nine songs, band content, 936 avatar responses and analytics responses. Individual share 322 and mashup share 317 render server-side; both generated Cloudinary images returned HTTP 200. The production song endpoint and share rendering were also checked after a clean build. Server secrets were absent from public build assets.

Tim confirmed that MIDI works with the macOS IAC Driver and its Alive and Kicking port. All database services run in hosted Supabase.

### OAuth credentials

GitHub, LinkedIn (OIDC), and Twitter providers are configured in the hosted Supabase project. GitHub login was tested successfully. LinkedIn and Twitter still need end-to-end login tests. OAuth client IDs and secrets belong in Supabase Authentication → Sign In / Providers; the application does not need them in `.env`. Temporary GitHub and Twitter credential entries were removed after configuration. Twitter retains the original OAuth 1 provider for recovery; migration to OAuth 2 is deferred.

## Production deployment

The existing Vercel project is `aliveandkicking` in `tim-benniks-projects-1b967033`, serving `https://www.aliveandkicking.dev`. It builds the GitHub `main` branch using Node 22, `npm ci`, and `npm run build`. The app environment in Vercel has been updated to the recovered Supabase project and Contentstack delivery configuration. OAuth provider credentials and the database password are not app deployment variables.

Supabase Site URL is `https://www.aliveandkicking.dev`, with `https://www.aliveandkicking.dev/confirm` allowed alongside the localhost callback.

## Logged-out landing page

The public `/login` page now introduces the talk using the existing Lato typography, blue/pink gradient buttons, logo, stage photography and personalized share artwork. Anonymous visitors to `/` still reach this page through the existing authentication redirect; signed-in visitors continue straight to voting.

The header and hero link directly to the sign-in section. GitHub, Twitter and LinkedIn keep the same OAuth providers and `/confirm` callback. Sign-in failures display a retry message. Event organizers can open Tim's press kit, and visitors can watch the Vue.js Amsterdam 2024 recording or explore the repository. The sample share artwork is labelled as an example from ContentCon. The marketing content renders server-side without fetching songs or voter profiles.

The layout supports mobile and desktop, visible keyboard focus and reduced-motion preferences. No new dependencies were added.

Verified with a production build: anonymous home redirects to the marketing page, marketing text and metadata are in server-rendered HTML, the sign-in shortcut reaches the provider buttons, images load, narrow/mobile and desktop layouts do not overflow, and GitHub login returns to the existing voting screen. No lint or typecheck scripts are configured.

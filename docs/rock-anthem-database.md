# Rock Anthem: database safety and permanent avatars

`supabase/migrations/20261014_rock_anthem_safety.sql` hardens the shared Supabase project. Nothing has been applied: you run it yourself. It is written to keep the frozen classic app (branch `talk-2024`) working.

## What it does

1. **One vote per song per person, one song per mashup spot.**
   - A unique constraint on `(userid, songid)` and a unique index on `(userid, mashup_spot)` where a spot is set. Mashup spots must be between 1 and 4.
   - Duplicates are deleted first, keeping the oldest row. A read on 14 Oct 2026 found 88 votes, 0 duplicates and 0 mashup rows, so today **nothing is deleted**.
2. **A vote cap the client cannot bypass.**
   - A trigger rejects a regular vote (no mashup spot) once the voter already has `max_votes` regular votes.
   - The cap is read from a new `config` row, `max_votes = 5`, which matches `NUXT_MAX_VOTES`. If you change one, change the other.
   - Mashup votes are limited by the four spots instead.
   - A per-voter lock stops two fast taps from both slipping under the cap.
   - The 14 Oct read found nobody above 5 votes.
3. **Emails are no longer public.**
   - Both apps still send an email with each vote. A trigger now moves it into `private.voter_emails`, a schema the API does not expose, and stores `null` in `votes.email`.
   - Existing emails are moved the same way.
   - The column stays, so the classic app's `select('*')` on votes keeps working. Realtime vote events no longer carry emails either.
4. **Atomic mashup vote.**
   - `public.mashup_vote(p_songid, p_spot, p_avatar)` replaces the voter's song in a spot, and moves the song out of any other spot, in one transaction.
   - It runs with the caller's rights, so row-level security still applies. Only signed-in users may call it.
   - The Rock Anthem app calls it. Until it exists, the app falls back to the old two-step path, so deploy order doesn't matter. The classic app keeps its old path.
5. **Permanent avatars.**
   - A public `avatars` storage bucket (1 MB, images only). There are no client write policies, so only the server (service role) can write.
   - After sign-in, the app calls `POST /api/avatar` once per session. The route copies the voter's GitHub, X or LinkedIn avatar into the bucket and returns a URL that never expires. Votes, mashup votes and shares then use it.
   - Before the bucket exists, the route quietly returns the provider URL.

**Old votes keep their old avatar URLs.** Many of the LinkedIn ones have already expired and cannot be recovered. Future work: a one-off backfill that re-copies avatars for voters who sign in again. That happens automatically on their next session, but their old vote rows are not rewritten.

## How to apply

1. Pick a moment when no show is live. The email clean-up updates every vote row, and live screens will refresh once.
2. Supabase dashboard → SQL editor → paste the whole migration → run. It is one transaction: it either all applies or nothing does.
3. Check:
   - `select key, val from config;` shows `max_votes`.
   - `select count(*) from votes where email is not null;` returns 0.
   - Storage shows an `avatars` bucket.
4. Deploy the Rock Anthem app (`rock-anthem` branch) as usual. It works before or after step 2, but the cap, the atomic mashup vote and stored avatars only take effect once the migration is in.

## Roll back

Run in the SQL editor, in this order:

```sql
drop trigger if exists votes_enforce_cap on public.votes;
drop function if exists public.enforce_vote_cap();
drop trigger if exists votes_divert_email on public.votes;
drop function if exists public.divert_vote_email();
drop function if exists public.mashup_vote(text, integer, text);
alter table public.votes drop constraint if exists votes_user_song_key;
alter table public.votes drop constraint if exists votes_mashup_spot_range;
drop index if exists public.votes_user_spot_key;
-- Optional: put emails back (only if you want them public again).
-- update public.votes v set email = e.email from private.voter_emails e where v.userid = e.userid;
delete from public.config where key = 'max_votes';
```

Keep `private.voter_emails` and the `avatars` bucket unless you mean to delete that data.

## Rotate the API keys (dashboard task)

Supabase is moving from the legacy `anon` and `service_role` JWT keys to publishable and secret keys. The app still uses the legacy names, which is why it warns about `SUPABASE_SERVICE_KEY`.

1. Supabase dashboard → Project settings → API keys → create a **publishable** key and a **secret** key.
2. In Vercel (and your local `.env`), set:
   - `NUXT_PUBLIC_SUPABASE_KEY` to the publishable key (replaces `SUPABASE_KEY`)
   - `NUXT_SUPABASE_SECRET_KEY` to the secret key (replaces `SUPABASE_SERVICE_KEY`)
   - `NUXT_PUBLIC_SUPABASE_URL` (replaces `SUPABASE_URL`), unchanged in value
3. Redeploy both Vercel deployments (Rock Anthem and, if it runs, the classic talk). Check sign-in, voting and `/stats` (which uses the service key for avatars).
4. Only then disable the legacy keys in the dashboard. The classic deployment breaks if it still uses them.

## What was tested

The migration was run on a local PGlite copy of the schema:
- the tables from `shared/types/database.ts`
- the `votes_per_song` view
- stand-ins for `auth.uid()`, `auth.jwt()`, the `anon` and `authenticated` roles and `storage.buckets`
- then `supabase/recovery.sql`, then the migration

All 24 checks pass. They cover:
- dedupe
- emails moved and hidden (anon still gets `select *`, but no addresses)
- duplicate vote rejected
- sixth vote rejected
- voting as someone else rejected
- the view still working
- `mashup_vote` replacing, moving and rolling back atomically
- spot 5 rejected
- anon unable to call it
- the classic app's delete-then-insert path still working

Not tested against real Supabase:
- the storage bucket insert and avatar upload (needs the real storage schema and a signed-in user)
- PostgREST error codes
- the realtime effect of the email clean-up

## Show phase (20261015_show_phase.sql)

Audience participation (the crowd power meter and the encore vote) needs phones to know what the host's live screen is doing. This migration adds one config row, `show_phase`, with the value `idle`, `playing` or `encore:<ISO end time>`.

- Only the host can change it: the existing admin-only RLS on `config` applies. Phones read it through realtime (`config` is already in the publication).
- Additive and safe to run twice. It only inserts the row if it is missing.
- The classic talk (`talk-2024`) reads config by key only, so the extra row is invisible to it. Its band page refetches on any config update, which is harmless.
- Until this is applied the app treats a missing row as `idle`: phones never show the meter or encore buttons, and the host's phase writes fail quietly.

**Apply:** paste `supabase/migrations/20261015_show_phase.sql` into the SQL editor and run it. Check with:

```sql
select key, val from public.config where key = 'show_phase';
```

**Roll back:**

```sql
delete from public.config where key = 'show_phase';
```

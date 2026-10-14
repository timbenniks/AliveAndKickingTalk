-- Rock Anthem: database safety and permanent avatars.
-- Apply once in the Supabase SQL editor, after supabase/recovery.sql and while
-- no show is live. Compatible with the frozen classic app (branch talk-2024).
-- See docs/rock-anthem-database.md for what each part does and how to roll back.

begin;

-- 1. One vote per song per person, one song per mashup spot per person.
-- Duplicates would block the constraints, so remove them first, keeping the
-- oldest row. On 14 Oct 2026 production had none (88 votes, 0 duplicates).
delete from public.votes v
using public.votes older
where older.userid = v.userid and older.songid = v.songid and older.id < v.id;

delete from public.votes v
using public.votes older
where v.mashup_spot is not null
  and older.userid = v.userid and older.mashup_spot = v.mashup_spot and older.id < v.id;

alter table public.votes
  add constraint votes_user_song_key unique (userid, songid);
create unique index votes_user_spot_key on public.votes (userid, mashup_spot)
  where mashup_spot is not null;
alter table public.votes
  add constraint votes_mashup_spot_range check (mashup_spot is null or mashup_spot between 1 and 4);

-- 2. The vote cap lives in the database, so no client can vote past it.
-- Regular votes (no mashup spot) are capped by config key 'max_votes'
-- (default 5, matching NUXT_MAX_VOTES). Mashup votes are already limited to
-- four by the spot range and the one-song-per-spot index above.
insert into public.config (key, val)
select 'max_votes', '5'
where not exists (select 1 from public.config where key = 'max_votes');

create or replace function public.enforce_vote_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cap integer;
  used integer;
begin
  if new.mashup_spot is not null then
    return new;
  end if;
  -- Serialise this voter's inserts so two fast taps cannot both slip under the cap.
  perform pg_advisory_xact_lock(hashtext('votes:' || new.userid));
  select coalesce(max(val::integer), 5) into cap
    from public.config where key = 'max_votes' and val ~ '^[0-9]+$';
  select count(*) into used
    from public.votes where userid = new.userid and mashup_spot is null;
  if used >= cap then
    raise exception 'vote limit reached' using errcode = 'P0001', hint = 'Remove a vote to pick another song.';
  end if;
  return new;
end;
$$;

create trigger votes_enforce_cap
  before insert on public.votes
  for each row execute function public.enforce_vote_cap();

-- 3. Email addresses leave the public votes table. Both apps still send an
-- email on insert; this trigger moves it into a private schema the API does
-- not expose and stores null in votes. select('*') on votes keeps working.
create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.voter_emails (
  userid text primary key,
  email text not null,
  updated_at timestamptz not null default now()
);
revoke all on private.voter_emails from public;

create or replace function public.divert_vote_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null and new.email <> '' then
    insert into private.voter_emails (userid, email)
    values (new.userid, new.email)
    on conflict (userid) do update set email = excluded.email, updated_at = now();
  end if;
  new.email := null;
  return new;
end;
$$;
revoke all on function public.divert_vote_email() from public;

create trigger votes_divert_email
  before insert or update of email on public.votes
  for each row execute function public.divert_vote_email();

-- Move the emails already stored, then clear them from votes.
insert into private.voter_emails (userid, email)
select distinct on (userid) userid, email
from public.votes
where email is not null and email <> ''
order by userid, id desc
on conflict (userid) do update set email = excluded.email, updated_at = now();

update public.votes set email = null where email is not null;

-- 4. Atomic mashup vote: replace whatever this voter had in the spot (and
-- this song in any other spot) in one transaction. Runs with the caller's
-- rights, so the existing row-level security still applies.
create or replace function public.mashup_vote(p_songid text, p_spot integer, p_avatar text default '')
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  voter text := auth.uid()::text;
begin
  if voter is null then
    raise exception 'sign in to vote' using errcode = '28000';
  end if;
  if p_spot is null or p_spot not between 1 and 4 then
    raise exception 'mashup spot must be between 1 and 4' using errcode = '22023';
  end if;
  delete from public.votes
    where userid = voter and (mashup_spot = p_spot or songid = p_songid);
  insert into public.votes (userid, songid, mashup_spot, user_avatar, email)
    values (voter, p_songid, p_spot, coalesce(p_avatar, ''), auth.jwt() ->> 'email');
end;
$$;
revoke all on function public.mashup_vote(text, integer, text) from public, anon;
grant execute on function public.mashup_vote(text, integer, text) to authenticated;

-- 5. Permanent avatars. Provider URLs (LinkedIn especially) expire, so the app
-- copies each voter's avatar here once per session. Public read; only the
-- server (service role) writes, so there are no insert or update policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

commit;

notify pgrst, 'reload schema';

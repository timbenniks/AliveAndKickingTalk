-- Rock Anthem: show phase for audience participation.
-- Adds the config row 'show_phase' ('idle' | 'playing' | 'encore:<ISO time>').
-- Only the host writes it (existing admin-only RLS on config); phones read it
-- through realtime. Additive and safe to run twice. The classic talk reads
-- config only by key, so an extra row is invisible to it.

begin;

insert into public.config (key, val)
select 'show_phase', 'idle'
where not exists (select 1 from public.config where key = 'show_phase');

commit;

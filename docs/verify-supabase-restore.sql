-- Read-only checks. Run before allowing new traffic; counts are snapshot values.
SELECT 'auth.users' AS relation, count(*) AS actual, 936 AS expected FROM auth.users
UNION ALL SELECT 'auth.identities', count(*), 948 FROM auth.identities
UNION ALL SELECT 'public.config', count(*), 2 FROM public.config
UNION ALL SELECT 'public.votes', count(*), 83 FROM public.votes
UNION ALL SELECT 'public.shares', count(*), 304 FROM public.shares
UNION ALL SELECT 'public.songs_played', count(*), 0 FROM public.songs_played
UNION ALL SELECT 'storage.buckets', count(*), 0 FROM storage.buckets
UNION ALL SELECT 'storage.objects', count(*), 0 FROM storage.objects;

SELECT key, val FROM public.config ORDER BY key;
SELECT * FROM public.votes_per_song ORDER BY songid;
SELECT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'c9d34b15-6255-4500-9396-9f18f350073d'
) AS original_admin_preserved;

-- Source values: config 11, shares 322, songs_played 388, votes 36506.
SELECT sequencename, last_value FROM pg_sequences
WHERE schemaname = 'public' ORDER BY sequencename;

SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
SELECT pubname, pubinsert, pubupdate, pubdelete, pubtruncate
FROM pg_publication WHERE pubname = 'supabase_realtime';
SELECT schemaname, tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' ORDER BY tablename;

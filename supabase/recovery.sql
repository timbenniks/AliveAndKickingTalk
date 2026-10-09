-- Apply after restoring the app tables. Preserve the original administrator UUID.
DROP POLICY IF EXISTS "Auth can do it" ON public.shares;
DROP POLICY IF EXISTS "Auth can do it" ON public.songs_played;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.votes;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.votes;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.config;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.votes;
DROP POLICY IF EXISTS "anon can read" ON public.shares;
DROP POLICY IF EXISTS "auth and anon can do it" ON public.config;

CREATE POLICY config_read ON public.config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY config_admin ON public.config FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = 'c9d34b15-6255-4500-9396-9f18f350073d'::uuid)
  WITH CHECK ((SELECT auth.uid()) = 'c9d34b15-6255-4500-9396-9f18f350073d'::uuid);
CREATE POLICY played_read ON public.songs_played FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY played_admin ON public.songs_played FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = 'c9d34b15-6255-4500-9396-9f18f350073d'::uuid)
  WITH CHECK ((SELECT auth.uid()) = 'c9d34b15-6255-4500-9396-9f18f350073d'::uuid);
CREATE POLICY votes_read ON public.votes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY votes_insert_own ON public.votes FOR INSERT TO authenticated
  WITH CHECK (userid = (SELECT auth.uid())::text);
CREATE POLICY votes_delete_own_or_admin ON public.votes FOR DELETE TO authenticated
  USING (userid = (SELECT auth.uid())::text OR (SELECT auth.uid()) = 'c9d34b15-6255-4500-9396-9f18f350073d'::uuid);
CREATE POLICY shares_read ON public.shares FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY shares_insert_own ON public.shares FOR INSERT TO authenticated
  WITH CHECK (userid = (SELECT auth.uid())::text);
CREATE POLICY shares_admin ON public.shares FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = 'c9d34b15-6255-4500-9396-9f18f350073d'::uuid)
  WITH CHECK ((SELECT auth.uid()) = 'c9d34b15-6255-4500-9396-9f18f350073d'::uuid);

-- RLS does not protect TRUNCATE. Replace the old blanket grants.
REVOKE ALL ON public.config, public.shares, public.songs_played, public.votes FROM anon, authenticated;
GRANT SELECT ON public.config, public.shares, public.songs_played, public.votes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.config, public.shares, public.songs_played, public.votes TO authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
REVOKE ALL ON public.votes_per_song FROM anon, authenticated;
GRANT SELECT ON public.votes_per_song TO anon, authenticated;
ALTER VIEW public.votes_per_song SET (security_invoker = true);

ALTER PUBLICATION supabase_realtime SET (publish = 'insert, update, delete');
ALTER PUBLICATION supabase_realtime ADD TABLE public.config, public.votes, public.songs_played;
NOTIFY pgrst, 'reload schema';

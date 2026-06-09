-- Remove writeups and comments from Realtime publication to prevent
-- leaking flag column and private comment bodies to broad subscribers.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='writeups') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.writeups';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='comments') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.comments';
  END IF;
END $$;

-- Hide team_id from anonymous viewers of profiles. Authenticated users
-- still see it for team features.
REVOKE SELECT (team_id) ON public.profiles FROM anon;
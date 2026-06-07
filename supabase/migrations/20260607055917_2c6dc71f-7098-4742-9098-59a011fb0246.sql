
-- 1. Restrict writeup_tags SELECT to mirror writeups visibility
DROP POLICY IF EXISTS "writeup_tags read all" ON public.writeup_tags;
CREATE POLICY "writeup_tags read if writeup visible"
  ON public.writeup_tags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.writeups w
      WHERE w.id = writeup_tags.writeup_id
        AND (
          w.is_published
          OR w.author_id = auth.uid()
          OR (w.team_id IS NOT NULL AND public.is_team_member(w.team_id))
        )
    )
  );

-- 2. Column-level: hide sensitive columns from anonymous role
REVOKE SELECT (flag) ON public.writeups FROM anon;
REVOKE SELECT (invite_code) ON public.teams FROM anon;

-- 3. Lock down realtime.messages (broadcast/presence) — deny all
--    postgres_changes uses replication, not realtime.messages, so this is safe.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny all broadcast/presence" ON realtime.messages;
CREATE POLICY "deny all broadcast/presence"
  ON realtime.messages
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- 4. Revoke EXECUTE on internal SECURITY DEFINER helpers from clients.
--    Trigger functions and RLS helpers are invoked internally by Postgres
--    and do not need direct client EXECUTE privileges.
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_team_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_team_member(uuid) FROM PUBLIC, anon;

-- Keep join_team_by_code callable by signed-in users (used by /join/:code page)
REVOKE EXECUTE ON FUNCTION public.join_team_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_team_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid) TO authenticated;

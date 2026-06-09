
-- 1) challenge_attempts
CREATE TYPE public.challenge_status AS ENUM ('unsolved', 'attempting', 'solved');

CREATE TABLE public.challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ctf_events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  challenge_name text NOT NULL,
  category public.category NOT NULL DEFAULT 'misc',
  points integer,
  status public.challenge_status NOT NULL DEFAULT 'unsolved',
  claimed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  writeup_id uuid REFERENCES public.writeups(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX challenge_attempts_event_team_idx ON public.challenge_attempts(event_id, team_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_attempts TO authenticated;
GRANT ALL ON public.challenge_attempts TO service_role;

ALTER TABLE public.challenge_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenge_attempts read team"   ON public.challenge_attempts FOR SELECT TO authenticated USING (public.is_team_member(team_id));
CREATE POLICY "challenge_attempts insert team" ON public.challenge_attempts FOR INSERT TO authenticated WITH CHECK (public.is_team_member(team_id));
CREATE POLICY "challenge_attempts update team" ON public.challenge_attempts FOR UPDATE TO authenticated USING (public.is_team_member(team_id)) WITH CHECK (public.is_team_member(team_id));
CREATE POLICY "challenge_attempts delete team" ON public.challenge_attempts FOR DELETE TO authenticated USING (public.is_team_member(team_id));

CREATE TRIGGER challenge_attempts_updated
  BEFORE UPDATE ON public.challenge_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) writeups.publish_at
ALTER TABLE public.writeups ADD COLUMN publish_at timestamptz;
CREATE INDEX writeups_publish_at_idx ON public.writeups(publish_at) WHERE publish_at IS NOT NULL AND is_published = false;

-- 3) comments.parent_id + new INSERT policy supporting replies
ALTER TABLE public.comments ADD COLUMN parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;
CREATE INDEX comments_parent_idx ON public.comments(parent_id);

DROP POLICY IF EXISTS "comments insert auth" ON public.comments;
CREATE POLICY "comments insert auth" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.writeups w
      WHERE w.id = writeup_id
        AND (w.is_published OR w.author_id = auth.uid() OR (w.team_id IS NOT NULL AND public.is_team_member(w.team_id)))
    )
    AND (
      parent_id IS NULL
      OR EXISTS (SELECT 1 FROM public.comments p WHERE p.id = parent_id AND p.writeup_id = comments.writeup_id)
    )
  );

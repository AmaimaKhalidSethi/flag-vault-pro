
-- Fix broken parent_id check on comments insert policy
DROP POLICY IF EXISTS "comments insert auth" ON public.comments;
CREATE POLICY "comments insert auth" ON public.comments
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (
    SELECT 1 FROM public.writeups w
    WHERE w.id = comments.writeup_id
      AND (w.is_published OR w.author_id = auth.uid() OR (w.team_id IS NOT NULL AND public.is_team_member(w.team_id)))
  )
  AND (
    parent_id IS NULL OR EXISTS (
      SELECT 1 FROM public.comments p
      WHERE p.id = comments.parent_id
        AND p.writeup_id = comments.writeup_id
    )
  )
);

-- Allow event creators to delete their own events
CREATE POLICY "ctf_events delete own" ON public.ctf_events
FOR DELETE TO authenticated
USING (auth.uid() = created_by);

-- Allow team owners to delete their own teams
CREATE POLICY "teams delete own" ON public.teams
FOR DELETE TO authenticated
USING (auth.uid() = owner_id);


CREATE TABLE public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  writeup_id uuid NOT NULL REFERENCES public.writeups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('🔥','🤯','👀')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (writeup_id, user_id, emoji)
);
GRANT SELECT ON public.reactions TO anon;
GRANT SELECT, INSERT, DELETE ON public.reactions TO authenticated;
GRANT ALL ON public.reactions TO service_role;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions read on visible writeups" ON public.reactions
FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.writeups w
  WHERE w.id = reactions.writeup_id
    AND (w.is_published OR w.author_id = auth.uid() OR (w.team_id IS NOT NULL AND public.is_team_member(w.team_id)))
));

CREATE POLICY "reactions insert own" ON public.reactions
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reactions delete own" ON public.reactions
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX reactions_writeup_idx ON public.reactions(writeup_id);

CREATE TABLE public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  writeup_id uuid NOT NULL REFERENCES public.writeups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, writeup_id)
);
GRANT SELECT, INSERT, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookmarks read own" ON public.bookmarks
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "bookmarks insert own" ON public.bookmarks
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookmarks delete own" ON public.bookmarks
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX bookmarks_user_idx ON public.bookmarks(user_id);

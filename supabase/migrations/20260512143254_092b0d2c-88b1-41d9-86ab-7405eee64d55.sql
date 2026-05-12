
-- Add tags array to writeups for simple tag chip storage (mirrors writeup_tags but flat)
ALTER TABLE public.writeups
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- Full-text search column on writeups (title + body)
ALTER TABLE public.writeups
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body_md, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS writeups_search_tsv_idx ON public.writeups USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS writeups_tags_idx ON public.writeups USING GIN (tags);

-- Allow team owner to remove a member from their team
CREATE OR REPLACE FUNCTION public.remove_team_member(_target uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _team uuid;
  _owner uuid;
BEGIN
  SELECT team_id INTO _team FROM public.profiles WHERE id = _target;
  IF _team IS NULL THEN RETURN false; END IF;
  SELECT owner_id INTO _owner FROM public.teams WHERE id = _team;
  IF _owner <> auth.uid() THEN RAISE EXCEPTION 'not team owner'; END IF;
  IF _target = _owner THEN RAISE EXCEPTION 'cannot remove owner'; END IF;
  UPDATE public.profiles SET team_id = NULL WHERE id = _target;
  RETURN true;
END;
$$;

-- Team-scoped invite: lookup team by invite_code (used by /join/$code)
CREATE OR REPLACE FUNCTION public.join_team_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _team uuid;
BEGIN
  SELECT id INTO _team FROM public.teams WHERE invite_code = _code;
  IF _team IS NULL THEN RAISE EXCEPTION 'invalid invite code'; END IF;
  UPDATE public.profiles SET team_id = _team WHERE id = auth.uid();
  RETURN _team;
END;
$$;

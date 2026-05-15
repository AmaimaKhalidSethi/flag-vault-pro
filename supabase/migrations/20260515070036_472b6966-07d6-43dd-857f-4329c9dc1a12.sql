
-- 1. user_integrations table for syndication tokens
CREATE TABLE IF NOT EXISTS public.user_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('github','medium','devto')),
  token text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_integrations select own" ON public.user_integrations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_integrations insert own" ON public.user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_integrations update own" ON public.user_integrations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_integrations delete own" ON public.user_integrations
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER user_integrations_set_updated_at
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Realtime replication
ALTER TABLE public.writeups REPLICA IDENTITY FULL;
ALTER TABLE public.ctf_events REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.writeups;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ctf_events;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

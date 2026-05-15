import { supabase } from "@/integrations/supabase/client";

export type Provider = "github" | "medium" | "devto";

export type IntegrationRow = {
  id: string;
  user_id: string;
  provider: Provider;
  token: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export const PROVIDER_META: Record<
  Provider,
  { label: string; help: string; placeholder: string; tokenUrl: string }
> = {
  github: {
    label: "GitHub",
    help: "Personal Access Token with `repo` scope.",
    placeholder: "ghp_…",
    tokenUrl: "https://github.com/settings/tokens/new?scopes=repo&description=Flagvault",
  },
  medium: {
    label: "Medium",
    help: "Integration token from medium.com/me/settings/security.",
    placeholder: "2…",
    tokenUrl: "https://medium.com/me/settings/security",
  },
  devto: {
    label: "Dev.to",
    help: "API key from dev.to/settings/extensions.",
    placeholder: "…",
    tokenUrl: "https://dev.to/settings/extensions",
  },
};

// Pseudo-typed table accessor — types.ts is regenerated lazily.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = () => (supabase as any).from("user_integrations");

export async function listIntegrations(): Promise<IntegrationRow[]> {
  const { data, error } = await T().select("*");
  if (error) throw error;
  return (data ?? []) as IntegrationRow[];
}

export async function getIntegration(provider: Provider): Promise<IntegrationRow | null> {
  const { data, error } = await T().select("*").eq("provider", provider).maybeSingle();
  if (error) throw error;
  return (data ?? null) as IntegrationRow | null;
}

export async function saveIntegration(
  provider: Provider,
  token: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { error } = await T().upsert(
    { user_id: u.user.id, provider, token, metadata },
    { onConflict: "user_id,provider" },
  );
  if (error) throw error;
}

export async function removeIntegration(provider: Provider): Promise<void> {
  const { error } = await T().delete().eq("provider", provider);
  if (error) throw error;
}

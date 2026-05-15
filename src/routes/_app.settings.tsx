import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { KeyRound, Palette, Github, BookOpen, Hash, Check, Loader2, ExternalLink } from "lucide-react";
import { getAnthropicKey, setAnthropicKey, maskKey } from "@/lib/ai";
import {
  PROVIDER_META,
  listIntegrations,
  saveIntegration,
  removeIntegration,
  type Provider,
  type IntegrationRow,
} from "@/lib/integrations";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Flagvault" }] }),
  component: SettingsPage,
});

const ICONS: Record<Provider, React.ComponentType<{ className?: string }>> = {
  github: Github,
  medium: BookOpen,
  devto: Hash,
};

function IntegrationCard({
  provider,
  current,
  onChange,
}: {
  provider: Provider;
  current: IntegrationRow | null;
  onChange: () => void;
}) {
  const meta = PROVIDER_META[provider];
  const Icon = ICONS[provider];
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const connected = !!current;

  async function connect() {
    if (!token.trim()) return toast.error("Enter a token");
    setBusy(true);
    try {
      await saveIntegration(provider, token.trim());
      toast.success(`${meta.label} connected`);
      setToken("");
      onChange();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    setBusy(true);
    try {
      await removeIntegration(provider);
      toast.success(`${meta.label} disconnected`);
      onChange();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-md border border-border flex items-center justify-center bg-muted">
            <Icon className="size-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{meta.label}</h3>
            <p className="text-[11px] text-muted-foreground">{meta.help}</p>
          </div>
        </div>
        {connected ? (
          <Badge className="bg-success/15 text-success border border-success/30 mono text-[10px]">
            <Check className="size-3 mr-1" />Connected
          </Badge>
        ) : (
          <Badge variant="outline" className="mono text-[10px]">Not linked</Badge>
        )}
      </div>

      {connected ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground mono">{maskKey(current!.token)}</span>
          <Button size="sm" variant="outline" onClick={disconnect} disabled={busy}>
            {busy ? <Loader2 className="size-3 mr-1 animate-spin" /> : null}Disconnect
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <Input
            type="password"
            value={token}
            placeholder={meta.placeholder}
            onChange={(e) => setToken(e.target.value)}
            className="mono text-xs"
          />
          <div className="flex items-center justify-between gap-2">
            <a href={meta.tokenUrl} target="_blank" rel="noreferrer"
               className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
              Get token <ExternalLink className="size-3" />
            </a>
            <Button size="sm" onClick={connect} disabled={busy || !token.trim()}>
              {busy ? <Loader2 className="size-3 mr-1 animate-spin" /> : null}Connect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsPage() {
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("");
  const [apiKey, setKey] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);

  async function refreshIntegrations() {
    try { setIntegrations(await listIntegrations()); }
    catch (e) { console.error(e); }
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const { data: p } = await supabase.from("profiles").select("username, avatar_url").eq("id", data.session.user.id).maybeSingle();
      if (p) { setUsername(p.username ?? ""); setAvatar(p.avatar_url ?? ""); }
      const k = getAnthropicKey();
      setSavedKey(k);
      setKey(k ?? "");
      await refreshIntegrations();
    })();
  }, []);

  async function saveProfile() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase.from("profiles").update({ username, avatar_url: avatar || null }).eq("id", data.user.id);
    if (error) toast.error(error.message); else toast.success("Profile saved");
  }
  function saveKey() {
    setAnthropicKey(apiKey);
    setSavedKey(apiKey || null);
    toast.success(apiKey ? "API key saved (locally only)" : "API key cleared");
  }

  const byProvider = (p: Provider) => integrations.find((i) => i.provider === p) ?? null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <p className="mono text-xs text-primary">~/settings</p>
      <h1 className="text-2xl font-semibold mt-1">Settings</h1>

      <section className="bg-card border border-border rounded-lg p-5 mt-5">
        <h2 className="font-semibold">Profile</h2>
        <div className="mt-3 space-y-3">
          <div><Label>Username</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <div><Label>Avatar URL</Label><Input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" /></div>
          <Button onClick={saveProfile}>Save profile</Button>
        </div>
      </section>

      <section className="mt-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-semibold">Integrations</h2>
            <p className="text-xs text-muted-foreground">Link external platforms to syndicate writeups in one click.</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <IntegrationCard provider="github" current={byProvider("github")} onChange={refreshIntegrations} />
          <IntegrationCard provider="medium" current={byProvider("medium")} onChange={refreshIntegrations} />
          <IntegrationCard provider="devto" current={byProvider("devto")} onChange={refreshIntegrations} />
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-5 mt-4">
        <h2 className="font-semibold flex items-center gap-2"><KeyRound className="size-4 text-primary" /> Anthropic API key</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Stored only in your browser localStorage. Never sent to the server.
          {savedKey && <> Current: <span className="mono text-primary">{maskKey(savedKey)}</span></>}
        </p>
        <div className="mt-3 space-y-2">
          <Label>Anthropic API key</Label>
          <Input type="password" value={apiKey} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" className="mono" />
          <Button onClick={saveKey} variant="outline">Save key</Button>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-5 mt-4 opacity-70">
        <h2 className="font-semibold flex items-center gap-2"><Palette className="size-4" /> Theme</h2>
        <p className="text-xs text-muted-foreground mt-1">Toggle light/dark from the sidebar.</p>
      </section>
    </div>
  );
}

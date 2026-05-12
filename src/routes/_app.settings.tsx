import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Palette } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Flagvault" }] }),
  component: SettingsPage,
});

const KEY_STORAGE = "flagvault.anthropic_key";

function SettingsPage() {
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const { data: p } = await supabase.from("profiles").select("username, avatar_url").eq("id", data.session.user.id).maybeSingle();
      if (p) { setUsername(p.username ?? ""); setAvatar(p.avatar_url ?? ""); }
      setApiKey(localStorage.getItem(KEY_STORAGE) ?? "");
    })();
  }, []);

  async function saveProfile() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase.from("profiles").update({ username, avatar_url: avatar || null }).eq("id", data.user.id);
    if (error) toast.error(error.message); else toast.success("Profile saved");
  }
  function saveKey() {
    if (apiKey) localStorage.setItem(KEY_STORAGE, apiKey);
    else localStorage.removeItem(KEY_STORAGE);
    toast.success("API key updated (stored locally only)");
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
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

      <section className="bg-card border border-border rounded-lg p-5 mt-4">
        <h2 className="font-semibold flex items-center gap-2"><KeyRound className="size-4 text-primary" /> AI API keys</h2>
        <p className="text-xs text-muted-foreground mt-1">Stored only in your browser localStorage. Never sent to the server.</p>
        <div className="mt-3 space-y-2">
          <Label>Anthropic API key</Label>
          <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-ant-…" className="mono" />
          <Button onClick={saveKey} variant="outline">Save key</Button>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-5 mt-4 opacity-70">
        <h2 className="font-semibold flex items-center gap-2"><Palette className="size-4" /> Theme</h2>
        <p className="text-xs text-muted-foreground mt-1">Dark only — designed for late-night CTF sessions.</p>
      </section>
    </div>
  );
}

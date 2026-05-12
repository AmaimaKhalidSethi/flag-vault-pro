import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const nav = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<"username" | "team">("username");
  const [username, setUsername] = useState("");
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { nav({ to: "/auth" }); return; }
      setUserId(data.session.user.id);
      const { data: prof } = await supabase.from("profiles").select("username, team_id").eq("id", data.session.user.id).maybeSingle();
      if (prof?.username) {
        setUsername(prof.username);
        if (prof.team_id) { nav({ to: "/dashboard" }); return; }
        setStep("team");
      }
    });
  }, [nav]);

  async function saveUsername(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ username }).eq("id", userId);
    setBusy(false);
    if (error) return toast.error(error.message);
    setStep("team");
  }

  async function createTeam() {
    if (!userId || !teamName) return;
    setBusy(true);
    const slug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    const { data, error } = await supabase.from("teams").insert({ name: teamName, slug, owner_id: userId }).select().single();
    if (error) { setBusy(false); return toast.error(error.message); }
    await supabase.from("profiles").update({ team_id: data.id }).eq("id", userId);
    setBusy(false);
    toast.success("Team created");
    nav({ to: "/dashboard" });
  }

  async function joinTeam() {
    if (!userId || !inviteCode) return;
    setBusy(true);
    const { data, error } = await supabase.from("teams").select("id").eq("invite_code", inviteCode.trim()).maybeSingle();
    if (error || !data) { setBusy(false); return toast.error("Invalid invite code"); }
    await supabase.from("profiles").update({ team_id: data.id }).eq("id", userId);
    setBusy(false);
    toast.success("Joined team");
    nav({ to: "/dashboard" });
  }

  async function skip() {
    nav({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-grid">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6">
        <div className="mono text-xs text-primary">~/onboarding</div>
        {step === "username" ? (
          <>
            <h1 className="text-xl font-semibold mt-2">Pick a username</h1>
            <p className="text-sm text-muted-foreground mt-1">This is how teammates will recognize you.</p>
            <form onSubmit={saveUsername} className="mt-5 space-y-3">
              <div>
                <Label>Username</Label>
                <Input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="r00t" />
              </div>
              <Button disabled={busy || !username} className="w-full">Continue</Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold mt-2">Create or join a team</h1>
            <p className="text-sm text-muted-foreground mt-1">Teams share writeups and stats.</p>
            <div className="mt-5 space-y-4">
              <div className="border border-border rounded-md p-4">
                <Label>New team name</Label>
                <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="rev_squad" />
                <Button disabled={busy || !teamName} onClick={createTeam} className="mt-3 w-full">Create team</Button>
              </div>
              <div className="border border-border rounded-md p-4">
                <Label>Invite code</Label>
                <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="abc123def456" className="mono" />
                <Button variant="outline" disabled={busy || !inviteCode} onClick={joinTeam} className="mt-3 w-full">Join team</Button>
              </div>
              <button onClick={skip} className="text-sm text-muted-foreground hover:text-foreground w-full text-center">
                Skip for now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

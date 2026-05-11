import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/team")({
  head: () => ({ meta: [{ title: "Team — Flagvault" }] }),
  component: TeamPage,
});

type Team = { id: string; name: string; slug: string; invite_code: string; owner_id: string };
type Member = { id: string; username: string | null; avatar_url: string | null };

function TeamPage() {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    (async () => {
      const { data: ses } = await supabase.auth.getSession();
      if (!ses.session) return;
      setMeId(ses.session.user.id);
      const { data: prof } = await supabase.from("profiles").select("team_id").eq("id", ses.session.user.id).maybeSingle();
      if (!prof?.team_id) return;
      const { data: t } = await supabase.from("teams").select("*").eq("id", prof.team_id).maybeSingle();
      setTeam(t as Team | null);
      if (t) setName(t.name);
      const { data: ms } = await supabase.from("profiles").select("id, username, avatar_url").eq("team_id", prof.team_id);
      setMembers((ms ?? []) as Member[]);
    })();
  }, []);

  async function rename() {
    if (!team) return;
    const { error } = await supabase.from("teams").update({ name }).eq("id", team.id);
    if (error) toast.error(error.message); else toast.success("Team renamed");
  }
  function copyInvite() {
    if (!team) return;
    navigator.clipboard.writeText(team.invite_code);
    toast.success("Invite code copied");
  }

  if (!team) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">No team yet</h1>
        <p className="text-muted-foreground mt-2 text-sm">Join or create one from your profile.</p>
      </div>
    );
  }

  const isOwner = meId === team.owner_id;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <p className="mono text-xs text-primary">~/team</p>
      <h1 className="text-2xl font-semibold mt-1">{team.name}</h1>

      <div className="bg-card border border-border rounded-lg p-5 mt-5">
        <h2 className="font-semibold">Invite</h2>
        <p className="text-xs text-muted-foreground mt-1">Share this code so teammates can join.</p>
        <div className="mt-3 flex items-center gap-2">
          <code className="mono text-sm bg-muted border border-border rounded px-3 py-2 flex-1">{team.invite_code}</code>
          <Button variant="outline" onClick={copyInvite}><Copy className="size-4" /></Button>
        </div>
      </div>

      {isOwner && (
        <div className="bg-card border border-border rounded-lg p-5 mt-4">
          <h2 className="font-semibold">Settings</h2>
          <div className="mt-3 flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Button onClick={rename}>Save</Button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-5 mt-4">
        <h2 className="font-semibold">Members ({members.length})</h2>
        <ul className="mt-3 divide-y divide-border">
          {members.map(m => (
            <li key={m.id} className="py-2 flex items-center gap-3">
              <div className="size-8 rounded-full bg-muted grid place-items-center mono text-xs">
                {m.avatar_url ? <img src={m.avatar_url} alt="" className="size-8 rounded-full" /> : (m.username ?? "?")[0]}
              </div>
              <span className="text-sm">@{m.username ?? "anon"}</span>
              {m.id === team.owner_id && <span className="text-[10px] mono text-primary border border-primary/30 rounded px-1.5 ml-auto">owner</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

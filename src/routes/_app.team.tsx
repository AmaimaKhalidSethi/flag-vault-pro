import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, UserMinus, Link2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/team")({
  head: () => ({ meta: [{ title: "Team — Flagvault" }] }),
  component: TeamPage,
});

type Team = { id: string; name: string; slug: string; invite_code: string; owner_id: string };
type Member = { id: string; username: string | null; avatar_url: string | null; created_at: string };

function TeamPage() {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: ses } = await supabase.auth.getSession();
    if (!ses.session) return;
    setMeId(ses.session.user.id);
    const { data: prof } = await supabase.from("profiles").select("team_id").eq("id", ses.session.user.id).maybeSingle();
    if (!prof?.team_id) { setLoading(false); return; }
    const { data: t } = await supabase.from("teams").select("*").eq("id", prof.team_id).maybeSingle();
    setTeam(t as Team | null);
    if (t) setName(t.name);
    const { data: ms } = await supabase.from("profiles").select("id, username, avatar_url, created_at").eq("team_id", prof.team_id);
    setMembers((ms ?? []) as Member[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function rename() {
    if (!team) return;
    const { error } = await supabase.from("teams").update({ name }).eq("id", team.id);
    if (error) toast.error(error.message); else toast.success("Team renamed");
  }
  function copyLink() {
    if (!team) return;
    const url = `${window.location.origin}/join/${team.invite_code}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  }
  function copyCode() {
    if (!team) return;
    navigator.clipboard.writeText(team.invite_code);
    toast.success("Invite code copied");
  }
  async function removeMember(uid: string) {
    if (!confirm("Remove this member from the team?")) return;
    const { error } = await supabase.rpc("remove_team_member", { _target: uid });
    if (error) toast.error(error.message);
    else { toast.success("Member removed"); load(); }
  }

  if (loading) return <div className="p-6 mono text-sm text-muted-foreground">loading…</div>;

  if (!team) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold">No team yet</h1>
        <p className="text-muted-foreground mt-2 text-sm">Create or join a team from your <a href="/onboarding" className="text-primary hover:underline">onboarding</a>.</p>
      </div>
    );
  }

  const isOwner = meId === team.owner_id;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <p className="mono text-xs text-primary">~/team</p>
      <div className="flex items-center justify-between mt-1 gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">{team.name}</h1>
        <Link to="/teams/$slug/stats" params={{ slug: team.slug }}>
          <Button variant="outline" size="sm"><BarChart3 className="size-4 mr-1.5" />Stats</Button>
        </Link>
      </div>


      <div className="bg-card border border-border rounded-lg p-5 mt-5">
        <h2 className="font-semibold">Invite</h2>
        <p className="text-xs text-muted-foreground mt-1">Share the invite link with teammates so they can join.</p>
        <div className="mt-3 flex items-center gap-2">
          <code className="mono text-xs bg-muted border border-border rounded px-3 py-2 flex-1 truncate">
            {`${typeof window !== "undefined" ? window.location.origin : ""}/join/${team.invite_code}`}
          </code>
          <Button variant="outline" onClick={copyLink}><Link2 className="size-4 mr-1" />Copy link</Button>
          <Button variant="outline" onClick={copyCode}><Copy className="size-4" /></Button>
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
          {members.map(m => {
            const isMemberOwner = m.id === team.owner_id;
            return (
              <li key={m.id} className="py-2 flex items-center gap-3">
                <div className="size-8 rounded-full bg-muted grid place-items-center mono text-xs">
                  {m.avatar_url ? <img src={m.avatar_url} alt="" className="size-8 rounded-full" /> : (m.username ?? "?")[0]}
                </div>
                <div className="flex-1">
                  <div className="text-sm">@{m.username ?? "anon"}</div>
                  <div className="text-[10px] text-muted-foreground mono">joined {format(new Date(m.created_at), "MMM d, yyyy")}</div>
                </div>
                <span className={`text-[10px] mono rounded px-1.5 ${isMemberOwner ? "text-primary border border-primary/30" : "text-muted-foreground border border-border"}`}>
                  {isMemberOwner ? "owner" : "member"}
                </span>
                {isOwner && !isMemberOwner && (
                  <button onClick={() => removeMember(m.id)} title="Remove" className="text-muted-foreground hover:text-danger ml-2">
                    <UserMinus className="size-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

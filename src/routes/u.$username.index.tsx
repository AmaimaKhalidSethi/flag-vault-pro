import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryClass, difficultyClass, type Category, type Difficulty } from "@/lib/categories";
import { format, formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/u/$username/")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username} — Flagvault` }] }),
  component: PublicProfile,
});

type Profile = { id: string; username: string | null; avatar_url: string | null; created_at: string; team_id: string | null };
type Wu = {
  id: string; title: string; slug: string; summary: string | null;
  category: Category; difficulty: Difficulty; points: number; created_at: string;
};

function PublicProfile() {
  const { username } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [team, setTeam] = useState<string | null>(null);
  const [wus, setWus] = useState<Wu[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      if (!p) { setLoading(false); return; }
      setProfile(p as Profile);
      if (p.team_id) {
        const { data: t } = await supabase.from("teams").select("name").eq("id", p.team_id).maybeSingle();
        setTeam((t as { name: string } | null)?.name ?? null);
      }
      const { data: w } = await supabase.from("writeups")
        .select("id,title,slug,summary,category,difficulty,points,created_at")
        .eq("author_id", p.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      setWus((w ?? []) as Wu[]);
      setLoading(false);
    })();
  }, [username]);

  if (loading) return <div className="min-h-screen grid place-items-center mono text-sm text-muted-foreground">loading…</div>;
  if (!profile) return <div className="min-h-screen grid place-items-center">Profile not found.</div>;

  const totalPoints = wus.reduce((s, w) => s + w.points, 0);
  const catCounts = CATEGORIES.map(c => ({ c, n: wus.filter(w => w.category === c).length }));
  const top = catCounts.sort((a, b) => b.n - a.n)[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-7 rounded bg-primary text-primary-foreground grid place-items-center font-bold">F</div>
            <span className="font-semibold">Flagvault</span>
          </Link>
          <Link to="/auth" className="text-sm text-primary hover:underline">Sign in</Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-full bg-muted grid place-items-center mono text-xl">
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="size-16 rounded-full" /> : (profile.username ?? "?")[0]}
          </div>
          <div>
            <h1 className="text-2xl font-semibold">@{profile.username}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Member since {format(new Date(profile.created_at), "MMM yyyy")}
              {team && <> · Team <span className="text-primary">{team}</span></>}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6">
          <Stat label="Published" value={wus.length} />
          <Stat label="Total points" value={totalPoints} />
          <Stat label="Top category" value={top && top.n > 0 ? top.c : "—"} />
        </div>

        <h2 className="font-semibold mt-8 mb-3">Writeups</h2>
        {wus.length === 0 && <p className="text-sm text-muted-foreground">No published writeups yet.</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {wus.map(w => (
            <Link key={w.id} to="/u/$username/$slug" params={{ username: profile.username!, slug: w.slug }}
                  className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition group">
              <h3 className="font-semibold group-hover:text-primary line-clamp-2">{w.title}</h3>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{w.summary || "No summary."}</p>
              <div className="flex flex-wrap gap-1.5 mt-3 text-xs">
                <span className={`px-1.5 py-0.5 rounded ${categoryClass[w.category]}`}>{w.category}</span>
                <span className={`px-1.5 py-0.5 rounded ${difficultyClass[w.difficulty]}`}>{w.difficulty}</span>
                <span className="px-1.5 py-0.5 rounded border border-border text-muted-foreground mono">{w.points} pts</span>
              </div>
              <div className="text-xs text-muted-foreground mt-2">{formatDistanceToNow(new Date(w.created_at), { addSuffix: true })}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1 mono">{value}</div>
    </div>
  );
}

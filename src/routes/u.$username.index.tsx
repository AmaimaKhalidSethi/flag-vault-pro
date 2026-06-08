import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, DIFFICULTIES, categoryClass, difficultyClass, type Category, type Difficulty } from "@/lib/categories";
import { format, formatDistanceToNow, startOfMonth, subMonths } from "date-fns";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/u/$username/")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username} — Flagvault` }] }),
  component: PublicProfile,
});

type Profile = { id: string; username: string | null; avatar_url: string | null; created_at: string; team_id: string | null };
type Wu = {
  id: string; title: string; slug: string; summary: string | null;
  category: Category; difficulty: Difficulty; points: number; created_at: string;
};

const DIFF_COLORS: Record<Difficulty, string> = {
  easy:   "oklch(0.78 0.16 150)",
  medium: "oklch(0.78 0.16 80)",
  hard:   "oklch(0.78 0.18 55)",
  insane: "oklch(0.70 0.20 25)",
};

const CAT_COLORS: Record<Category, string> = {
  web:       "oklch(0.75 0.18 220)",
  pwn:       "oklch(0.70 0.20 25)",
  crypto:    "oklch(0.75 0.18 290)",
  forensics: "oklch(0.75 0.16 180)",
  rev:       "oklch(0.78 0.16 80)",
  misc:      "oklch(0.72 0.04 260)",
  osint:     "oklch(0.75 0.18 150)",
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

  const stats = useMemo(() => {
    const byCategory = CATEGORIES.map((c) => ({
      category: c,
      count: wus.filter((w) => w.category === c).length,
      color: CAT_COLORS[c],
    })).filter((r) => r.count > 0);

    const byDifficulty = DIFFICULTIES.map((d) => ({
      name: d,
      value: wus.filter((w) => w.difficulty === d).length,
      color: DIFF_COLORS[d],
    })).filter((r) => r.value > 0);

    // last 6 months sparkline of points earned
    const now = new Date();
    const buckets: { month: string; points: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = startOfMonth(subMonths(now, i));
      buckets.push({ month: format(m, "MMM"), points: 0 });
    }
    for (const w of wus) {
      const created = new Date(w.created_at);
      const diff = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
      if (diff >= 0 && diff <= 5) buckets[5 - diff].points += w.points;
    }
    return { byCategory, byDifficulty, sparkline: buckets };
  }, [wus]);

  if (loading) return <div className="min-h-screen grid place-items-center mono text-sm text-muted-foreground">loading…</div>;
  if (!profile) return <div className="min-h-screen grid place-items-center">Profile not found.</div>;

  const totalPoints = wus.reduce((s, w) => s + w.points, 0);
  const top = stats.byCategory.slice().sort((a, b) => b.count - a.count)[0];

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
          <Stat label="Top category" value={top ? top.category : "—"} />
        </div>

        {wus.length > 0 && (
          <section className="mt-8">
            <h2 className="font-semibold mb-3">Stats</h2>
            <div className="grid lg:grid-cols-3 gap-3">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-3">Writeups by category</div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.byCategory} layout="vertical" margin={{ left: 4, right: 8 }}>
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis type="category" dataKey="category" width={64} tick={{ fontSize: 11, fill: "currentColor" }} stroke="currentColor" className="text-muted-foreground" />
                      <Tooltip cursor={{ fill: "oklch(1 0 0 / 0.05)" }} contentStyle={{ background: "oklch(0.18 0.01 240)", border: "1px solid oklch(0.3 0.02 240)", borderRadius: 6, fontSize: 12 }} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {stats.byCategory.map((r) => <Cell key={r.category} fill={r.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-3">Difficulty mix</div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.byDifficulty} dataKey="value" nameKey="name" innerRadius={36} outerRadius={64} paddingAngle={2} stroke="none">
                        {stats.byDifficulty.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "oklch(0.18 0.01 240)", border: "1px solid oklch(0.3 0.02 240)", borderRadius: 6, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
                  {stats.byDifficulty.map((d) => (
                    <span key={d.name} className="text-[10px] mono flex items-center gap-1 text-muted-foreground">
                      <span className="inline-block size-2 rounded-full" style={{ background: d.color }} />
                      {d.name} {d.value}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-3">Points · last 6 months</div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.sparkline} margin={{ left: 4, right: 8, top: 8 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "currentColor" }} stroke="currentColor" className="text-muted-foreground" axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ background: "oklch(0.18 0.01 240)", border: "1px solid oklch(0.3 0.02 240)", borderRadius: 6, fontSize: 12 }} />
                      <Line type="monotone" dataKey="points" stroke="oklch(0.78 0.16 180)" strokeWidth={2} dot={{ r: 3, fill: "oklch(0.78 0.16 180)" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>
        )}

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

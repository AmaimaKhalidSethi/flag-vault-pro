import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryClass, type Category } from "@/lib/categories";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line,
} from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/_app/teams/$slug/stats")({
  head: () => ({ meta: [{ title: "Team stats — Flagvault" }] }),
  errorComponent: ({ reset }) => {
    const r = useRouter();
    return (
      <div className="p-6 text-sm">
        <p className="text-danger">Failed to load team stats.</p>
        <button onClick={() => { reset(); r.invalidate(); }} className="mt-2 text-primary underline">Retry</button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6 text-sm text-muted-foreground">Team not found, or you are not a member.</div>,
  component: TeamStats,
});

const FIVE_MIN = 5 * 60 * 1000;

type Wu = {
  id: string; title: string; category: Category; points: number;
  created_at: string; author_id: string; event_id: string | null;
  ctf_events: { name: string } | null;
};
type Member = { id: string; username: string | null; avatar_url: string | null };

function TeamStats() {
  const { slug } = Route.useParams();

  const team = useQuery({
    queryKey: ["team-by-slug", slug],
    staleTime: FIVE_MIN,
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("id, name, slug").eq("slug", slug).maybeSingle();
      return data as { id: string; name: string; slug: string } | null;
    },
  });

  const teamId = team.data?.id;

  const members = useQuery({
    queryKey: ["team-members", teamId],
    enabled: !!teamId,
    staleTime: FIVE_MIN,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, username, avatar_url").eq("team_id", teamId);
      return (data ?? []) as Member[];
    },
  });

  const writeups = useQuery({
    queryKey: ["team-stats-writeups", teamId],
    enabled: !!teamId,
    staleTime: FIVE_MIN,
    queryFn: async () => {
      const { data } = await supabase
        .from("writeups")
        .select("id, title, category, points, created_at, author_id, event_id, ctf_events:event_id(name)")
        .eq("team_id", teamId!)
        .eq("is_published", true);
      return (data ?? []) as unknown as Wu[];
    },
  });

  if (team.isLoading || members.isLoading || writeups.isLoading) {
    return <div className="p-6 mono text-xs text-muted-foreground">loading…</div>;
  }
  if (!team.data) {
    return <div className="p-6 text-sm text-muted-foreground">Team not found, or you are not a member.</div>;
  }

  const wus = writeups.data ?? [];
  const mems = members.data ?? [];

  const totalPoints = wus.reduce((s, w) => s + (w.points || 0), 0);
  const uniqueEvents = new Set(wus.map(w => w.event_id).filter(Boolean)).size;
  const uniqueCategories = new Set(wus.map(w => w.category)).size;

  const byEvent = Object.values(
    wus.reduce<Record<string, { name: string; points: number }>>((acc, w) => {
      const name = w.ctf_events?.name ?? "No event";
      acc[name] ??= { name, points: 0 };
      acc[name].points += w.points || 0;
      return acc;
    }, {})
  ).sort((a, b) => b.points - a.points);

  const byCategory = CATEGORIES.map(c => ({
    category: c,
    count: wus.filter(w => w.category === c).length,
  }));

  const memberStats = mems.map(m => {
    const mine = wus.filter(w => w.author_id === m.id);
    return { ...m, solves: mine.length, points: mine.reduce((s, w) => s + (w.points || 0), 0) };
  }).sort((a, b) => b.points - a.points);

  // 6-month cumulative
  const months: { month: string; points: number }[] = [];
  const today = startOfMonth(new Date());
  for (let i = 5; i >= 0; i--) {
    const m = startOfMonth(subMonths(today, i));
    months.push({ month: format(m, "MMM yy"), points: 0 });
  }
  let cum = 0;
  const monthIndex = new Map(months.map((m, i) => [m.month, i]));
  const sorted = [...wus].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  // First add cumulative from pre-window:
  const windowStart = startOfMonth(subMonths(today, 5));
  for (const w of sorted) {
    const d = new Date(w.created_at);
    if (d < windowStart) cum += w.points || 0;
  }
  for (let i = 0; i < months.length; i++) {
    const monthStart = startOfMonth(subMonths(today, 5 - i));
    const nextStart = startOfMonth(subMonths(today, 4 - i));
    const inMonth = sorted.filter(w => {
      const d = new Date(w.created_at);
      return d >= monthStart && d < nextStart;
    });
    cum += inMonth.reduce((s, w) => s + (w.points || 0), 0);
    months[i].points = cum;
  }
  void monthIndex;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <p className="mono text-xs text-primary">~/teams/{slug}/stats</p>
      <div className="flex items-center gap-2 mt-1">
        <Trophy className="size-5 text-primary" />
        <h1 className="text-2xl font-semibold">{team.data.name} — stats</h1>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
        <Stat label="Writeups published" value={wus.length} />
        <Stat label="Total points" value={totalPoints} />
        <Stat label="Events" value={uniqueEvents} />
        <Stat label="Categories" value={uniqueCategories} />
      </div>

      <Section title="Points by event">
        {byEvent.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={Math.max(120, byEvent.length * 36)}>
            <BarChart data={byEvent} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={140} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="points" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Section>

      <Section title="Top solvers">
        <ul className="divide-y divide-border">
          {memberStats.map((m, i) => (
            <li key={m.id} className="py-2 flex items-center gap-3">
              <span className="mono text-xs text-muted-foreground w-6">#{i + 1}</span>
              <div className="size-8 rounded-full bg-muted grid place-items-center mono text-xs">
                {m.avatar_url ? <img src={m.avatar_url} alt="" className="size-8 rounded-full" /> : (m.username ?? "?")[0]}
              </div>
              <Link to="/u/$username" params={{ username: m.username ?? "anon" }} className="flex-1 text-sm hover:text-primary">
                @{m.username ?? "anon"}
              </Link>
              <span className="text-xs mono text-muted-foreground">{m.solves} solves</span>
              <span className="text-xs mono text-primary">{m.points} pts</span>
            </li>
          ))}
          {memberStats.length === 0 && <Empty />}
        </ul>
      </Section>

      <Section title="Category breakdown">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byCategory}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="category" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Cumulative points · last 6 months">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={months}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Line type="monotone" dataKey="points" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mono mt-1">{value}</p>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 bg-card border border-border rounded-lg p-4">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}
function Empty() {
  return <p className="text-xs text-muted-foreground mono">// no data yet</p>;
}

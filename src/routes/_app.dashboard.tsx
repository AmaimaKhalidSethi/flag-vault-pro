import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, DIFFICULTIES, categoryClass, difficultyClass } from "@/lib/categories";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  LineChart, Line, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { formatDistanceToNow, format, startOfWeek, addWeeks, subWeeks, startOfMonth, subMonths } from "date-fns";
import { FileText, Trophy, Activity, Folders, Flame } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Flagvault" }] }),
  component: Dashboard,
});

type Wu = {
  id: string; title: string; slug: string; category: typeof CATEGORIES[number];
  difficulty: typeof DIFFICULTIES[number]; points: number; created_at: string; author_id: string;
  tools_used: string[];
};

const DIFF_COLORS: Record<string, string> = {
  easy: "oklch(0.78 0.14 155)",
  medium: "oklch(0.78 0.14 90)",
  hard: "oklch(0.78 0.18 55)",
  insane: "oklch(0.7 0.2 25)",
};

function Dashboard() {
  const [wus, setWus] = useState<Wu[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from("writeups")
        .select("id,title,slug,category,difficulty,points,created_at,author_id,tools_used")
        .eq("author_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      setWus((data ?? []) as Wu[]);
      setLoading(false);
    })();
  }, []);

  const total = wus.length;
  const monthAgo = Date.now() - 30 * 86400_000;
  const thisMonth = wus.filter(w => new Date(w.created_at).getTime() > monthAgo).length;
  const totalPoints = wus.reduce((s, w) => s + (w.points || 0), 0);

  const byCat = useMemo(() => CATEGORIES.map(c => {
    const n = wus.filter(w => w.category === c).length;
    return { name: c, count: n, pct: total ? Math.round((n / total) * 100) : 0 };
  }), [wus, total]);

  const byDiff = useMemo(() => DIFFICULTIES.map(d => ({
    name: d, value: wus.filter(w => w.difficulty === d).length,
  })).filter(d => d.value > 0), [wus]);

  const pointsOverTime = useMemo(() => {
    const months: { name: string; points: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(startOfMonth(new Date()), i);
      const next = subMonths(startOfMonth(new Date()), i - 1);
      const pts = wus.filter(w => {
        const d = new Date(w.created_at);
        return d >= m && d < next;
      }).reduce((s, w) => s + (w.points || 0), 0);
      months.push({ name: format(m, "MMM"), points: pts });
    }
    let cum = 0;
    return months.map(m => ({ name: m.name, points: (cum += m.points) }));
  }, [wus]);

  const topTools = useMemo(() => {
    const counts: Record<string, number> = {};
    wus.forEach(w => (w.tools_used ?? []).forEach(t => { counts[t] = (counts[t] ?? 0) + 1; }));
    return Object.entries(counts).map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count).slice(0, 8);
  }, [wus]);

  // streak: consecutive weeks with >=1 writeup, going back from this week
  const { streak, weeks } = useMemo(() => {
    const thisWk = startOfWeek(new Date(), { weekStartsOn: 1 });
    const arr: { wk: Date; n: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const wk = subWeeks(thisWk, i);
      const next = addWeeks(wk, 1);
      const n = wus.filter(w => {
        const d = new Date(w.created_at);
        return d >= wk && d < next;
      }).length;
      arr.push({ wk, n });
    }
    let s = 0;
    for (let i = arr.length - 1; i >= 0; i--) { if (arr[i].n > 0) s++; else break; }
    return { streak: s, weeks: arr };
  }, [wus]);

  const maxWeek = Math.max(1, ...weeks.map(w => w.n));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="mono text-xs text-primary">~/dashboard</p>
          <h1 className="text-2xl font-semibold mt-1">Overview</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat icon={FileText} label="Total writeups" value={total} />
        <Stat icon={Activity} label="This month" value={thisMonth} />
        <Stat icon={Trophy} label="Total points" value={totalPoints} />
        <Stat icon={Folders} label="Categories" value={byCat.filter(c => c.count > 0).length} />
        <Stat icon={Flame} label="Week streak" value={streak} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <Card title="Solve rate by category" subtitle="% of total writeups" className="lg:col-span-2">
          <div className="h-64 mt-4">
            <ResponsiveContainer>
              <BarChart data={byCat} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.018 250)" horizontal={false} />
                <XAxis type="number" stroke="oklch(0.66 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" stroke="oklch(0.66 0.02 240)" fontSize={11} tickLine={false} axisLine={false} width={80} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.21 0.018 255)", border: "1px solid oklch(0.28 0.018 250)", borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: "oklch(0.26 0.02 255)" }}
                />
                <Bar dataKey="pct" fill="oklch(0.82 0.16 175)" radius={[0,4,4,0]} animationDuration={600} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Difficulty">
          <div className="h-64 mt-4">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byDiff} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} animationDuration={600}>
                  {byDiff.map((d, i) => <Cell key={i} fill={DIFF_COLORS[d.name]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "oklch(0.21 0.018 255)", border: "1px solid oklch(0.28 0.018 250)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs justify-center">
            {byDiff.map(d => <span key={d.name} className={`px-1.5 py-0.5 rounded ${difficultyClass[d.name as typeof DIFFICULTIES[number]]}`}>{d.name} · {d.value}</span>)}
          </div>
        </Card>

        <Card title="Points over time" subtitle="Cumulative, last 6 months" className="lg:col-span-2">
          <div className="h-56 mt-4">
            <ResponsiveContainer>
              <LineChart data={pointsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.018 250)" />
                <XAxis dataKey="name" stroke="oklch(0.66 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.66 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "oklch(0.21 0.018 255)", border: "1px solid oklch(0.28 0.018 250)", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="points" stroke="oklch(0.82 0.16 175)" strokeWidth={2} dot={{ r: 3 }} animationDuration={600} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Top tools">
          {topTools.length === 0 && <p className="text-sm text-muted-foreground mt-3">No tools tracked yet.</p>}
          <ul className="mt-3 space-y-1.5">
            {topTools.map(t => (
              <li key={t.name} className="flex items-center gap-2">
                <span className="text-xs mono w-20 truncate text-muted-foreground">{t.name}</span>
                <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${(t.count / topTools[0].count) * 100}%` }} />
                </div>
                <span className="text-xs mono text-muted-foreground w-6 text-right">{t.count}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Streak heatmap" subtitle={`${streak} week streak · last 12 weeks`} className="lg:col-span-3">
          <div className="flex gap-1.5 mt-4 overflow-x-auto pb-1">
            {weeks.map((w, i) => {
              const intensity = w.n === 0 ? 0 : Math.min(1, w.n / maxWeek);
              const opacity = w.n === 0 ? 0.15 : 0.3 + intensity * 0.7;
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div title={`${format(w.wk, "MMM d")} · ${w.n} writeup${w.n === 1 ? "" : "s"}`}
                       className="size-8 rounded"
                       style={{ background: `oklch(0.82 0.16 175 / ${opacity})` }} />
                  <span className="text-[9px] mono text-muted-foreground">{format(w.wk, "MMM d")}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Recent activity" className="lg:col-span-3">
          <div className="mt-3 space-y-2">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && wus.length === 0 && (
              <div className="text-sm text-muted-foreground">
                No writeups yet. <Link to="/writeups/new" className="text-primary hover:underline">Document your first flag.</Link>
              </div>
            )}
            {wus.slice(0, 8).map(w => (
              <Link key={w.id} to="/writeups/$slug" params={{ slug: w.slug }} className="block group">
                <div className="text-sm font-medium group-hover:text-primary truncate">{w.title}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span className={`px-1.5 rounded ${categoryClass[w.category]}`}>{w.category}</span>
                  <span className={`px-1.5 rounded ${difficultyClass[w.difficulty]}`}>{w.difficulty}</span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(w.created_at), { addSuffix: true })}</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-lg p-5 ${className ?? ""}`}>
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      {children}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{className?:string}>; label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-3.5" />{label}</div>
      <div className="text-2xl font-semibold mt-2 mono">{value}</div>
    </div>
  );
}

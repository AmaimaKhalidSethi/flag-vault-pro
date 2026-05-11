import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryClass, difficultyClass } from "@/lib/categories";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { FileText, Trophy, Activity, Folders } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Flagvault" }] }),
  component: Dashboard,
});

type Wu = {
  id: string; title: string; slug: string; category: typeof CATEGORIES[number];
  difficulty: "easy"|"medium"|"hard"|"insane"; points: number; created_at: string; author_id: string;
};

function Dashboard() {
  const [wus, setWus] = useState<Wu[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("writeups")
      .select("id,title,slug,category,difficulty,points,created_at,author_id")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => { setWus((data ?? []) as Wu[]); setLoading(false); });
  }, []);

  const total = wus.length;
  const monthAgo = Date.now() - 30 * 86400_000;
  const thisMonth = wus.filter(w => new Date(w.created_at).getTime() > monthAgo).length;
  const totalPoints = wus.reduce((s, w) => s + (w.points || 0), 0);

  const byCat = CATEGORIES.map(c => ({
    name: c, count: wus.filter(w => w.category === c).length,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="mono text-xs text-primary">~/dashboard</p>
          <h1 className="text-2xl font-semibold mt-1">Overview</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={FileText} label="Total writeups" value={total} />
        <Stat icon={Activity} label="This month" value={thisMonth} />
        <Stat icon={Trophy} label="Total points" value={totalPoints} />
        <Stat icon={Folders} label="Categories" value={byCat.filter(c => c.count > 0).length} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold">Solves by category</h2>
          <p className="text-xs text-muted-foreground">Across all your writeups</p>
          <div className="h-64 mt-4">
            <ResponsiveContainer>
              <BarChart data={byCat}>
                <XAxis dataKey="name" stroke="oklch(0.66 0.02 240)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.66 0.02 240)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.21 0.018 255)", border: "1px solid oklch(0.28 0.018 250)", borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: "oklch(0.26 0.02 255)" }}
                />
                <Bar dataKey="count" fill="oklch(0.82 0.16 175)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold">Recent activity</h2>
          <div className="mt-4 space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && wus.length === 0 && (
              <EmptyHint />
            )}
            {wus.slice(0, 6).map(w => (
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
        </div>
      </div>
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

function EmptyHint() {
  return (
    <div className="text-sm text-muted-foreground">
      No writeups yet.{" "}
      <Link to="/writeups/new" className="text-primary hover:underline">Start documenting your first flag.</Link>
    </div>
  );
}

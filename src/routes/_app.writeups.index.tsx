import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, DIFFICULTIES, categoryClass, difficultyClass, type Category, type Difficulty } from "@/lib/categories";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/writeups/")({
  head: () => ({ meta: [{ title: "Writeups — Flagvault" }] }),
  component: WriteupsList,
});

type Row = {
  id: string; title: string; slug: string; summary: string | null;
  category: Category; difficulty: Difficulty; points: number;
  created_at: string; author_id: string; is_published: boolean;
  profiles: { username: string | null; avatar_url: string | null } | null;
};

function WriteupsList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | Category>("all");
  const [diff, setDiff] = useState<"all" | Difficulty>("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("writeups")
        .select("id,title,slug,summary,category,difficulty,points,created_at,author_id,is_published, profiles:author_id(username, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(100);
      setRows((data ?? []) as unknown as Row[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => rows.filter(r =>
    (cat === "all" || r.category === cat) &&
    (diff === "all" || r.difficulty === diff) &&
    (!q || r.title.toLowerCase().includes(q.toLowerCase()) || (r.summary ?? "").toLowerCase().includes(q.toLowerCase()))
  ), [rows, q, cat, diff]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <p className="mono text-xs text-primary">~/writeups</p>
          <h1 className="text-2xl font-semibold mt-1">Writeups</h1>
        </div>
        <Link to="/writeups/new" className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 hover:opacity-90">
          <Plus className="size-4" />New
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by title or summary…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value as Category | "all")} className="bg-input border border-border rounded-md px-3 py-2 text-sm">
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={diff} onChange={(e) => setDiff(e.target.value as Difficulty | "all")} className="bg-input border border-border rounded-md px-3 py-2 text-sm">
          <option value="all">All difficulties</option>
          {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {loading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {!loading && filtered.length === 0 && (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <p className="mono text-xs text-muted-foreground">// no writeups match</p>
          <h3 className="mt-2 font-semibold">No writeups yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Start documenting your first flag.</p>
          <Link to="/writeups/new" className="mt-4 inline-flex bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm">+ New writeup</Link>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(r => (
          <Link key={r.id} to="/writeups/$slug" params={{ slug: r.slug }}
                className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition group">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold group-hover:text-primary line-clamp-2">{r.title}</h3>
              {!r.is_published && <span className="text-[10px] mono text-muted-foreground border border-border rounded px-1">draft</span>}
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.summary || "No summary."}</p>
            <div className="flex flex-wrap gap-1.5 mt-3 text-xs">
              <span className={`px-1.5 py-0.5 rounded ${categoryClass[r.category]}`}>{r.category}</span>
              <span className={`px-1.5 py-0.5 rounded ${difficultyClass[r.difficulty]}`}>{r.difficulty}</span>
              <span className="px-1.5 py-0.5 rounded border border-border text-muted-foreground mono">{r.points} pts</span>
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>@{r.profiles?.username ?? "anon"}</span>
              <span>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

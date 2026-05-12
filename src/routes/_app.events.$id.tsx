import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryClass, difficultyClass, type Category, type Difficulty } from "@/lib/categories";
import { format } from "date-fns";
import { Calendar, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/events/$id")({
  component: EventDetail,
});

type Event = { id: string; name: string; url: string | null; start_date: string | null; end_date: string | null };
type Wu = {
  id: string; title: string; slug: string; summary: string | null;
  category: Category; difficulty: Difficulty; points: number; flag: string | null;
  profiles: { username: string | null } | null;
};

function EventDetail() {
  const { id } = Route.useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [wus, setWus] = useState<Wu[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: e }, { data: w }] = await Promise.all([
        supabase.from("ctf_events").select("*").eq("id", id).maybeSingle(),
        supabase.from("writeups")
          .select("id,title,slug,summary,category,difficulty,points,flag, profiles:author_id(username)")
          .eq("event_id", id)
          .order("created_at", { ascending: false }),
      ]);
      setEvent(e as Event | null);
      setWus((w ?? []) as unknown as Wu[]);
      setLoading(false);
    })();
  }, [id]);

  const filtered = useMemo(() => wus.filter(w =>
    (filter === "all" || w.category === filter) &&
    (!q || w.title.toLowerCase().includes(q.toLowerCase()))
  ), [wus, filter, q]);

  if (loading) return <div className="p-6 mono text-sm text-muted-foreground">loading…</div>;
  if (!event) return <div className="p-6">Event not found.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link to="/events" className="text-xs mono text-primary hover:underline">← /events</Link>
      <h1 className="text-2xl font-semibold mt-2">{event.name}</h1>
      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
        <span className="flex items-center gap-1"><Calendar className="size-3" />
          {event.start_date ? format(new Date(event.start_date), "MMM d, yyyy") : "—"}
          {event.end_date && <> – {format(new Date(event.end_date), "MMM d, yyyy")}</>}
        </span>
        {event.url && <a href={event.url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1"><ExternalLink className="size-3" />ctftime</a>}
      </div>

      <div className="flex flex-wrap gap-2 mt-5">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter title…" className="max-w-xs" />
        <button onClick={() => setFilter("all")} className={`text-xs px-2 py-1 rounded ${filter === "all" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>all</button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setFilter(c)} className={`text-xs px-2 py-1 rounded ${filter === c ? categoryClass[c] : "border border-border text-muted-foreground"}`}>{c}</button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        {filtered.map(w => (
          <Link key={w.id} to="/writeups/$slug" params={{ slug: w.slug }}
                className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition">
            <h3 className="font-semibold">{w.title}</h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{w.summary || "No summary."}</p>
            <div className="flex flex-wrap gap-1.5 mt-3 text-xs">
              <span className={`px-1.5 py-0.5 rounded ${categoryClass[w.category]}`}>{w.category}</span>
              <span className={`px-1.5 py-0.5 rounded ${difficultyClass[w.difficulty]}`}>{w.difficulty}</span>
              <span className="px-1.5 py-0.5 rounded border border-border text-muted-foreground mono">{w.points} pts</span>
              {w.flag && <span className="px-1.5 py-0.5 rounded bg-success/15 text-success border border-success/30 mono">flag set ✓</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-2">@{w.profiles?.username ?? "anon"}</div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">No writeups for this event yet.</p>
        )}
      </div>
    </div>
  );
}

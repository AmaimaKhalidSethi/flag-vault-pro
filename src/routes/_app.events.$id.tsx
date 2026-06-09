import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryClass, difficultyClass, type Category, type Difficulty } from "@/lib/categories";
import { format, formatDistanceToNow } from "date-fns";
import { Calendar, ExternalLink, Check, Flag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { PresenceStack, type PresenceUser } from "@/components/PresenceStack";
import { TeamTracker } from "@/components/TeamTracker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type SolveBroadcast = {
  type: "solve";
  user: string;
  challenge: string;
  category: Category;
  points: number;
  timestamp: string;
};

export const Route = createFileRoute("/_app/events/$id")({
  component: EventDetail,
});

type Event = { id: string; name: string; url: string | null; start_date: string | null; end_date: string | null };
type Wu = {
  id: string; title: string; slug: string; summary: string | null;
  category: Category; difficulty: Difficulty; points: number; flag: string | null;
  author_id: string; team_id: string | null;
  profiles: { username: string | null } | null;
};

function EventDetail() {
  const { id } = Route.useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [wus, setWus] = useState<Wu[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [q, setQ] = useState("");
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [solves, setSolves] = useState<SolveBroadcast[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const wusRef = useRef<Wu[]>([]);
  wusRef.current = wus;

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [solves]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      const [{ data: e }, { data: w }] = await Promise.all([
        supabase.from("ctf_events").select("*").eq("id", id).maybeSingle(),
        supabase.from("writeups")
          .select("id,title,slug,summary,category,difficulty,points,flag,author_id,team_id, profiles:author_id(username)")
          .eq("event_id", id)
          .order("created_at", { ascending: false }),
      ]);
      setEvent(e as Event | null);
      setWus((w ?? []) as unknown as Wu[]);
      setLoading(false);
    })();
  }, [id]);

  // Realtime: writeups + presence
  useEffect(() => {
    if (!me) return;

    let profile: { username: string | null; avatar_url: string | null } = { username: null, avatar_url: null };
    supabase.from("profiles").select("username, avatar_url").eq("id", me).maybeSingle()
      .then(({ data }) => { if (data) profile = data; });

    const ch = supabase.channel(`event:${id}`, { config: { presence: { key: me } } });

    ch.on("postgres_changes",
      { event: "INSERT", schema: "public", table: "writeups", filter: `event_id=eq.${id}` },
      async (payload) => {
        const row = payload.new as Wu;
        const { data: prof } = await supabase.from("profiles").select("username").eq("id", row.author_id).maybeSingle();
        setWus((prev) => prev.find((x) => x.id === row.id) ? prev : [{ ...row, profiles: prof ?? null }, ...prev]);
      });

    ch.on("postgres_changes",
      { event: "UPDATE", schema: "public", table: "writeups", filter: `event_id=eq.${id}` },
      (payload) => {
        const row = payload.new as Wu;
        const old = payload.old as Partial<Wu>;
        setWus((prev) => prev.map((x) => x.id === row.id ? { ...x, ...row, profiles: x.profiles } : x));
        if (row.flag && !old.flag) {
          const author = wusRef.current.find((x) => x.id === row.id)?.profiles?.username ?? "someone";
          toast.success(`@${author} solved ${row.title}`, { duration: 4000 });
        }
      });

    ch.on("postgres_changes",
      { event: "DELETE", schema: "public", table: "writeups", filter: `event_id=eq.${id}` },
      (payload) => {
        const old = payload.old as { id: string };
        setWus((prev) => prev.filter((x) => x.id !== old.id));
      });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, PresenceUser[]>;
      const users: PresenceUser[] = [];
      const seen = new Set<string>();
      for (const arr of Object.values(state)) {
        for (const u of arr) {
          if (!seen.has(u.user_id)) { seen.add(u.user_id); users.push(u); }
        }
      }
      setPresence(users);
    });

    ch.on("broadcast", { event: "solve" }, ({ payload }) => {
      const s = payload as SolveBroadcast;
      if (!s || s.type !== "solve") return;
      setSolves((prev) => [...prev, s].slice(-50));
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ user_id: me, username: profile.username, avatar_url: profile.avatar_url });
      }
    });

    return () => { supabase.removeChannel(ch); };
  }, [id, me]);

  const filtered = useMemo(() => wus.filter(w =>
    (filter === "all" || w.category === filter) &&
    (!q || w.title.toLowerCase().includes(q.toLowerCase()))
  ), [wus, filter, q]);

  async function markSolved(w: Wu, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const flag = window.prompt(`Flag for "${w.title}"`, w.flag ?? "flag{}");
    if (!flag) return;
    const { error } = await supabase.from("writeups").update({ flag }).eq("id", w.id);
    if (error) toast.error(error.message);
  }

  if (loading) return <div className="p-6 mono text-sm text-muted-foreground">loading…</div>;
  if (!event) return <div className="p-6">Event not found.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link to="/events" className="text-xs mono text-primary hover:underline">← /events</Link>
      <div className="flex items-start justify-between gap-4 mt-2">
        <div>
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
            <span className="flex items-center gap-1"><Calendar className="size-3" />
              {event.start_date ? format(new Date(event.start_date), "MMM d, yyyy") : "—"}
              {event.end_date && <> – {format(new Date(event.end_date), "MMM d, yyyy")}</>}
            </span>
            {event.url && <a href={event.url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1"><ExternalLink className="size-3" />ctftime</a>}
          </div>
        </div>
        <PresenceStack users={presence} />
      </div>

      <div className="flex flex-wrap gap-2 mt-5">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter title…" className="max-w-xs" />
        <button onClick={() => setFilter("all")} className={`text-xs px-2 py-1 rounded ${filter === "all" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>all</button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setFilter(c)} className={`text-xs px-2 py-1 rounded ${filter === c ? categoryClass[c] : "border border-border text-muted-foreground"}`}>{c}</button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        <AnimatePresence>
          {filtered.map(w => (
            <motion.div
              key={w.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
            >
              <Link to="/writeups/$slug" params={{ slug: w.slug }}
                    className="block bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{w.title}</h3>
                  {me === w.author_id && !w.flag && (
                    <button
                      onClick={(e) => markSolved(w, e)}
                      className="text-[10px] mono px-1.5 py-0.5 rounded border border-primary/40 text-primary hover:bg-primary/10"
                    >
                      mark solved
                    </button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{w.summary || "No summary."}</p>
                <div className="flex flex-wrap gap-1.5 mt-3 text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${categoryClass[w.category]}`}>{w.category}</span>
                  <span className={`px-1.5 py-0.5 rounded ${difficultyClass[w.difficulty]}`}>{w.difficulty}</span>
                  <span className="px-1.5 py-0.5 rounded border border-border text-muted-foreground mono">{w.points} pts</span>
                  {w.flag && (
                    <motion.span layout
                      initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                      className="px-1.5 py-0.5 rounded bg-success/15 text-success border border-success/30 mono inline-flex items-center gap-1">
                      <Check className="size-3" />solved
                    </motion.span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-2">@{w.profiles?.username ?? "anon"}</div>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">No writeups for this event yet.</p>
        )}
      </div>

      {/* Live solve feed */}
      <section className="mt-8 bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-success animate-pulse" />
            Live solves
          </h2>
          <span className="text-[10px] mono text-muted-foreground">{solves.length} this session</span>
        </div>
        <div ref={feedRef} className="max-h-64 overflow-y-auto p-3 space-y-1.5">
          {solves.length === 0 && (
            <p className="text-xs text-muted-foreground mono">// waiting for the next solve…</p>
          )}
          <AnimatePresence initial={false}>
            {solves.map((s, i) => (
              <motion.div
                key={`${s.timestamp}-${i}`}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-sm bg-background/40 border border-border/60 rounded px-2.5 py-1.5"
              >
                <Flag className="size-3.5 text-success shrink-0" />
                <span className="mono text-primary">@{s.user}</span>
                <span className="text-muted-foreground">solved</span>
                <span className="font-medium truncate flex-1">{s.challenge}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${categoryClass[s.category]}`}>{s.category}</span>
                <span className="text-[10px] mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
                  {s.points}pt
                </span>
                <span className="text-[10px] mono text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(s.timestamp), { addSuffix: true })}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}

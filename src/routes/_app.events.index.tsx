import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ExternalLink, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/events/")({
  head: () => ({ meta: [{ title: "CTF Events — Flagvault" }] }),
  component: EventsList,
});

type Event = {
  id: string; name: string; url: string | null;
  start_date: string | null; end_date: string | null;
  created_at: string;
};

function EventsList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ctf_events").select("*").order("start_date", { ascending: false });
      setEvents((data ?? []) as Event[]);
      const { data: wus } = await supabase.from("writeups").select("event_id");
      const c: Record<string, number> = {};
      (wus ?? []).forEach((w: { event_id: string | null }) => { if (w.event_id) c[w.event_id] = (c[w.event_id] ?? 0) + 1; });
      setCounts(c);
      setLoading(false);
    })();
  }, []);

  // Realtime new/updated events
  useEffect(() => {
    const ch = supabase.channel("events:list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ctf_events" },
          (payload) => {
            const row = payload.new as Event;
            setEvents((prev) => prev.find((e) => e.id === row.id) ? prev : [row, ...prev]);
          })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ctf_events" },
          (payload) => {
            const row = payload.new as Event;
            setEvents((prev) => prev.map((e) => e.id === row.id ? row : e));
          })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "writeups" },
          (payload) => {
            const r = payload.new as { event_id: string | null };
            if (r.event_id) setCounts((c) => ({ ...c, [r.event_id!]: (c[r.event_id!] ?? 0) + 1 }));
          })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <p className="mono text-xs text-primary">~/events</p>
          <h1 className="text-2xl font-semibold mt-1">CTF Events</h1>
        </div>
        <Link to="/events/new" className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1.5 hover:opacity-90">
          <Plus className="size-4" />New event
        </Link>
      </div>

      {loading && <p className="text-muted-foreground text-sm mono">loading…</p>}
      {!loading && events.length === 0 && (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <p className="text-sm text-muted-foreground">No CTF events yet.</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {events.map(e => (
          <div key={e.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{e.name}</h3>
              <span className="text-[10px] mono text-primary border border-primary/30 rounded px-1.5">
                {counts[e.id] ?? 0} writeups
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Calendar className="size-3" />
              {e.start_date ? format(new Date(e.start_date), "MMM d, yyyy") : "—"}
              {e.end_date && <> – {format(new Date(e.end_date), "MMM d, yyyy")}</>}
            </div>
            {e.url && (
              <a href={e.url} target="_blank" rel="noreferrer"
                 className="text-xs text-primary hover:underline flex items-center gap-1 mt-2">
                <ExternalLink className="size-3" />ctftime
              </a>
            )}
            <Link to="/events/$id" params={{ id: e.id }}>
              <Button size="sm" variant="outline" className="w-full mt-3">View writeups</Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

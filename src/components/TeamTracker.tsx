import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryClass, type Category } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, UserCheck, FileText, Trash2 } from "lucide-react";

type Status = "unsolved" | "attempting" | "solved";

type Attempt = {
  id: string;
  event_id: string;
  team_id: string;
  challenge_name: string;
  category: Category;
  points: number | null;
  status: Status;
  claimed_by: string | null;
  writeup_id: string | null;
  created_at: string;
};

const COLUMNS: { key: Status; label: string; tint: string }[] = [
  { key: "unsolved",   label: "Unsolved",   tint: "border-border" },
  { key: "attempting", label: "Attempting", tint: "border-warning/40" },
  { key: "solved",     label: "Solved",     tint: "border-success/40" },
];

export function TeamTracker({ eventId, teamId, me }: { eventId: string; teamId: string | null; me: string | null }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState<Category>("web");
  const [newPts, setNewPts] = useState<string>("");
  const [usernames, setUsernames] = useState<Record<string, string>>({});

  const enabled = !!teamId;

  const queryKey = ["challenge_attempts", eventId, teamId] as const;

  const { data: attempts = [], isLoading } = useQuery({
    queryKey,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenge_attempts")
        .select("*")
        .eq("event_id", eventId)
        .eq("team_id", teamId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Attempt[];
    },
  });

  // Resolve usernames for claimed_by
  useEffect(() => {
    const ids = Array.from(new Set(attempts.map(a => a.claimed_by).filter((x): x is string => !!x && !usernames[x])));
    if (!ids.length) return;
    supabase.from("profiles").select("id, username").in("id", ids).then(({ data }) => {
      if (!data) return;
      setUsernames(prev => {
        const next = { ...prev };
        for (const p of data as { id: string; username: string | null }[]) next[p.id] = p.username ?? "anon";
        return next;
      });
    });
  }, [attempts, usernames]);

  // Realtime: broadcast tracker_update + listen
  useEffect(() => {
    if (!teamId) return;
    const ch = supabase.channel(`event:${eventId}`);
    ch.on("broadcast", { event: "tracker_update" }, () => {
      qc.invalidateQueries({ queryKey });
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [eventId, teamId, qc]);

  async function broadcast() {
    const ch = supabase.channel(`event:${eventId}`);
    await new Promise<void>((resolve) => ch.subscribe((s) => { if (s === "SUBSCRIBED") resolve(); }));
    await ch.send({ type: "broadcast", event: "tracker_update", payload: { t: Date.now() } });
    await supabase.removeChannel(ch);
  }

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!teamId) throw new Error("no team");
      const name = newName.trim();
      if (!name) throw new Error("Name required");
      const { error } = await supabase.from("challenge_attempts").insert({
        event_id: eventId, team_id: teamId,
        challenge_name: name, category: newCat,
        points: newPts ? Number(newPts) : null,
        status: "unsolved",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewName(""); setNewPts("");
      qc.invalidateQueries({ queryKey });
      broadcast();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<Attempt> }) => {
      const { error } = await supabase.from("challenge_attempts").update(vars.patch).eq("id", vars.id);
      if (error) throw error;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<Attempt[]>(queryKey);
      qc.setQueryData<Attempt[]>(queryKey, (old) => (old ?? []).map(a => a.id === vars.id ? { ...a, ...vars.patch } : a));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
      toast.error("Update failed — reverted");
    },
    onSuccess: () => broadcast(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("challenge_attempts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      broadcast();
    },
  });

  const grouped = useMemo(() => {
    const m: Record<Status, Attempt[]> = { unsolved: [], attempting: [], solved: [] };
    for (const a of attempts) m[a.status].push(a);
    return m;
  }, [attempts]);

  function onDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDrop(e: React.DragEvent, status: Status) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const a = attempts.find(x => x.id === id);
    if (!a || a.status === status) return;
    updateMutation.mutate({ id, patch: { status } });
  }

  if (!teamId) {
    return (
      <div className="border border-dashed border-border rounded-lg p-6 text-sm text-muted-foreground text-center">
        Join or create a team to use the tracker.
      </div>
    );
  }

  return (
    <div>
      <form
        onSubmit={(e) => { e.preventDefault(); addMutation.mutate(); }}
        className="flex flex-wrap gap-2 mb-4 items-center"
      >
        <Input
          value={newName} onChange={(e) => setNewName(e.target.value)}
          placeholder="Challenge name…" className="flex-1 min-w-[180px]"
        />
        <select value={newCat} onChange={(e) => setNewCat(e.target.value as Category)}
                className={`px-2 py-1.5 rounded text-xs ${categoryClass[newCat]}`}>
          {CATEGORIES.map(c => <option key={c} value={c} className="bg-background text-foreground">{c}</option>)}
        </select>
        <Input
          type="number" value={newPts} onChange={(e) => setNewPts(e.target.value)}
          placeholder="pts" className="w-20"
        />
        <Button type="submit" size="sm" disabled={addMutation.isPending}>
          <Plus className="size-3.5 mr-1" />Add
        </Button>
      </form>

      <div className="grid md:grid-cols-3 gap-3">
        {COLUMNS.map(col => (
          <div
            key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, col.key)}
            className={`bg-card border ${col.tint} rounded-lg p-3 min-h-[200px]`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</h3>
              <span className="text-[10px] mono text-muted-foreground">{grouped[col.key].length}</span>
            </div>
            <div className="space-y-2">
              {isLoading && <p className="text-xs mono text-muted-foreground">loading…</p>}
              {grouped[col.key].map(a => (
                <div
                  key={a.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, a.id)}
                  className="bg-background border border-border rounded p-2.5 text-sm cursor-grab active:cursor-grabbing hover:border-primary/50 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium truncate">{a.challenge_name}</span>
                    <button
                      onClick={() => deleteMutation.mutate(a.id)}
                      className="text-muted-foreground hover:text-danger shrink-0"
                      title="Remove"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5 text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded ${categoryClass[a.category]}`}>{a.category}</span>
                    {a.points != null && (
                      <span className="px-1.5 py-0.5 rounded border border-border text-muted-foreground mono">{a.points}pt</span>
                    )}
                    {a.claimed_by && (
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary mono">
                        @{usernames[a.claimed_by] ?? "…"}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-2">
                    {me && a.claimed_by !== me && (
                      <button
                        onClick={() => updateMutation.mutate({ id: a.id, patch: { claimed_by: me } })}
                        className="text-[10px] mono text-primary hover:underline flex items-center gap-1"
                      >
                        <UserCheck className="size-3" />Claim
                      </button>
                    )}
                    {a.writeup_id && (
                      <span className="text-[10px] mono text-success ml-auto flex items-center gap-1">
                        <FileText className="size-3" />written up
                      </span>
                    )}
                  </div>
                  {a.status === "solved" && !a.writeup_id && (
                    <button
                      onClick={() => nav({
                        to: "/writeups/new",
                        search: {
                          challenge: a.challenge_name,
                          category: a.category,
                          points: a.points ?? undefined,
                          event_id: a.event_id,
                          attempt_id: a.id,
                        } as Record<string, unknown>,
                      })}
                      className="mt-2 w-full bg-success/15 hover:bg-success/25 border border-success/40 text-success rounded px-2 py-1.5 text-[11px] mono flex items-center justify-center gap-1 transition"
                    >
                      <FileText className="size-3.5" />Write up this challenge →
                    </button>
                  )}
                </div>
              ))}
              {!isLoading && grouped[col.key].length === 0 && (
                <p className="text-[11px] mono text-muted-foreground italic">drop here</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, DIFFICULTIES, categoryClass, difficultyClass, type Category, type Difficulty } from "@/lib/categories";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, X, Filter, Clock, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useDebounced } from "@/hooks/use-debounced";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  category: fallback(z.array(z.enum(CATEGORIES)), []).default([]),
  difficulty: fallback(z.array(z.enum(DIFFICULTIES)), []).default([]),
  event: fallback(z.string(), "").default(""),
  author: fallback(z.string(), "").default(""),
  tags: fallback(z.array(z.string()), []).default([]),
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_app/writeups/")({
  head: () => ({ meta: [{ title: "Writeups — Flagvault" }] }),
  validateSearch: zodValidator(searchSchema),
  component: WriteupsList,
});

type Row = {
  id: string; title: string; slug: string; summary: string | null;
  category: Category; difficulty: Difficulty; points: number;
  created_at: string; author_id: string; is_published: boolean;
  flag: string | null; tags: string[]; event_id: string | null;
  profiles: { username: string | null; avatar_url: string | null } | null;
};

type EventOpt = { id: string; name: string };

function WriteupsList() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const debouncedQ = useDebounced(search.q, 300);
  const debouncedAuthor = useDebounced(search.author, 300);

  useEffect(() => {
    supabase.from("ctf_events").select("id,name").order("name").then(({ data }) => setEvents(data ?? []));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase
        .from("writeups")
        .select("id,title,slug,summary,category,difficulty,points,created_at,author_id,is_published,flag,tags,event_id, profiles:author_id(username, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (debouncedQ.trim()) {
        query = query.textSearch("search_tsv", debouncedQ.trim().split(/\s+/).join(" & "), { type: "websearch", config: "english" });
      }
      if (search.category.length) query = query.in("category", search.category);
      if (search.difficulty.length) query = query.in("difficulty", search.difficulty);
      if (search.event) query = query.eq("event_id", search.event);
      if (search.tags.length) query = query.contains("tags", search.tags);
      if (search.from) query = query.gte("created_at", search.from);
      if (search.to) query = query.lte("created_at", search.to + "T23:59:59");

      const { data } = await query;
      let result = (data ?? []) as unknown as Row[];
      if (debouncedAuthor.trim()) {
        const a = debouncedAuthor.trim().toLowerCase();
        result = result.filter(r => (r.profiles?.username ?? "").toLowerCase().includes(a));
      }
      setRows(result);
      setLoading(false);
    })();
  }, [debouncedQ, debouncedAuthor, search.category, search.difficulty, search.event, search.tags, search.from, search.to]);

  function update(patch: Partial<z.infer<typeof searchSchema>>) {
    navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, ...patch }) });
  }

  function toggleArr<T extends string>(key: "category" | "difficulty", value: T) {
    const arr = (search[key] as string[]) ?? [];
    const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
    update({ [key]: next } as Partial<z.infer<typeof searchSchema>>);
  }

  const hasFilters = useMemo(() =>
    !!(search.q || search.category.length || search.difficulty.length || search.event || search.author || search.tags.length || search.from || search.to),
    [search]
  );

  function clearAll() {
    navigate({ search: { q: "", category: [], difficulty: [], event: "", author: "", tags: [], from: "", to: "" } });
  }

  function addTag() {
    const t = tagDraft.trim().toLowerCase();
    if (t && !search.tags.includes(t)) update({ tags: [...search.tags, t] });
    setTagDraft("");
  }

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

      <div className="flex gap-2 mb-4 items-center">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search title, summary, body…" value={search.q} onChange={(e) => update({ q: e.target.value })} />
        </div>
        <Button variant="outline" className="md:hidden" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="size-4" />
        </Button>
      </div>

      <div className="grid md:grid-cols-[240px_1fr] gap-6">
        <aside className={`${showFilters ? "" : "hidden md:block"} space-y-4 text-sm`}>
          <FilterGroup title="Category">
            {CATEGORIES.map(c => (
              <label key={c} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={search.category.includes(c)} onChange={() => toggleArr("category", c)} />
                <span className={`px-1.5 py-0.5 rounded text-xs ${categoryClass[c]}`}>{c}</span>
              </label>
            ))}
          </FilterGroup>

          <FilterGroup title="Difficulty">
            <div className="flex flex-wrap gap-1.5">
              {DIFFICULTIES.map(d => {
                const active = search.difficulty.includes(d);
                return (
                  <button key={d} onClick={() => toggleArr("difficulty", d)}
                          className={`text-xs px-2 py-1 rounded ${active ? difficultyClass[d] : "border border-border text-muted-foreground"}`}>
                    {d}
                  </button>
                );
              })}
            </div>
          </FilterGroup>

          <FilterGroup title="CTF Event">
            <select value={search.event} onChange={(e) => update({ event: e.target.value })}
                    className="w-full bg-input border border-border rounded px-2 py-1.5">
              <option value="">All events</option>
              {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </FilterGroup>

          <FilterGroup title="Author">
            <Input value={search.author} onChange={(e) => update({ author: e.target.value })} placeholder="@username" />
          </FilterGroup>

          <FilterGroup title="Tags">
            <div className="flex flex-wrap gap-1 mb-1">
              {search.tags.map((t: string) => (
                <span key={t} className="text-[11px] bg-muted px-1.5 rounded mono flex items-center gap-1">
                  {t}<button onClick={() => update({ tags: search.tags.filter((x: string) => x !== t) })}><X className="size-3" /></button>
                </span>
              ))}
            </div>
            <Input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                   placeholder="+ tag" />
          </FilterGroup>

          <FilterGroup title="Date range">
            <Input type="date" value={search.from} onChange={(e) => update({ from: e.target.value })} />
            <Input type="date" value={search.to} onChange={(e) => update({ to: e.target.value })} className="mt-1" />
          </FilterGroup>

          {hasFilters && <Button variant="outline" size="sm" className="w-full" onClick={clearAll}>Clear all filters</Button>}
        </aside>

        <div>
          <p className="text-xs text-muted-foreground mb-2 mono">{loading ? "searching…" : `${rows.length} result${rows.length === 1 ? "" : "s"}`}</p>

          {!loading && rows.length === 0 && (
            <div className="border border-dashed border-border rounded-lg p-12 text-center">
              <p className="mono text-xs text-muted-foreground">// no writeups match</p>
              <Link to="/writeups/new" className="mt-4 inline-flex bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm">+ New writeup</Link>
            </div>
          )}

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {rows.map(r => (
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
                  {r.flag && <span className="px-1.5 py-0.5 rounded bg-success/15 text-success border border-success/30 mono">flag set ✓</span>}
                </div>
                {r.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {r.tags.slice(0, 4).map(t => <span key={t} className="text-[10px] mono bg-muted px-1.5 rounded">#{t}</span>)}
                  </div>
                )}
                <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                  <span>@{r.profiles?.username ?? "anon"}</span>
                  <span>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, DIFFICULTIES, categoryClass, difficultyClass, slugify, type Category, type Difficulty } from "@/lib/categories";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Eye, EyeOff, Save, X, Sparkles, Loader2, Tag, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { aiSummarize, aiAutoTag, getAnthropicKey } from "@/lib/ai";
import { WRITEUP_TEMPLATES } from "@/lib/writeup-templates";

// Lazy-load the CodeMirror editor — keeps ~250KB out of the initial bundle
const MarkdownEditor = lazy(() =>
  import("@/components/MarkdownEditor").then((m) => ({ default: m.MarkdownEditor })),
);

const newSearchSchema = z.object({
  challenge: fallback(z.string().optional(), undefined),
  category: fallback(z.enum(CATEGORIES).optional(), undefined),
  points: fallback(z.coerce.number().optional(), undefined),
  event_id: fallback(z.string().optional(), undefined),
  attempt_id: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/_app/writeups/new")({
  head: () => ({ meta: [{ title: "New writeup — Flagvault" }] }),
  validateSearch: zodValidator(newSearchSchema),
  component: NewWriteup,
});

type PublishMode = "draft" | "now" | "schedule";

type Event = { id: string; name: string; end_date: string | null };

const DEFAULT_BODY = "# Writeup\n\nDescribe the challenge…\n\n## Solution\n\n```bash\necho \"hello world\"\n```\n";

function NewWriteup() {
  const nav = useNavigate();
  const search = Route.useSearch();
  const [userId, setUserId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  const [title, setTitle] = useState(search.challenge ?? "");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState(DEFAULT_BODY);
  const [bodyDirty, setBodyDirty] = useState(false);
  const [category, setCategory] = useState<Category>(search.category ?? "web");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [points, setPoints] = useState<number>(search.points ?? 100);
  const [flag, setFlag] = useState("");
  const [revealFlag, setRevealFlag] = useState(false);
  const [tools, setTools] = useState<string[]>([]);
  const [toolDraft, setToolDraft] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [eventId, setEventId] = useState<string>(search.event_id ?? "");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState<null | "sum" | "tag">(null);

  // Publish mode controls
  const [publishMode, setPublishMode] = useState<PublishMode>("draft");
  const [scheduleAt, setScheduleAt] = useState<string>(""); // datetime-local value

  // Template modal: ask once on mount, and re-ask if category changes while body is untouched
  const [templateOpen, setTemplateOpen] = useState(true);

  function handleBodyChange(v: string) {
    setBody(v);
    if (!bodyDirty && v !== DEFAULT_BODY) setBodyDirty(true);
  }

  function applyTemplate(cat: Category) {
    setBody(WRITEUP_TEMPLATES[cat]);
    setBodyDirty(false);
    setTemplateOpen(false);
  }

  // Re-open the template picker when category changes before user edits the body
  useEffect(() => {
    if (bodyDirty) return;
    setTemplateOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);


  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      setUserId(data.session.user.id);
      const { data: prof } = await supabase.from("profiles").select("team_id").eq("id", data.session.user.id).maybeSingle();
      setTeamId(prof?.team_id ?? null);
      const { data: ev } = await supabase.from("ctf_events").select("id,name,end_date").order("created_at", { ascending: false });
      setEvents((ev ?? []) as Event[]);
    });
  }, []);

  const linkedEvent = events.find(e => e.id === eventId);


  function addItem(set: (v: string[]) => void, list: string[], v: string, clear: () => void) {
    const t = v.trim().toLowerCase();
    if (t && !list.includes(t)) set([...list, t]);
    clear();
  }

  async function runSummarize() {
    if (!getAnthropicKey()) return toast.error("AI failed — check your Anthropic API key in Settings.");
    setAiBusy("sum");
    try {
      const s = await aiSummarize(`${title}\n\n${body}`);
      if (s) setSummary(s);
      toast.success("Summary generated");
    } catch {
      toast.error("AI failed — check your Anthropic API key in Settings.");
    } finally { setAiBusy(null); }
  }
  async function runAutoTag() {
    if (!getAnthropicKey()) return toast.error("AI failed — check your Anthropic API key in Settings.");
    setAiBusy("tag");
    try {
      const t = await aiAutoTag(`${title}\n\n${body}`);
      if (t.length) setTags(Array.from(new Set([...tags, ...t])).slice(0, 10));
      toast.success(`Added ${t.length} tags`);
    } catch {
      toast.error("AI failed — check your Anthropic API key in Settings.");
    } finally { setAiBusy(null); }
  }

  async function save(mode: PublishMode) {
    if (!userId) return toast.error("Not signed in");
    if (!title.trim()) return toast.error("Title required");
    let publish_at: string | null = null;
    if (mode === "schedule") {
      if (!scheduleAt) return toast.error("Pick a schedule date");
      const d = new Date(scheduleAt);
      if (isNaN(+d) || d <= new Date()) return toast.error("Schedule must be in the future");
      publish_at = d.toISOString();
    }
    setBusy(true);
    const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase.from("writeups").insert({
      title, slug, body_md: body, summary,
      difficulty, category, points: Number(points) || 0,
      flag: flag || null,
      tools_used: tools,
      tags,
      is_published: mode === "now",
      publish_at,
      team_id: teamId,
      author_id: userId,
      event_id: eventId || null,
    }).select("id,slug").single();
    if (error || !data) { setBusy(false); return toast.error(error?.message ?? "Save failed"); }
    // Link back to the challenge attempt if launched from tracker
    if (search.attempt_id) {
      await supabase.from("challenge_attempts").update({ writeup_id: data.id }).eq("id", search.attempt_id);
    }
    setBusy(false);
    toast.success(mode === "now" ? "Published" : mode === "schedule" ? "Scheduled" : "Saved as draft");
    nav({ to: "/writeups/$slug", params: { slug: data.slug } });
  }


  const aiToolbar = (
    <>
      <Button size="sm" variant="outline" disabled={aiBusy !== null} onClick={runSummarize}>
        {aiBusy === "sum" ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Sparkles className="size-3.5 mr-1" />}
        Summarize
      </Button>
      <Button size="sm" variant="outline" disabled={aiBusy !== null} onClick={runAutoTag}>
        {aiBusy === "tag" ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Tag className="size-3.5 mr-1" />}
        Auto-tag
      </Button>
    </>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      <div className="border-b border-border bg-card">
        <div className="px-4 py-3 flex flex-wrap items-center gap-2">
          <Input
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Writeup title…"
            className="text-lg font-semibold flex-1 min-w-[200px] !border-0 !bg-transparent shadow-none focus-visible:ring-0 px-0"
          />
          <div className="flex items-center rounded-md border border-border overflow-hidden text-xs">
            {(["draft","now","schedule"] as PublishMode[]).map(m => (
              <button key={m} onClick={() => setPublishMode(m)}
                      className={`px-2.5 py-1.5 ${publishMode === m ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}>
                {m === "draft" ? "Draft" : m === "now" ? "Publish now" : "Schedule"}
              </button>
            ))}
          </div>
          {publishMode === "schedule" && (
            <div className="flex items-center gap-1">
              <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)}
                     className="w-56 text-xs" />
              {linkedEvent?.end_date && (
                <Button size="sm" variant="outline" type="button"
                        onClick={() => {
                          const d = new Date(linkedEvent.end_date!);
                          const pad = (n: number) => String(n).padStart(2, "0");
                          setScheduleAt(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                        }}>
                  <CalendarClock className="size-3.5 mr-1" />Use event end
                </Button>
              )}
            </div>
          )}
          <Button onClick={() => save(publishMode)} disabled={busy}>
            <Save className="size-4 mr-1.5" />
            {publishMode === "now" ? "Publish" : publishMode === "schedule" ? "Schedule" : "Save draft"}
          </Button>
        </div>
        <div className="px-4 pb-3 flex flex-wrap items-center gap-2 text-xs">
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  className={`px-2 py-1 rounded ${difficultyClass[difficulty]}`}>
            {DIFFICULTIES.map(d => <option key={d} value={d} className="bg-background text-foreground">{d}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}
                  className={`px-2 py-1 rounded ${categoryClass[category]}`}>
            {CATEGORIES.map(c => <option key={c} value={c} className="bg-background text-foreground">{c}</option>)}
          </select>
          <input type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))}
                 className="w-20 bg-input border border-border rounded px-2 py-1 mono"
                 placeholder="points" />
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}
                  className="bg-input border border-border rounded px-2 py-1">
            <option value="">No CTF event</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>

          <div className="flex items-center gap-1 bg-input border border-border rounded px-2 py-1">
            <span className="text-muted-foreground">flag:</span>
            <input
              type={revealFlag ? "text" : "password"}
              value={flag}
              onChange={(e) => setFlag(e.target.value)}
              placeholder="flag{...}"
              className="bg-transparent outline-none mono w-44"
            />
            <button type="button" onClick={() => setRevealFlag(!revealFlag)} className="text-muted-foreground hover:text-primary">
              {revealFlag ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>

          <ChipInput label="tools" items={tools} onRemove={(t) => setTools(tools.filter(x => x !== t))}
                     draft={toolDraft} setDraft={setToolDraft}
                     onAdd={() => addItem(setTools, tools, toolDraft, () => setToolDraft(""))} />
          <ChipInput label="tags" items={tags} onRemove={(t) => setTags(tags.filter(x => x !== t))}
                     draft={tagDraft} setDraft={setTagDraft}
                     onAdd={() => addItem(setTags, tags, tagDraft, () => setTagDraft(""))} />

          <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Short summary…"
                 className="flex-1 min-w-[200px]" />
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <Suspense fallback={<div className="h-full grid place-items-center text-sm text-muted-foreground">Loading editor…</div>}>
          <MarkdownEditor value={body} onChange={handleBodyChange} extraToolbar={aiToolbar} />
        </Suspense>
      </div>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start from a template?</DialogTitle>
            <DialogDescription>
              Pre-fill the editor with a scaffold for <span className="mono text-primary">{category}</span> writeups, or start blank.
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs mono text-muted-foreground border border-border rounded p-3 bg-muted/30 max-h-48 overflow-auto whitespace-pre-wrap">
            {WRITEUP_TEMPLATES[category]}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <p className="text-xs text-muted-foreground w-full">Or pick a different category:</p>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                      className={`text-[11px] px-2 py-1 rounded ${c === category ? categoryClass[c] : "border border-border text-muted-foreground"}`}>
                {c}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBodyDirty(false); setTemplateOpen(false); }}>
              Blank
            </Button>
            <Button onClick={() => applyTemplate(category)}>
              Use {category} template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function ChipInput({ label, items, onRemove, draft, setDraft, onAdd }: {
  label: string; items: string[]; onRemove: (s: string) => void;
  draft: string; setDraft: (s: string) => void; onAdd: () => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-input border border-border rounded px-2 py-1">
      <span className="text-muted-foreground">{label}:</span>
      {items.map(t => (
        <span key={t} className="bg-muted px-1.5 rounded mono text-[11px] flex items-center gap-1">
          {t}
          <button onClick={() => onRemove(t)}><X className="size-3" /></button>
        </span>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
             onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); onAdd(); } }}
             placeholder="+"
             className="bg-transparent outline-none mono w-16" />
    </div>
  );
}

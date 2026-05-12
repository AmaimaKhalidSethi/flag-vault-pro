import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, DIFFICULTIES, categoryClass, difficultyClass, slugify, type Category, type Difficulty } from "@/lib/categories";
import { renderMarkdown } from "@/lib/markdown";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Save, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/writeups/new")({
  head: () => ({ meta: [{ title: "New writeup — Flagvault" }] }),
  component: NewWriteup,
});

type Event = { id: string; name: string };

function NewWriteup() {
  const nav = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("# Writeup\n\nDescribe the challenge…\n\n## Solution\n\n```bash\necho \"hello world\"\n```\n");
  const [category, setCategory] = useState<Category>("web");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [points, setPoints] = useState(100);
  const [flag, setFlag] = useState("");
  const [revealFlag, setRevealFlag] = useState(false);
  const [tools, setTools] = useState<string[]>([]);
  const [toolDraft, setToolDraft] = useState("");
  const [eventId, setEventId] = useState<string>("");
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      setUserId(data.session.user.id);
      const { data: prof } = await supabase.from("profiles").select("team_id").eq("id", data.session.user.id).maybeSingle();
      setTeamId(prof?.team_id ?? null);
      const { data: ev } = await supabase.from("ctf_events").select("id,name").order("created_at", { ascending: false });
      setEvents(ev ?? []);
    });
  }, []);

  const html = useMemo(() => renderMarkdown(body), [body]);

  function addTool() {
    const t = toolDraft.trim();
    if (t && !tools.includes(t)) setTools([...tools, t]);
    setToolDraft("");
  }

  async function save() {
    if (!userId) return toast.error("Not signed in");
    if (!title) return toast.error("Title required");
    setBusy(true);
    const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase.from("writeups").insert({
      title, slug, body_md: body, summary,
      difficulty, category, points: Number(points) || 0,
      flag: flag || null,
      tools_used: tools,
      is_published: publish,
      team_id: teamId,
      author_id: userId,
      event_id: eventId || null,
    }).select("slug").single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(publish ? "Published" : "Saved as draft");
    nav({ to: "/writeups/$slug", params: { slug: data.slug } });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Toolbar */}
      <div className="border-b border-border bg-card">
        <div className="px-4 py-3 flex flex-wrap items-center gap-2">
          <Input
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Writeup title…"
            className="text-lg font-semibold flex-1 min-w-[200px] !border-0 !bg-transparent shadow-none focus-visible:ring-0 px-0"
          />
          <Button variant="outline" onClick={() => save()} disabled={busy}>
            <Save className="size-4 mr-1.5" />Save draft
          </Button>
          <Button onClick={() => { setPublish(true); setTimeout(save, 0); }} disabled={busy}>
            Publish
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
              value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="flag{...}"
              className={`bg-transparent outline-none mono w-44 ${!revealFlag && flag ? "flag-blur" : ""}`}
            />
            <button onClick={() => setRevealFlag(!revealFlag)} className="text-muted-foreground">
              {revealFlag ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>

          <div className="flex items-center gap-1 bg-input border border-border rounded px-2 py-1">
            {tools.map(t => (
              <span key={t} className="bg-muted px-1.5 rounded mono text-[11px] flex items-center gap-1">
                {t}
                <button onClick={() => setTools(tools.filter(x => x !== t))}><X className="size-3" /></button>
              </span>
            ))}
            <input value={toolDraft} onChange={(e) => setToolDraft(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTool(); } }}
                   placeholder="+ tool"
                   className="bg-transparent outline-none mono w-20" />
          </div>

          <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Short summary…"
                 className="flex-1 min-w-[200px]" />
        </div>
      </div>

      {/* Split pane */}
      <div className="flex-1 grid md:grid-cols-2 min-h-0">
        <div className="border-r border-border min-h-0 overflow-auto">
          <CodeMirror
            value={body}
            onChange={setBody}
            extensions={[markdown()]}
            theme={oneDark}
            basicSetup={{ lineNumbers: true, foldGutter: true }}
            height="100%"
            style={{ fontSize: "14px", height: "100%" }}
          />
        </div>
        <div className="overflow-auto p-6 prose-cyber" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

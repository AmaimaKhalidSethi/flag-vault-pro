import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { renderMarkdown } from "@/lib/markdown";
import { categoryClass, difficultyClass, type Category, type Difficulty } from "@/lib/categories";
import { Eye, EyeOff, MessageCircle, Sparkles, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/writeups/$slug")({
  component: WriteupDetail,
});

type Wu = {
  id: string; title: string; body_md: string; summary: string | null;
  category: Category; difficulty: Difficulty; points: number;
  flag: string | null; tools_used: string[]; created_at: string;
  author_id: string; event_id: string | null;
  profiles: { username: string | null; avatar_url: string | null } | null;
  ctf_events: { name: string; url: string | null } | null;
};

type Comment = {
  id: string; body: string; author_id: string; created_at: string; writeup_id: string;
  profiles?: { username: string | null } | null;
};

function WriteupDetail() {
  const { slug } = Route.useParams();
  const [wu, setWu] = useState<Wu | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealFlag, setRevealFlag] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("writeups")
        .select("*, profiles:author_id(username, avatar_url), ctf_events:event_id(name, url)")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !data) { setLoading(false); return; }
      setWu(data as unknown as Wu);
      const { data: cs } = await supabase
        .from("comments")
        .select("*, profiles:author_id(username)")
        .eq("writeup_id", (data as { id: string }).id)
        .order("created_at", { ascending: true });
      setComments((cs ?? []) as unknown as Comment[]);
      setLoading(false);
    })();
  }, [slug]);

  // realtime
  useEffect(() => {
    if (!wu) return;
    const ch = supabase
      .channel(`comments:${wu.id}`)
      .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "comments", filter: `writeup_id=eq.${wu.id}` },
          async (payload) => {
            const newRow = payload.new as Comment;
            const { data: prof } = await supabase.from("profiles").select("username").eq("id", newRow.author_id).maybeSingle();
            setComments(prev => prev.find(c => c.id === newRow.id) ? prev : [...prev, { ...newRow, profiles: prof }]);
          })
      .on("postgres_changes",
          { event: "DELETE", schema: "public", table: "comments", filter: `writeup_id=eq.${wu.id}` },
          (payload) => setComments(prev => prev.filter(c => c.id !== (payload.old as { id: string }).id)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [wu]);

  const html = useMemo(() => renderMarkdown(wu?.body_md ?? ""), [wu?.body_md]);

  // wire copy buttons in markdown output
  useEffect(() => {
    function handler(e: Event) {
      const t = e.target as HTMLElement;
      if (t.matches?.("button[data-copy]")) {
        navigator.clipboard.writeText(t.getAttribute("data-copy") ?? "");
        toast.success("Copied");
      }
    }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  async function postComment() {
    if (!draft.trim() || !wu || !me) return;
    const { error } = await supabase.from("comments").insert({ writeup_id: wu.id, author_id: me, body: draft.trim() });
    if (error) toast.error(error.message);
    else setDraft("");
  }
  async function deleteComment(id: string) {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) toast.error(error.message);
  }

  if (loading) return <div className="p-6 mono text-sm text-muted-foreground">loading…</div>;
  if (!wu) return <div className="p-6">Not found.</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto grid lg:grid-cols-[1fr_280px] gap-6">
      <article className="min-w-0">
        <Link to="/writeups" className="text-xs mono text-primary hover:underline">← /writeups</Link>
        <h1 className="text-3xl font-bold mt-2">{wu.title}</h1>
        {wu.summary && <p className="text-muted-foreground mt-2">{wu.summary}</p>}
        <div className="flex flex-wrap gap-1.5 mt-3 text-xs">
          <span className={`px-1.5 py-0.5 rounded ${categoryClass[wu.category]}`}>{wu.category}</span>
          <span className={`px-1.5 py-0.5 rounded ${difficultyClass[wu.difficulty]}`}>{wu.difficulty}</span>
          <span className="px-1.5 py-0.5 rounded border border-border text-muted-foreground mono">{wu.points} pts</span>
          <span className="text-muted-foreground ml-2">by @{wu.profiles?.username ?? "anon"} · {formatDistanceToNow(new Date(wu.created_at), { addSuffix: true })}</span>
        </div>

        <div className="mt-6 prose-cyber" dangerouslySetInnerHTML={{ __html: html }} />

        {/* Comments */}
        <section className="mt-12">
          <h2 className="font-semibold flex items-center gap-2"><MessageCircle className="size-4" /> Comments ({comments.length})</h2>
          <div className="mt-3 space-y-3">
            {comments.map(c => (
              <div key={c.id} className="bg-card border border-border rounded-md p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="mono">@{c.profiles?.username ?? "anon"} · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                  {me === c.author_id && (
                    <button onClick={() => deleteComment(c.id)} className="text-muted-foreground hover:text-danger"><Trash2 className="size-3.5" /></button>
                  )}
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
            {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
          </div>
          <div className="mt-3 flex gap-2">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                      placeholder="Add a comment…"
                      className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm min-h-[60px]" />
            <Button onClick={postComment} disabled={!draft.trim()}>Post</Button>
          </div>
        </section>
      </article>

      <aside className="space-y-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold text-sm">Metadata</h3>
          <dl className="mt-3 text-sm space-y-2">
            <div>
              <dt className="text-xs text-muted-foreground">Flag</dt>
              <dd className="flex items-center gap-2 mt-1">
                {wu.flag ? (
                  <>
                    <code className={`mono text-xs bg-muted px-2 py-1 rounded flex-1 truncate ${!revealFlag ? "flag-blur" : ""}`}>{wu.flag}</code>
                    <button onClick={() => setRevealFlag(!revealFlag)} className="text-muted-foreground hover:text-primary">
                      {revealFlag ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </dd>
            </div>
            {wu.tools_used.length > 0 && (
              <div>
                <dt className="text-xs text-muted-foreground">Tools</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {wu.tools_used.map(t => <span key={t} className="text-xs mono bg-muted px-1.5 py-0.5 rounded">{t}</span>)}
                </dd>
              </div>
            )}
            {wu.ctf_events && (
              <div>
                <dt className="text-xs text-muted-foreground">CTF event</dt>
                <dd className="mt-1 text-sm">
                  {wu.ctf_events.url
                    ? <a href={wu.ctf_events.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{wu.ctf_events.name}</a>
                    : wu.ctf_events.name}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-card border border-dashed border-primary/40 rounded-lg p-4">
          <h3 className="font-semibold text-sm flex items-center gap-1.5"><Sparkles className="size-4 text-primary" /> AI Summary</h3>
          <p className="text-xs text-muted-foreground mt-2">
            Connect your Anthropic API key in <Link to="/settings" className="text-primary underline">Settings</Link> to enable auto-summarize, auto-tag, and writing suggestions.
          </p>
          <button disabled className="mt-3 w-full text-xs border border-border rounded-md px-3 py-1.5 text-muted-foreground cursor-not-allowed">
            Auto-summarize (requires API key)
          </button>
        </div>
      </aside>
    </div>
  );
}

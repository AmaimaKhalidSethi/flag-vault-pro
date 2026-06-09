import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { renderMarkdown } from "@/lib/markdown";
import { renderCommentMarkdown } from "@/lib/comment-markdown";
import { categoryClass, difficultyClass, type Category, type Difficulty } from "@/lib/categories";
import { Eye, EyeOff, MessageCircle, Sparkles, Trash2, Loader2, Share2, CalendarClock, Reply } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { aiSummarize, getAnthropicKey } from "@/lib/ai";
import { SyndicateMenu } from "@/components/SyndicateMenu";

export const Route = createFileRoute("/_app/writeups/$slug")({
  component: WriteupDetail,
});

type PublishMode = "draft" | "now" | "schedule";

type Wu = {
  id: string; title: string; body_md: string; summary: string | null;
  category: Category; difficulty: Difficulty; points: number;
  flag: string | null; tools_used: string[]; tags: string[];
  created_at: string; author_id: string; event_id: string | null;
  is_published: boolean;
  publish_at: string | null;
  profiles: { username: string | null; avatar_url: string | null } | null;
  ctf_events: { name: string; url: string | null; end_date: string | null } | null;
};

type Comment = {
  id: string; body: string; author_id: string; created_at: string; writeup_id: string;
  parent_id: string | null;
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
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("writeups")
        .select("*, profiles:author_id(username, avatar_url), ctf_events:event_id(name, url, end_date)")
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

  useEffect(() => {
    function handler(e: Event) {
      const t = e.target as HTMLElement;
      const btn = t.closest?.("button[data-copy]") as HTMLElement | null;
      if (btn) { navigator.clipboard.writeText(btn.getAttribute("data-copy") ?? ""); toast.success("Copied"); }
    }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  async function postComment(parent_id: string | null = null, bodyText = draft) {
    const text = bodyText.trim();
    if (!text || !wu || !me) return;
    const { error } = await supabase.from("comments").insert({ writeup_id: wu.id, author_id: me, body: text, parent_id });
    if (error) toast.error(error.message);
    else if (parent_id === null) setDraft("");
  }
  async function deleteComment(id: string) {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) toast.error(error.message);
  }
  function copyFlag() {
    if (!wu?.flag) return;
    navigator.clipboard.writeText(wu.flag);
    toast.success("Copied!");
  }
  function copyPublicLink() {
    if (!wu) return;
    const username = wu.profiles?.username ?? "anon";
    const url = `${window.location.origin}/u/${username}/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Public link copied");
  }
  async function runSummarize() {
    if (!wu) return;
    if (!getAnthropicKey()) return toast.error("AI failed — check your Anthropic API key in Settings.");
    setAiBusy(true);
    try {
      const s = await aiSummarize(`${wu.title}\n\n${wu.body_md}`);
      const { error } = await supabase.from("writeups").update({ summary: s }).eq("id", wu.id);
      if (error) throw error;
      setWu({ ...wu, summary: s });
      toast.success("Summary updated");
    } catch {
      toast.error("AI failed — check your Anthropic API key in Settings.");
    } finally { setAiBusy(false); }
  }

  // Optimistic publish toggle via TanStack Query
  const publishMutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (!wu) throw new Error("not loaded");
      const { error } = await supabase.from("writeups").update({ is_published: next }).eq("id", wu.id);
      if (error) throw error;
      return next;
    },
    onMutate: async (next: boolean) => {
      const prev = wu?.is_published ?? false;
      if (wu) setWu({ ...wu, is_published: next });
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (wu && ctx) setWu({ ...wu, is_published: ctx.prev });
      toast.error("Failed to update — changes reverted");
    },
    onSuccess: async (next) => {
      if (!wu) return;
      toast.success(next ? "Published" : "Unpublished");
      // Broadcast solve to event channel when going from draft → published
      if (next && wu.event_id) {
        const ch = supabase.channel(`event:${wu.event_id}`);
        await new Promise<void>((resolve) => {
          ch.subscribe((status) => { if (status === "SUBSCRIBED") resolve(); });
        });
        await ch.send({
          type: "broadcast",
          event: "solve",
          payload: {
            type: "solve",
            user: wu.profiles?.username ?? "anon",
            challenge: wu.title,
            category: wu.category,
            points: wu.points,
            timestamp: new Date().toISOString(),
          },
        });
        await supabase.removeChannel(ch);
      }
    },
  });

  if (loading) return <div className="p-6 mono text-sm text-muted-foreground">loading…</div>;
  if (!wu) return <div className="p-6">Not found.</div>;

  const isAuthor = me === wu.author_id;

  return (
    <div className="p-6 max-w-6xl mx-auto grid lg:grid-cols-[1fr_280px] gap-6">
      <article className="min-w-0">
        <Link to="/writeups" className="text-xs mono text-primary hover:underline">← /writeups</Link>
        <div className="flex items-start justify-between gap-3 mt-2">
          <h1 className="text-3xl font-bold">{wu.title}</h1>
          <div className="flex items-center gap-2">
            {isAuthor && (
              <SyndicateMenu writeup={{
                title: wu.title, slug: slug, body_md: wu.body_md,
                category: wu.category, tags: wu.tags ?? [],
                ctf_name: wu.ctf_events?.name ?? null,
              }} />
            )}
            {wu.is_published && (
              <Button size="sm" variant="outline" onClick={copyPublicLink}>
                <Share2 className="size-3.5 mr-1" />Copy public link
              </Button>
            )}
          </div>
        </div>
        {wu.summary && <p className="text-muted-foreground mt-2">{wu.summary}</p>}
        <div className="flex flex-wrap gap-1.5 mt-3 text-xs">
          <span className={`px-1.5 py-0.5 rounded ${categoryClass[wu.category]}`}>{wu.category}</span>
          <span className={`px-1.5 py-0.5 rounded ${difficultyClass[wu.difficulty]}`}>{wu.difficulty}</span>
          <span className="px-1.5 py-0.5 rounded border border-border text-muted-foreground mono">{wu.points} pts</span>
          <span className="text-muted-foreground ml-2">by @{wu.profiles?.username ?? "anon"} · {formatDistanceToNow(new Date(wu.created_at), { addSuffix: true })}</span>
        </div>

        <div className="mt-6 prose-cyber" dangerouslySetInnerHTML={{ __html: html }} />

        <CommentsSection
          comments={comments}
          me={me}
          draft={draft}
          setDraft={setDraft}
          onPost={() => postComment(null, draft)}
          onReply={(parentId, body) => postComment(parentId, body)}
          onDelete={deleteComment}
        />
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
                    <code onClick={copyFlag} title="Click to copy"
                          className={`mono text-xs bg-muted px-2 py-1 rounded flex-1 truncate cursor-pointer ${!revealFlag ? "flag-blur" : ""}`}>{wu.flag}</code>
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
            {wu.tags?.length > 0 && (
              <div>
                <dt className="text-xs text-muted-foreground">Tags</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {wu.tags.map(t => <span key={t} className="text-xs mono bg-muted px-1.5 py-0.5 rounded">#{t}</span>)}
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

        {isAuthor && (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Visibility</h3>
                <p className="text-xs text-muted-foreground mt-0.5 mono">
                  {wu.is_published ? "public" : "draft"}
                </p>
              </div>
              <Switch
                checked={wu.is_published}
                onCheckedChange={(v) => publishMutation.mutate(v)}
                aria-label="Toggle published"
              />
            </div>
            {wu.event_id && (
              <p className="text-[10px] text-muted-foreground mt-2 mono">
                publishing broadcasts a solve to the event feed
              </p>
            )}
          </div>
        )}

        {isAuthor && (
          <div className="bg-card border border-dashed border-primary/40 rounded-lg p-4">
            <h3 className="font-semibold text-sm flex items-center gap-1.5"><Sparkles className="size-4 text-primary" /> AI</h3>
            <p className="text-xs text-muted-foreground mt-2">
              Uses your <Link to="/settings" className="text-primary underline">Anthropic key</Link>. Stored locally only.
            </p>
            <Button size="sm" variant="outline" disabled={aiBusy} onClick={runSummarize} className="w-full mt-3">
              {aiBusy ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Sparkles className="size-3.5 mr-1" />}
              Auto-summarize
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}

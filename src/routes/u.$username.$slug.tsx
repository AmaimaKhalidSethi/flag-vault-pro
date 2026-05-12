import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { renderMarkdown } from "@/lib/markdown";
import { categoryClass, difficultyClass, type Category, type Difficulty } from "@/lib/categories";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/u/$username/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — @${params.username}` }] }),
  component: PublicWriteup,
});

type Wu = {
  id: string; title: string; body_md: string; summary: string | null;
  category: Category; difficulty: Difficulty; points: number;
  tools_used: string[]; tags: string[]; created_at: string;
  is_published: boolean;
  profiles: { username: string | null; avatar_url: string | null } | null;
  ctf_events: { name: string; url: string | null } | null;
};

function PublicWriteup() {
  const { slug, username } = Route.useParams();
  const [wu, setWu] = useState<Wu | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("writeups")
        .select("*, profiles:author_id(username, avatar_url), ctf_events:event_id(name, url)")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      setWu(data as unknown as Wu | null);
      setLoading(false);
    })();
  }, [slug]);

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

  if (loading) return <div className="min-h-screen grid place-items-center mono text-sm text-muted-foreground">loading…</div>;
  if (!wu || wu.profiles?.username !== username) return <div className="min-h-screen grid place-items-center">Writeup not found or not public.</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-7 rounded bg-primary text-primary-foreground grid place-items-center font-bold">F</div>
            <span className="font-semibold">Flagvault</span>
          </Link>
          <Link to="/u/$username" params={{ username }} className="text-sm text-primary hover:underline">@{username}</Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 grid lg:grid-cols-[1fr_260px] gap-6">
        <article className="min-w-0">
          <h1 className="text-3xl font-bold">{wu.title}</h1>
          {wu.summary && <p className="text-muted-foreground mt-2">{wu.summary}</p>}
          <div className="flex flex-wrap gap-1.5 mt-3 text-xs">
            <span className={`px-1.5 py-0.5 rounded ${categoryClass[wu.category]}`}>{wu.category}</span>
            <span className={`px-1.5 py-0.5 rounded ${difficultyClass[wu.difficulty]}`}>{wu.difficulty}</span>
            <span className="px-1.5 py-0.5 rounded border border-border text-muted-foreground mono">{wu.points} pts</span>
            <span className="text-muted-foreground ml-2">by @{wu.profiles?.username} · {format(new Date(wu.created_at), "MMM d, yyyy")}</span>
          </div>

          <div className="mt-6 prose-cyber" dangerouslySetInnerHTML={{ __html: html }} />
        </article>

        <aside className="space-y-3">
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="font-semibold text-sm">Metadata</h3>
            <dl className="mt-3 text-sm space-y-2">
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
        </aside>
      </div>
    </div>
  );
}

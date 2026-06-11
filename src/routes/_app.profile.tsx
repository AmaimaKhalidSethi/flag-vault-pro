import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CATEGORIES, categoryClass, difficultyClass, type Category, type Difficulty } from "@/lib/categories";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — Flagvault" }] }),
  component: ProfilePage,
});

type Wu = { id: string; title: string; slug: string; category: Category; difficulty: Difficulty; points: number; created_at: string };

function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ username: string | null; avatar_url: string | null; created_at: string } | null>(null);
  const [wus, setWus] = useState<Wu[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("username, avatar_url, created_at").eq("id", user.id).maybeSingle();
      setProfile(p);
      const { data: w } = await supabase.from("writeups").select("id,title,slug,category,difficulty,points,created_at").eq("author_id", user.id).order("created_at", { ascending: false });
      setWus((w ?? []) as Wu[]);
    })();
  }, [user]);

  const total = wus.length;
  const points = wus.reduce((s, w) => s + (w.points || 0), 0);
  const byCat = CATEGORIES.map(c => ({ c, n: wus.filter(w => w.category === c).length })).filter(x => x.n > 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <p className="mono text-xs text-primary">~/profile</p>
      <div className="bg-card border border-border rounded-lg p-6 mt-2 flex items-center gap-4">
        <div className="size-16 rounded-full bg-muted grid place-items-center font-bold text-xl">
          {profile?.avatar_url ? <img src={profile.avatar_url} className="size-16 rounded-full" /> : (profile?.username ?? user?.email ?? "?")[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">@{profile?.username ?? "anon"}</h1>
          <p className="text-sm text-muted-foreground mono">{user?.email}</p>
          {profile && <p className="text-xs text-muted-foreground mt-1">Member since {format(new Date(profile.created_at), "MMM yyyy")}</p>}
        </div>
        <div className="ml-auto grid grid-cols-2 gap-3 text-center">
          <div><div className="text-xl font-semibold mono">{total}</div><div className="text-xs text-muted-foreground">writeups</div></div>
          <div><div className="text-xl font-semibold mono text-primary">{points}</div><div className="text-xs text-muted-foreground">points</div></div>
        </div>
      </div>

      {byCat.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5 mt-4">
          <h2 className="font-semibold">Solves by category</h2>
          <div className="flex flex-wrap gap-2 mt-3">
            {byCat.map(({ c, n }) => (
              <span key={c} className={`px-2 py-1 rounded text-xs ${categoryClass[c]}`}>{c} · {n}</span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-5 mt-4">
        <h2 className="font-semibold">Recent writeups</h2>
        {wus.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-3">Nothing yet. <Link to="/writeups/new" className="text-primary underline">Write your first one →</Link></p>
        ) : (
          <ul className="divide-y divide-border mt-3">
            {wus.map(w => (
              <li key={w.id} className="py-2 flex items-center justify-between gap-2">
                <Link to="/writeups/$slug" params={{ slug: w.slug }} className="hover:text-primary text-sm truncate">{w.title}</Link>
                <div className="flex gap-1.5 text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${categoryClass[w.category]}`}>{w.category}</span>
                  <span className={`px-1.5 py-0.5 rounded ${difficultyClass[w.difficulty]}`}>{w.difficulty}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

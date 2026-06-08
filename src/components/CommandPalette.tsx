import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { supabase } from "@/integrations/supabase/client";
import { useDebounced } from "@/hooks/use-debounced";
import { CATEGORIES, categoryClass, difficultyClass, type Category, type Difficulty } from "@/lib/categories";
import { FileText, Plus, Trophy, User } from "lucide-react";

type Hit = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  category: Category;
  difficulty: Difficulty;
  points: number;
  profiles: { username: string | null } | null;
};

const PALETTE_EVENT = "flagvault:open-palette";
export function openCommandPalette() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PALETTE_EVENT));
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQ = useDebounced(q, 200);
  const navigate = useNavigate();

  // ⌘K / Ctrl+K toggle + custom event
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpen() { setOpen(true); }
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase
        .from("writeups")
        .select("id,title,slug,summary,category,difficulty,points, profiles:author_id(username)")
        .order("created_at", { ascending: false })
        .limit(40);

      const term = debouncedQ.trim();
      if (term) {
        query = query.textSearch("search_tsv", term, { type: "websearch", config: "english" });
      }

      const { data } = await query;
      if (!cancelled) {
        setHits((data ?? []) as unknown as Hit[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQ]);

  // Reset query when closing
  useEffect(() => { if (!open) setQ(""); }, [open]);

  const grouped = useMemo(() => {
    const map = new Map<Category, Hit[]>();
    for (const h of hits) {
      if (!map.has(h.category)) map.set(h.category, []);
      map.get(h.category)!.push(h);
    }
    return CATEGORIES.map((c) => [c, map.get(c) ?? []] as const).filter(([, arr]) => arr.length > 0);
  }, [hits]);

  function go(to: string) {
    setOpen(false);
    navigate({ to });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 max-w-2xl">
        <VisuallyHidden><DialogTitle>Command palette</DialogTitle></VisuallyHidden>
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:font-medium">
          <CommandInput
            placeholder="Search writeups, jump to a page…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList className="max-h-[420px]">
            {!loading && hits.length === 0 && q && (
              <CommandEmpty>No matches for "{q}".</CommandEmpty>
            )}

            <CommandGroup heading="Quick actions">
              <CommandItem onSelect={() => go("/writeups/new")}>
                <Plus className="size-4 text-primary" />
                <span>New writeup</span>
                <kbd className="ml-auto mono text-[10px] text-muted-foreground">N</kbd>
              </CommandItem>
              <CommandItem onSelect={() => go("/events")}>
                <Trophy className="size-4 text-primary" />
                <span>Browse events</span>
              </CommandItem>
              <CommandItem onSelect={() => go("/profile")}>
                <User className="size-4 text-primary" />
                <span>My profile</span>
              </CommandItem>
            </CommandGroup>

            {grouped.length > 0 && <CommandSeparator />}

            {grouped.map(([cat, arr]) => (
              <CommandGroup key={cat} heading={cat}>
                {arr.map((h) => (
                  <CommandItem
                    key={h.id}
                    value={`${h.title} ${h.summary ?? ""} ${cat} ${h.profiles?.username ?? ""}`}
                    onSelect={() => go(`/writeups/${h.slug}`)}
                  >
                    <FileText className="size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{h.title}</div>
                      {h.summary && (
                        <div className="text-xs text-muted-foreground truncate">{h.summary}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${categoryClass[h.category]}`}>{h.category}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${difficultyClass[h.difficulty]}`}>{h.difficulty}</span>
                      <span className="text-[10px] mono text-muted-foreground border border-border rounded px-1.5 py-0.5">{h.points}pt</span>
                      {h.profiles?.username && (
                        <span className="text-[10px] mono text-muted-foreground ml-1">@{h.profiles.username}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          <div className="border-t border-border px-3 py-1.5 text-[10px] mono text-muted-foreground flex items-center justify-between">
            <span>↑↓ navigate · ↵ open · esc close</span>
            <span>⌘K</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

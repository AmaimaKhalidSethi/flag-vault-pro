import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Rocket, Github, BookOpen, Hash, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { listIntegrations, type Provider } from "@/lib/integrations";
import {
  githubListRepos,
  githubCommit,
  mediumPublish,
  devtoPublish,
} from "@/lib/syndication.functions";

export type SyndicateWriteup = {
  title: string;
  slug: string;
  body_md: string;
  category: string;
  tags: string[];
  ctf_name?: string | null;
};

function buildFrontmatter(w: SyndicateWriteup) {
  const lines = [
    "---",
    `title: ${JSON.stringify(w.title)}`,
    `slug: ${w.slug}`,
    `category: ${w.category}`,
    w.ctf_name ? `ctf: ${JSON.stringify(w.ctf_name)}` : null,
    `tags: [${w.tags.map((t) => JSON.stringify(t)).join(", ")}]`,
    "---",
    "",
  ].filter(Boolean) as string[];
  return lines.join("\n");
}

export function SyndicateMenu({ writeup }: { writeup: SyndicateWriteup }) {
  const [connected, setConnected] = useState<Set<Provider>>(new Set());
  const [open, setOpen] = useState<null | Provider>(null);

  useEffect(() => {
    listIntegrations()
      .then((rows) => setConnected(new Set(rows.map((r) => r.provider))))
      .catch(() => undefined);
  }, []);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Rocket className="size-3.5 mr-1.5" />
            Syndicate
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs">Push this writeup to…</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!connected.has("github")} onSelect={() => setOpen("github")}>
            <Github className="size-3.5 mr-2" /> GitHub repo
            {!connected.has("github") && <span className="ml-auto text-[10px] text-muted-foreground">link</span>}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!connected.has("medium")} onSelect={() => setOpen("medium")}>
            <BookOpen className="size-3.5 mr-2" /> Medium
            {!connected.has("medium") && <span className="ml-auto text-[10px] text-muted-foreground">link</span>}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!connected.has("devto")} onSelect={() => setOpen("devto")}>
            <Hash className="size-3.5 mr-2" /> Dev.to
            {!connected.has("devto") && <span className="ml-auto text-[10px] text-muted-foreground">link</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <GithubDialog open={open === "github"} onClose={() => setOpen(null)} writeup={writeup} />
      <MediumDialog open={open === "medium"} onClose={() => setOpen(null)} writeup={writeup} />
      <DevtoDialog open={open === "devto"} onClose={() => setOpen(null)} writeup={writeup} />
    </>
  );
}

function successToast(label: string, url: string) {
  toast.success(
    <span className="flex items-center gap-2">
      Published to {label}
      <a href={url} target="_blank" rel="noreferrer"
         className="text-primary underline inline-flex items-center gap-1">
        open <ExternalLink className="size-3" />
      </a>
    </span>,
  );
}

function GithubDialog({ open, onClose, writeup }: { open: boolean; onClose: () => void; writeup: SyndicateWriteup }) {
  const reposFn = useServerFn(githubListRepos);
  const commitFn = useServerFn(githubCommit);
  const [repos, setRepos] = useState<Array<{ full_name: string; default_branch: string; private: boolean }>>([]);
  const [repo, setRepo] = useState("");
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPath(`ctfs/${(writeup.ctf_name ?? "misc").toLowerCase().replace(/\s+/g, "-")}/${writeup.slug}.md`);
    reposFn()
      .then((r) => setRepos(r))
      .catch((e: Error) => toast.error(e.message));
  }, [open, writeup, reposFn]);

  async function commit() {
    if (!repo) return toast.error("Select a repository");
    setBusy(true);
    try {
      const content = buildFrontmatter(writeup) + writeup.body_md;
      const out = await commitFn({
        data: { repo, path, content, message: `Add writeup: ${writeup.title}` },
      });
      successToast("GitHub", out.url);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Github className="size-4" /> Push to GitHub</DialogTitle>
          <DialogDescription>Commits a Markdown file with YAML frontmatter to your repo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Repository</Label>
            <Select value={repo} onValueChange={setRepo}>
              <SelectTrigger><SelectValue placeholder={repos.length ? "Pick a repo…" : "Loading…"} /></SelectTrigger>
              <SelectContent className="max-h-72">
                {repos.map((r) => (
                  <SelectItem key={r.full_name} value={r.full_name} className="mono text-xs">
                    {r.full_name}{r.private ? " 🔒" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>File path</Label>
            <Input value={path} onChange={(e) => setPath(e.target.value)} className="mono" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={commit} disabled={busy || !repo}>
            {busy ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
            Commit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MediumDialog({ open, onClose, writeup }: { open: boolean; onClose: () => void; writeup: SyndicateWriteup }) {
  const fn = useServerFn(mediumPublish);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"public" | "draft" | "unlisted">("draft");

  async function publish() {
    setBusy(true);
    try {
      const out = await fn({
        data: {
          title: writeup.title,
          markdown: writeup.body_md,
          tags: writeup.tags.slice(0, 5),
          publishStatus: status,
        },
      });
      successToast("Medium", out.url);
      onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BookOpen className="size-4" /> Publish to Medium</DialogTitle>
          <DialogDescription>Posts as a Markdown article on your Medium account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Visibility</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="unlisted">Unlisted</SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Tags: {writeup.tags.slice(0, 5).join(", ") || "—"}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={publish} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DevtoDialog({ open, onClose, writeup }: { open: boolean; onClose: () => void; writeup: SyndicateWriteup }) {
  const fn = useServerFn(devtoPublish);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const out = await fn({
        data: { title: writeup.title, markdown: writeup.body_md, tags: writeup.tags.slice(0, 4), published },
      });
      successToast("Dev.to", out.url);
      onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Hash className="size-4" /> Cross-post to Dev.to</DialogTitle>
          <DialogDescription>Creates an article from your writeup&apos;s markdown.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3">
          <Switch checked={published} onCheckedChange={setPublished} id="dt-pub" />
          <Label htmlFor="dt-pub" className="text-sm">
            Publish immediately {published ? "(public)" : "(draft)"}
          </Label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={go} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

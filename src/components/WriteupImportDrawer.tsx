import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Github, Link as LinkIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { importGist, importRawMarkdown } from "@/lib/import.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (data: { body: string; title?: string; source: string }) => void;
};

function extractTitle(md: string): string | null {
  const m = md.match(/^\s*#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

export function WriteupImportDrawer({ open, onOpenChange, onImport }: Props) {
  const gistFn = useServerFn(importGist);
  const rawFn = useServerFn(importRawMarkdown);

  const fileRef = useRef<HTMLInputElement>(null);
  const [gistUrl, setGistUrl] = useState("");
  const [rawUrl, setRawUrl] = useState("");
  const [busy, setBusy] = useState<null | "file" | "gist" | "raw">(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 500_000) return toast.error("File too large (>500KB)");
    setBusy("file");
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const title = extractTitle(text) ?? f.name.replace(/\.md$/i, "");
      onImport({ body: text, title, source: f.name });
      toast.success(`Imported ${f.name}`);
      setBusy(null);
      onOpenChange(false);
    };
    reader.onerror = () => { setBusy(null); toast.error("Read failed"); };
    reader.readAsText(f);
  }

  async function handleGist() {
    if (!gistUrl.trim()) return;
    setBusy("gist");
    try {
      const r = await gistFn({ data: { input: gistUrl } });
      onImport({ body: r.content, title: r.title, source: `gist:${r.filename}` });
      toast.success(`Imported ${r.filename}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally { setBusy(null); }
  }

  async function handleRaw() {
    if (!rawUrl.trim()) return;
    setBusy("raw");
    try {
      const r = await rawFn({ data: { url: rawUrl } });
      const title = extractTitle(r.content) ?? undefined;
      onImport({ body: r.content, title, source: rawUrl });
      toast.success("Imported markdown");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally { setBusy(null); }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="max-w-2xl mx-auto w-full">
          <DrawerHeader>
            <DrawerTitle>Import writeup</DrawerTitle>
            <DrawerDescription>Bring in existing markdown from a file, gist, or raw URL.</DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-4">
            <Tabs defaultValue="file">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="file"><Upload className="size-3.5 mr-1" />File</TabsTrigger>
                <TabsTrigger value="gist"><Github className="size-3.5 mr-1" />Gist</TabsTrigger>
                <TabsTrigger value="raw"><LinkIcon className="size-3.5 mr-1" />Raw URL</TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="space-y-2 mt-4">
                <Label>Upload a .md file</Label>
                <Input ref={fileRef} type="file" accept=".md,text/markdown,text/plain" onChange={handleFile} disabled={busy !== null} />
                <p className="text-xs text-muted-foreground">First <code className="mono">#&nbsp;Heading</code> becomes the title.</p>
              </TabsContent>

              <TabsContent value="gist" className="space-y-2 mt-4">
                <Label>GitHub Gist URL</Label>
                <Input value={gistUrl} onChange={(e) => setGistUrl(e.target.value)} placeholder="https://gist.github.com/user/abc123…" />
                <Button onClick={handleGist} disabled={busy !== null || !gistUrl.trim()}>
                  {busy === "gist" ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Github className="size-3.5 mr-1" />}
                  Import gist
                </Button>
                <p className="text-xs text-muted-foreground">Fetches the first <code className="mono">.md</code> file in the gist (public only).</p>
              </TabsContent>

              <TabsContent value="raw" className="space-y-2 mt-4">
                <Label>Raw markdown URL</Label>
                <Input value={rawUrl} onChange={(e) => setRawUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/…/writeup.md" />
                <Button onClick={handleRaw} disabled={busy !== null || !rawUrl.trim()}>
                  {busy === "raw" ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <LinkIcon className="size-3.5 mr-1" />}
                  Fetch URL
                </Button>
                <p className="text-xs text-muted-foreground">Works for HackMD exports, raw GitHub URLs, anything that serves text.</p>
              </TabsContent>
            </Tabs>
          </div>

          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

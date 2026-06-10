import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, Loader2, ExternalLink, Check } from "lucide-react";
import { importCtftimeEvent } from "@/lib/import.functions";

export const Route = createFileRoute("/_app/events/new")({
  head: () => ({ meta: [{ title: "New CTF event — Flagvault" }] }),
  component: NewEvent,
});

function dateInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(+d)) return "";
  return d.toISOString().slice(0, 10);
}

function NewEvent() {
  const nav = useNavigate();
  const ctftimeFn = useServerFn(importCtftimeEvent);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // CTFtime import state
  const [ctftimeInput, setCtftimeInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<null | {
    id: string; name: string; url: string; start: string | null; finish: string | null;
  }>(null);

  async function runImport() {
    if (!ctftimeInput.trim()) return;
    setImporting(true);
    try {
      const r = await ctftimeFn({ data: { input: ctftimeInput } });
      setPreview(r);
      toast.success(`Loaded "${r.name}"`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function applyPreview() {
    if (!preview) return;
    setName(preview.name);
    setUrl(preview.url);
    setStart(dateInputValue(preview.start));
    setEnd(dateInputValue(preview.finish));
    setPreview(null);
    setCtftimeInput("");
    toast.success("Form pre-filled");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) return setErr("Name is required");
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setBusy(false); return; }
    const { data, error } = await supabase.from("ctf_events").insert({
      name: name.trim(),
      url: url.trim() || null,
      start_date: start || null,
      end_date: end || null,
      created_by: u.user.id,
    }).select("id").single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Event created");
    nav({ to: "/events/$id", params: { id: data.id } });
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <p className="mono text-xs text-primary">~/events/new</p>
      <h1 className="text-2xl font-semibold mt-1">New CTF event</h1>

      <div className="bg-card border border-dashed border-primary/40 rounded-lg p-4 mt-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Download className="size-4 text-primary" /> Import from CTFtime
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Paste a <span className="mono">https://ctftime.org/event/1234</span> URL or just the numeric ID.
        </p>
        <div className="flex gap-2 mt-3">
          <Input value={ctftimeInput} onChange={(e) => setCtftimeInput(e.target.value)}
                 placeholder="https://ctftime.org/event/…" disabled={importing} />
          <Button type="button" onClick={runImport} disabled={importing || !ctftimeInput.trim()}>
            {importing ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Download className="size-3.5 mr-1" />}
            Fetch
          </Button>
        </div>

        {preview && (
          <div className="mt-4 bg-background border border-border rounded-md p-3 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{preview.name}</div>
              <a href={`https://ctftime.org/event/${preview.id}`} target="_blank" rel="noreferrer"
                 className="text-xs text-primary hover:underline flex items-center gap-1">
                ctftime <ExternalLink className="size-3" />
              </a>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-xs">
              <dt className="text-muted-foreground">URL</dt>
              <dd className="col-span-2 mono truncate">{preview.url || "—"}</dd>
              <dt className="text-muted-foreground">Start</dt>
              <dd className="col-span-2 mono">{preview.start ?? "—"}</dd>
              <dt className="text-muted-foreground">End</dt>
              <dd className="col-span-2 mono">{preview.finish ?? "—"}</dd>
            </dl>
            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" onClick={applyPreview}>
                <Check className="size-3.5 mr-1" /> Confirm and use
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPreview(null)}>
                Discard
              </Button>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={submit} className="bg-card border border-border rounded-lg p-5 mt-5 space-y-4">
        <div>
          <Label>Name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="picoCTF 2024" />
          {err && <p className="text-xs text-danger mt-1">{err}</p>}
        </div>
        <div>
          <Label>Event URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start date</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><Label>End date</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create event"}</Button>
      </form>
    </div>
  );
}

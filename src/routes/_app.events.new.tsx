import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/events/new")({
  head: () => ({ meta: [{ title: "New CTF event — Flagvault" }] }),
  component: NewEvent,
});

function NewEvent() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

      <form onSubmit={submit} className="bg-card border border-border rounded-lg p-5 mt-5 space-y-4">
        <div>
          <Label>Name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="picoCTF 2024" />
          {err && <p className="text-xs text-danger mt-1">{err}</p>}
        </div>
        <div>
          <Label>CTFtime URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://ctftime.org/event/…" />
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

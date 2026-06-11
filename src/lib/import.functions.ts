import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";



const UA = "flag-vault-pro/1.0";

// ── CTFtime ────────────────────────────────────────────────────────────────────
function extractCtftimeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/ctftime\.org\/event\/(\d+)/i);
  return m ? m[1] : null;
}

export const importCtftimeEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { input: string }) =>
    z.object({ input: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const id = extractCtftimeId(data.input);
    if (!id) throw new Error("Invalid CTFtime URL or ID");
    const res = await fetch(`https://ctftime.org/api/v1/events/${id}/`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`CTFtime returned ${res.status}`);
    const json = (await res.json()) as {
      title?: string;
      url?: string;
      start?: string;
      finish?: string;
      ctftime_url?: string;
    };
    return {
      id,
      name: json.title ?? "",
      url: json.url || json.ctftime_url || `https://ctftime.org/event/${id}`,
      start: json.start ?? null,
      finish: json.finish ?? null,
    };
  });

// ── GitHub Gist ────────────────────────────────────────────────────────────────
function extractGistId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-f0-9]{20,}$/i.test(trimmed)) return trimmed;
  const m = trimmed.match(/gist\.github\.com\/[^/]+\/([a-f0-9]+)/i);
  return m ? m[1] : null;
}

export const importGist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { input: string }) =>
    z.object({ input: z.string().min(1).max(500) }).parse(data),
  )
  .handler(async ({ data }) => {
    const id = extractGistId(data.input);
    if (!id) throw new Error("Invalid Gist URL or ID");
    const res = await fetch(`https://api.github.com/gists/${id}`, {
      headers: { "User-Agent": UA, Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
    const json = (await res.json()) as {
      files?: Record<string, { filename?: string; content?: string; raw_url?: string }>;
    };
    const files = json.files ?? {};
    const mdFile = Object.values(files).find(
      (f) => f?.filename && /\.md$/i.test(f.filename),
    );
    if (!mdFile) throw new Error("No .md file in this gist");
    let content = mdFile.content ?? "";
    if (!content && mdFile.raw_url) {
      const r2 = await fetch(mdFile.raw_url, { headers: { "User-Agent": UA } });
      if (r2.ok) content = await r2.text();
    }
    return {
      filename: mdFile.filename ?? "writeup.md",
      title: (mdFile.filename ?? "writeup").replace(/\.md$/i, ""),
      content,
    };
  });

// ── Raw markdown URL ───────────────────────────────────────────────────────────
export const importRawMarkdown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { url: string }) =>
    z.object({ url: z.string().url().max(1000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const u = new URL(data.url);
    if (!/^https?:$/.test(u.protocol)) throw new Error("Only http(s) URLs allowed");
    const res = await fetch(data.url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`Fetch returned ${res.status}`);
    const content = await res.text();
    if (content.length > 500_000) throw new Error("File too large (>500KB)");
    return { content };
  });

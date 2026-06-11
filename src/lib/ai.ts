// Anthropic client for browser-direct calls.
// API key is kept in sessionStorage (not persisted long-term) and never sent to the backend.

export const ANTHROPIC_KEY_STORAGE = "fv_anthropic_key";
export const LEGACY_KEY_STORAGE = "flagvault.anthropic_key";

export function getAnthropicKey(): string | null {
  if (typeof window === "undefined") return null;
  // One-time migration: copy legacy key into session storage, then remove legacy localStorage entry.
  const legacy = localStorage.getItem(LEGACY_KEY_STORAGE);
  if (legacy && !sessionStorage.getItem(ANTHROPIC_KEY_STORAGE)) {
    sessionStorage.setItem(ANTHROPIC_KEY_STORAGE, legacy);
    localStorage.removeItem(LEGACY_KEY_STORAGE);
  } else if (legacy) {
    localStorage.removeItem(LEGACY_KEY_STORAGE);
  }
  return sessionStorage.getItem(ANTHROPIC_KEY_STORAGE);
}

export function setAnthropicKey(key: string) {
  if (typeof window === "undefined") return;
  if (key) {
    sessionStorage.setItem(ANTHROPIC_KEY_STORAGE, key);
  } else {
    sessionStorage.removeItem(ANTHROPIC_KEY_STORAGE);
    localStorage.removeItem(LEGACY_KEY_STORAGE);
  }
}

export function maskKey(key: string | null): string {
  if (!key || key.length < 4) return "—";
  return "••••" + key.slice(-4);
}

type ClaudeMsg = { role: "user" | "assistant"; content: string };

export async function callAnthropic(opts: {
  system: string;
  messages: ClaudeMsg[];
  maxTokens?: number;
  model?: string;
}): Promise<string> {
  const key = getAnthropicKey();
  if (!key) throw new Error("Missing Anthropic API key");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: opts.model ?? "claude-opus-4-5",
      max_tokens: opts.maxTokens ?? 300,
      system: opts.system,
      messages: opts.messages,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (json.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();
  return text;
}

export async function aiSummarize(body: string) {
  return callAnthropic({
    system:
      "You are a CTF writeup assistant. Write a 2-3 sentence TL;DR summary of this writeup. Be technical and concise. Output plain text only.",
    messages: [{ role: "user", content: body.slice(0, 12000) }],
    maxTokens: 300,
  });
}

export async function aiAutoTag(body: string): Promise<string[]> {
  const text = await callAnthropic({
    system:
      'Extract relevant CTF tags from this writeup. Return ONLY a JSON array of lowercase strings, max 6 items. Examples: ["heap","rop","format-string","glibc-2.35"]',
    messages: [{ role: "user", content: body.slice(0, 12000) }],
    maxTokens: 300,
  });
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return [];
    return arr.map(String).map((s) => s.toLowerCase().trim()).filter(Boolean).slice(0, 6);
  } catch {
    return [];
  }
}

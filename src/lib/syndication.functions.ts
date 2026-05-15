import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Provider = "github" | "medium" | "devto";

async function getToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  provider: Provider,
): Promise<string> {
  const { data, error } = await supabase
    .from("user_integrations")
    .select("token")
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.token) throw new Error(`${provider} not connected`);
  return data.token as string;
}

// ── GitHub ────────────────────────────────────────────────────────────────────
export const githubListRepos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const token = await getToken(context.supabase, "github");
    const res = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Flagvault",
        },
      },
    );
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as Array<{
      full_name: string;
      default_branch: string;
      private: boolean;
    }>;
    return data.map((r) => ({
      full_name: r.full_name,
      default_branch: r.default_branch,
      private: r.private,
    }));
  });

export const githubCommit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        repo: z.string().min(1).max(200),
        path: z.string().min(1).max(500),
        content: z.string().min(1),
        message: z.string().min(1).max(200),
        branch: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const token = await getToken(context.supabase, "github");
    const url = `https://api.github.com/repos/${data.repo}/contents/${encodeURI(data.path)}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Flagvault",
      "Content-Type": "application/json",
    };
    // Look up SHA for update if file exists
    let sha: string | undefined;
    const probe = await fetch(url + (data.branch ? `?ref=${data.branch}` : ""), { headers });
    if (probe.ok) {
      const j = (await probe.json()) as { sha?: string };
      sha = j.sha;
    }
    const body: Record<string, unknown> = {
      message: data.message,
      content: btoa(unescape(encodeURIComponent(data.content))),
    };
    if (data.branch) body.branch = data.branch;
    if (sha) body.sha = sha;

    const res = await fetch(url, { method: "PUT", headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = (await res.json()) as { content?: { html_url?: string }; commit?: { html_url?: string } };
    return { url: j.content?.html_url ?? j.commit?.html_url ?? `https://github.com/${data.repo}` };
  });

// ── Medium ────────────────────────────────────────────────────────────────────
export const mediumPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        title: z.string().min(1).max(200),
        markdown: z.string().min(1),
        tags: z.array(z.string().min(1).max(30)).max(5).default([]),
        publishStatus: z.enum(["public", "draft", "unlisted"]).default("draft"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const token = await getToken(context.supabase, "medium");
    const meRes = await fetch("https://api.medium.com/v1/me", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!meRes.ok) throw new Error(`Medium ${meRes.status}: ${(await meRes.text()).slice(0, 200)}`);
    const me = (await meRes.json()) as { data?: { id?: string } };
    const userId = me.data?.id;
    if (!userId) throw new Error("Medium: failed to load user id");

    const res = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        title: data.title,
        contentFormat: "markdown",
        content: `# ${data.title}\n\n${data.markdown}`,
        tags: data.tags,
        publishStatus: data.publishStatus,
      }),
    });
    if (!res.ok) throw new Error(`Medium ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = (await res.json()) as { data?: { url?: string } };
    if (!j.data?.url) throw new Error("Medium: missing url in response");
    return { url: j.data.url };
  });

// ── Dev.to ────────────────────────────────────────────────────────────────────
export const devtoPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        title: z.string().min(1).max(200),
        markdown: z.string().min(1),
        tags: z.array(z.string().min(1).max(25)).max(4).default([]),
        published: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const token = await getToken(context.supabase, "devto");
    // Dev.to tags must be alphanumeric
    const cleanTags = data.tags
      .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ""))
      .filter(Boolean)
      .slice(0, 4);
    const res = await fetch("https://dev.to/api/articles", {
      method: "POST",
      headers: {
        "api-key": token,
        "Content-Type": "application/json",
        Accept: "application/vnd.forem.api-v1+json",
      },
      body: JSON.stringify({
        article: {
          title: data.title,
          body_markdown: data.markdown,
          published: data.published,
          tags: cleanTags,
        },
      }),
    });
    if (!res.ok) throw new Error(`Dev.to ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = (await res.json()) as { url?: string };
    if (!j.url) throw new Error("Dev.to: missing url in response");
    return { url: j.url };
  });

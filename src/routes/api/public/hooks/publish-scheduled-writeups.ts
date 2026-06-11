import { createFileRoute } from "@tanstack/react-router";

// This endpoint is called on a schedule (pg_cron → pg_net) to publish writeups
// whose `publish_at` is in the past. It is protected by a shared secret header
// `x-webhook-secret` which MUST match the `WEBHOOK_SECRET` environment variable
// configured in Cloudflare Workers (the server runtime).
export const Route = createFileRoute("/api/public/hooks/publish-scheduled-writeups")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-webhook-secret");
        const expected = process.env.WEBHOOK_SECRET;
        if (!provided || !expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const nowIso = new Date().toISOString();
        const { data, error } = await supabaseAdmin
          .from("writeups")
          .update({ is_published: true, publish_at: null })
          .lte("publish_at", nowIso)
          .eq("is_published", false)
          .select("id");
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ published: data?.length ?? 0 }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

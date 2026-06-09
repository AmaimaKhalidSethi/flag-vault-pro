# Plan: 5 Feature Additions

This is a large batch. I'll implement all five in sequence, grouping DB migrations together where possible.

## 1. Writeup templates per category
- Add `src/lib/writeup-templates.ts` with the 7 category scaffolds.
- In `src/routes/_app.writeups.new.tsx`, on mount show a Dialog: "Start from template?" with buttons "Use {category} template" / "Blank". Re-prompt when the user changes category if body is still untouched (track a `dirty` flag).
- Pre-fill `body` from the template on confirm.

## 2. Team challenge tracker
- **Migration**: create `challenge_status` enum (unsolved/attempting/solved), `challenge_attempts` table with the listed columns, GRANTs, RLS via `is_team_member(team_id)`, `updated_at` trigger.
- New component `src/components/TeamTracker.tsx`: 3-column board (no heavy DnD lib — use native HTML5 drag-and-drop to keep deps light). Inline form to add challenge (name, category select, points). "Claim" button sets `claimed_by = auth.uid()`. "Write up →" on solved opens `/writeups/new?challenge=&category=&points=&event_id=`.
- Update `src/routes/_app.writeups.new.tsx` to read those query params and pre-fill.
- On `_app.events.$id.tsx`: add Tabs ("Live feed" / "Team tracker"). Broadcast `tracker_update` on the existing event channel; subscribers refetch the tracker query.

## 3. Scheduled / embargo publish
- **Migration**: `ALTER TABLE writeups ADD COLUMN publish_at timestamptz`.
- In both `_app.writeups.new.tsx` and `_app.writeups.$slug.tsx`: replace single publish toggle with a 3-option segmented control. "Schedule" reveals a date+time picker (shadcn Calendar + native time input). When `event_id` is set, show "Use event end date" shortcut button reading from loaded event.
- **Cron**: prefer TanStack server route per guidelines (`/api/public/hooks/publish-scheduled-writeups`) using `supabaseAdmin`. Register via `pg_cron` calling that URL every 15 min. (User asked for "Edge Function" but project rules forbid Supabase Edge Functions for app-internal logic — I'll implement as TanStack server route + pg_cron, which is functionally identical and follows the stack rules.)
- In writeup list UI: show clock icon + scheduled date when `publish_at > now()`.

## 4. Threaded markdown comments
- **Migration**: `ALTER TABLE comments ADD COLUMN parent_id uuid REFERENCES comments(id) ON DELETE CASCADE`. Update RLS INSERT policy to allow replies on published writeups with valid `parent_id` (same writeup).
- Update comment renderer (in `_app.writeups.$slug.tsx`): render `body` through a sanitized markdown pipeline. Add `DOMPurify` (small dep) + reuse existing `renderMarkdown`. Post-process links to add `target="_blank" rel="noopener noreferrer"`.
- Add "Reply" button + inline editor; render replies indented under their parent (one level).
- Comment count badge on writeup cards in `_app.writeups.index.tsx` and profile lists — single count query per visible writeup (aggregate query).

## 5. Team scoreboard page
- New route `src/routes/_app.teams.$slug.stats.tsx` (auth-gated). Verify membership via `is_team_member` query; 404 otherwise.
- Sections: overall stats, points-by-event bar chart, top solvers list, category breakdown bar chart, 6-month cumulative line chart. All TanStack Query, `staleTime: 5 * 60_000`.
- Add "Stats" button on `_app.team.tsx` linking to it.

## Order of operations
1. Migrations 2+3+4 in a single SQL migration (table, column adds, policies).
2. Templates + tracker + scheduling UI + threaded comments + scoreboard route + cron route.
3. Insert pg_cron schedule via supabase insert tool after the route is live.

## Notes
- Adds one dep: `dompurify` (for #4). No DnD lib for tracker — HTML5 native.
- Following project rule: server route instead of Supabase Edge Function for the cron task.

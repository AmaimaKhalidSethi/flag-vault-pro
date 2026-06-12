# Flag Vault Pro

A collaborative CTF (Capture The Flag) writeup hub and live event platform for security teams. Document solves in rich markdown, run live events with realtime presence and a solve feed, track your team during the CTF, and syndicate finished writeups to GitHub Gists, Medium, and Dev.to — all from one workspace.

---

## Feature Set

### Writeups
- **Markdown editor** with live preview, slash commands, code blocks, copy-to-clipboard buttons, and a category-aware template library (web / pwn / crypto / forensics / rev / misc / osint).
- **Rich metadata** — category, difficulty, points, tags, tools used, attached flag (with blur/reveal in the public view), event linkage, team scope.
- **Draft / Publish / Schedule** workflow. Scheduled writeups are auto-published by a `pg_cron` job that hits `/api/public/hooks/publish-scheduled-writeups` (HMAC-protected) every 15 min.
- **Realtime co-presence** on the writeup page — see who else is reading.
- **Reactions** (👍 🔥 🧠 🎯) and **bookmarks** per user.
- **Threaded comments** with sanitized markdown.
- **Full-text search** powered by a Postgres `tsvector` (`search_tsv`) column + GIN index, exposed through a debounced search bar with author and category facets.
- **Public share pages** at `/u/$username/$slug` with SEO metadata, OG image, and JSON-LD.
- **AI assist** — bring-your-own Anthropic key (stored client-side) to summarize, retitle, or expand a draft.
- **Import** writeups from a GitHub Gist URL/ID or any raw `.md` URL (server-side fetch, sanitized).

### CTF Events
- **Browse, create, and join** events. Import directly from CTFtime by URL or event ID (server-side fetch of `https://ctftime.org/api/v1/events/{id}/` — proper User-Agent, no CORS).
- **Per-event live view** with Supabase Realtime: presence stack of online teammates, broadcast feed of live solves.
- **Team tracker** — log challenge attempts during the CTF (challenge name, category, points, status). When solved, click "Write it up" to spawn a draft pre-filled from the attempt and the category template; on publish, the attempt is linked to the writeup and a deep link appears on the tracker card.

### Teams
- Invite-code based membership (`/join/$invite_code`) with a SECURITY DEFINER `join_team_by_code` RPC.
- Owners can remove members (`remove_team_member` RPC, owner-only).
- RLS-enforced visibility: unpublished writeups are restricted to author + team members via `is_team_member(team_id)`.
- **Team stats page** at `/teams/$slug/stats` — solves by category/difficulty, leaderboard, recent activity.

### Profiles
- Public profile at `/u/$username` — bio, avatar, total writeups, total points, solves by category, recent writeups.
- Authenticated `/profile` view with the same stats and quick links.

### Integrations & Syndication
- One-click syndication of any published writeup to **GitHub Gists**, **Medium**, and **Dev.to**.
- Tokens stored per user in `user_integrations` (RLS scoped to the owner).

### Auth
- Email/password + Google OAuth via Lovable Cloud.
- Custom `_authenticated` layout gate; `useAuth()` hook is the single source of truth.
- All privileged server functions use `requireSupabaseAuth` middleware + role/ownership checks.

### Theming & UX
- Fluid light/dark theme engine driven by semantic OKLCH tokens in `src/styles.css`.
- Interactive animated background, custom 404, command palette (`⌘K`), keyboard-first nav.
- Sanitized markdown rendering via `marked` + `DOMPurify`.

---

## Tech Stack

- **Framework**: TanStack Start v1 (React 19, Vite 7, file-based routing in `src/routes/`)
- **Server logic**: `createServerFn` from `@tanstack/react-start` on Cloudflare Workers
- **Backend**: Lovable Cloud (managed Supabase) — Postgres, Auth, Realtime, RLS, `pg_cron`, `pg_net`
- **UI**: Tailwind CSS v4 + shadcn/ui (Radix primitives)
- **Data**: TanStack Query
- **Markdown**: `marked` + `DOMPurify`
- **Runtime**: Bun

---

## Local Setup

```bash
git clone <your-repo-url> flag-vault-pro
cd flag-vault-pro
cp .env.example .env   # fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
bun install
bun run dev            # http://localhost:5173
```

## Scripts
- `bun run dev` — dev server
- `bun run build` — production build
- `bun run preview` — preview production build
- `bun run lint` — ESLint

---

## Database Schema (high-level)

All tables live in `public` with RLS enabled. Generated types in `src/integrations/supabase/types.ts`.

| Table | Purpose |
| --- | --- |
| `profiles` | per-user profile, FK to `auth.users` |
| `teams` | team ownership + invite codes |
| `ctf_events` | CTF competitions |
| `writeups` | challenge solutions (markdown + metadata + `search_tsv`) |
| `tags`, `writeup_tags` | reusable tag dictionary + M:N join |
| `comments` | threaded comments |
| `reactions`, `bookmarks` | per-user engagement |
| `challenge_attempts` | live tracker rows, optionally linked to a published writeup |
| `user_integrations` | OAuth tokens for GitHub / Medium / Dev.to |
| `user_roles` | separate roles table (admin/moderator/user) — checked via `has_role()` SECURITY DEFINER |

Key helpers: `current_team_id()`, `is_team_member(_team_id)`, `has_role(_user_id, _role)`, `join_team_by_code(_code)`, `remove_team_member(_target)`.

---

## Project Status & Roadmap

Honest assessment: **Flag Vault Pro is feature-complete as a v1 product.** The core loop — track a challenge during a CTF → solve it → publish a writeup → share it publicly or syndicate it — works end-to-end with realtime, search, theming, auth, and proper RLS. You could ship this to a security club today.

That said, here is what I'd build next, ranked by impact-to-effort:

### Tier 1 — High leverage, low effort
1. **Scoreboard ingestion**. Pull live scoreboards from CTFtime / rCTF / CTFd during an event so the team-tracker can show "you are rank N / M, X points behind first". Most CTFd instances expose `/api/v1/scoreboard`.
2. **Writeup versioning / edit history**. A `writeup_versions` table + a "see changes" diff view. CTF writeups get corrected post-event; losing history hurts.
3. **Email/Discord/Slack notifications** for: someone solved a challenge you're attempting, someone commented on your writeup, your scheduled writeup published, your team got invited to an event.
4. **Image/file uploads** to Supabase Storage with paste-to-upload in the editor. Right now writeups rely on external image hosts.
5. **PDF / static-site export** of a finished event ("Team X — picoCTF 2026 writeups.pdf"). Use the existing markdown pipeline + Puppeteer-on-Worker alternative (e.g. `@react-pdf/renderer`).

### Tier 2 — Differentiators
6. **Challenge attachments & sandboxed previews** — store the original challenge binary/PCAP/zip alongside the writeup, with size limits and AV scanning hook.
7. **Auto-categorization & tag suggestions** using Lovable AI Gateway on draft save.
8. **Similarity search** — embed writeups with an embeddings model + `pgvector`, then "writeups like this one" and dedupe across teams.
9. **Public team pages** (`/team/$slug`) with leaderboard widgets you can embed in a club website.
10. **Recurring event templates** (weekly internal CTF, training ladders) with auto-rotation of challenge categories.

### Tier 3 — Platform plays
11. **Mentor mode** — pair a junior with a senior; the senior sees the junior's attempts in real time and can drop hints inline.
12. **Cross-team writeup marketplace** — opt-in public index, follow other teams, RSS per team.
13. **CTFd / rCTF webhook receiver** — auto-create a `challenge_attempts` row the moment your team flag-submits on the upstream platform.
14. **Mobile PWA polish** — install prompt, offline read of bookmarked writeups, push notifications for the solve feed.
15. **Admin/moderation surface** — abuse reports on public writeups, soft-delete + audit log, rate limits on comments.

### Things I'd consciously not build
- A built-in CTF *hosting* platform. CTFd already exists; stay focused on the writeup/team layer.
- A generic forum. Comments + reactions are enough.
- Custom OAuth provider. Google + email is the right scope for a team tool.

If you only do three things next, do **versioning**, **image uploads**, and **notifications** — that's what real users will ask for in week one of using this with their team.

---

## License

MIT

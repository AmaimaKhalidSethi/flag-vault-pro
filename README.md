# Flag Vault Pro

A collaborative CTF (Capture The Flag) writeup hub and live event platform for security teams. Flag Vault Pro lets players document challenge solutions in rich markdown, share them with their team, follow live CTF events with real‑time presence and solve broadcasts, and syndicate writeups to external platforms (GitHub Gists, Medium, Dev.to).

## Features

- **Writeups** — Markdown editor with categories, difficulty, points, tags, tools used, and flag storage. Per‑user public profile pages (`/u/$username`) and per‑writeup share pages.
- **CTF Events** — Browse and create events; per‑event live view with Supabase Realtime presence (who's online) and broadcast (live solve feed).
- **Teams** — Invite‑code based team membership with RLS‑enforced visibility of private writeups.
- **Integrations** — Connect GitHub, Medium, and Dev.to to syndicate any published writeup with one click.
- **Auth** — Email/password + Google OAuth via Lovable Cloud.
- **Theming** — Fluid light/dark theme engine driven by semantic OKLCH tokens in `src/styles.css`.

## Tech Stack

- **Framework**: TanStack Start v1 (React 19, Vite 7, file‑based routing in `src/routes/`)
- **Server logic**: `createServerFn` from `@tanstack/react-start` (runs on Cloudflare Workers)
- **Backend**: Lovable Cloud (managed Supabase) — Postgres, Auth, Realtime, RLS
- **UI**: Tailwind CSS v4 + shadcn/ui (Radix primitives)
- **Data**: TanStack Query
- **Runtime**: Bun

## Local Setup

```bash
# 1. Clone
git clone <your-repo-url> flag-vault-pro
cd flag-vault-pro

# 2. Copy env template and fill in your Supabase credentials
cp .env.example .env
#   VITE_SUPABASE_URL=https://<your-project>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<publishable/anon key>

# 3. Install
bun install

# 4. Dev server
bun run dev
```

The dev server starts at `http://localhost:5173`. Real credentials live only in your local `.env` (gitignored) and in the Lovable project environment dashboard — never commit them.

> The Supabase project ID is derived at runtime from the URL where needed:
> `new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]`

## Database Schema

All tables live in the `public` schema with Row Level Security enabled. Types are generated into `src/integrations/supabase/types.ts`.

### Core tables

| Table | Purpose | Key columns |
| --- | --- | --- |
| `profiles` | Per‑user profile, joined to `auth.users` by `id` | `id`, `username`, `avatar_url`, `team_id` |
| `teams` | Team ownership and invite codes | `id`, `name`, `slug`, `owner_id`, `invite_code` |
| `ctf_events` | CTF competitions | `id`, `name`, `url`, `start_date`, `end_date`, `created_by` |
| `writeups` | Challenge solutions in markdown | `id`, `slug`, `title`, `body_md`, `category`, `difficulty`, `points`, `flag`, `tags[]`, `tools_used[]`, `author_id`, `team_id`, `event_id`, `is_published`, `search_tsv` |
| `tags` | Reusable tag dictionary | `id`, `name`, `color` |
| `writeup_tags` | M:N join between writeups and tags | `writeup_id`, `tag_id` |
| `comments` | Threaded comments on writeups | `id`, `writeup_id`, `author_id`, `body` |
| `user_integrations` | OAuth tokens for GitHub / Medium / Dev.to | `user_id`, `provider`, `token`, `metadata` |

### Enums

- `category`: `web | pwn | crypto | forensics | rev | misc | osint`
- `difficulty`: `easy | medium | hard | insane`

### Helper functions

- `current_team_id()` — returns the calling user's `team_id`
- `is_team_member(_team_id)` — RLS predicate
- `join_team_by_code(_code)` — claim a team via invite code
- `remove_team_member(_target)` — owner‑only removal

### Realtime

The `ctf_events` view subscribes to a Supabase Realtime channel per event for presence (online users) and broadcast (live solve announcements). No DB writes are required for ephemeral live state.

## Project Structure

```
src/
  routes/                  # File-based routes (TanStack Router)
    __root.tsx             # Root shell
    _app.*.tsx             # Authenticated app layout + children
    auth.tsx               # Sign in / sign up
    u.$username.*.tsx      # Public user profile + writeup pages
  components/              # Reusable components (Presence, Syndicate, Markdown editor…)
  components/ui/           # shadcn/ui primitives
  integrations/supabase/   # Auto-generated client + types (do not edit)
  lib/                     # Server functions (*.functions.ts), helpers
  styles.css               # Theme tokens (OKLCH) + Tailwind v4 config
supabase/migrations/       # Versioned SQL migrations
```

## Scripts

- `bun run dev` — start the dev server
- `bun run build` — production build
- `bun run preview` — preview the production build

## License

MIT

## Plan: Realtime Events + Syndication Pipeline

### 1. Realtime CTF Event Engine

**Migration** (`supabase/migrations/...sql`):
- `ALTER PUBLICATION supabase_realtime ADD TABLE writeups, ctf_events, profiles;`
- `ALTER TABLE writeups REPLICA IDENTITY FULL;` (same for ctf_events)

**`src/routes/_app.events.$id.tsx`** — upgrade:
- Subscribe to `postgres_changes` on `writeups WHERE event_id=...` → update list state on INSERT/UPDATE/DELETE.
- Subscribe to Presence channel `event:{id}` tracking `{user_id, username, avatar_url}`.
- Header shows avatar stack with neon-teal pulsing dot for each presence user.
- On UPDATE event with `flag` newly set → trigger framer-motion success toast ("@user solved {title}").
- Add "Mark Solved" inline action on cards (sets flag if owner/team member).

**`src/routes/_app.events.index.tsx`** — subscribe to event INSERT/UPDATE so list updates live.

**New component** `src/components/PresenceStack.tsx`: avatar stack with pulse ring.

### 2. Syndication Pipeline

**Migration**: create `user_integrations` table:
```
id uuid pk, user_id uuid, provider text check in ('github','medium','devto'),
token text not null, metadata jsonb, created_at timestamptz
unique(user_id, provider)
```
RLS: owner-only select/insert/update/delete via auth.uid()=user_id.

**`src/lib/integrations.ts`**: helpers
- `getIntegration(provider)`, `saveIntegration(provider, token, metadata?)`, `removeIntegration(provider)`
- API wrappers (all client-side fetch with user-supplied tokens):
  - `githubListRepos(token)`, `githubCommitFile(token, repo, path, content, message)`
  - `mediumGetUser(token)`, `mediumCreatePost(token, userId, {title, contentFormat:'markdown', content, publishStatus, tags})`
  - `devtoCreateArticle(token, {title, body_markdown, published, tags})`

Note: Medium API has CORS restrictions — call via a TanStack server function proxy to avoid browser CORS issues. Same for GitHub (works from browser) and Dev.to (CORS open).

Actually simpler: do all three through `createServerFn` proxies that take the token + payload from the client. Tokens stored in DB (RLS-protected). This avoids CORS entirely.

**Server functions** `src/lib/syndication.functions.ts`:
- `githubRepos`, `githubCommit`, `mediumPublish`, `devtoPublish` — each protected by `requireSupabaseAuth`, fetches token from `user_integrations` for current user.

**`src/routes/_app.settings.tsx`** — add Integrations section:
- 3 cards (GitHub, Medium, Dev.to), each with status badge, token input, connect/disconnect buttons.

**`src/components/SyndicateMenu.tsx`** — DropdownMenu with three options:
- GitHub → opens Dialog (repo select, path input, commit) 
- Medium → opens Dialog (publishStatus draft/public)
- Dev.to → opens Dialog (published toggle)
- Loading spinner per action; success toast with link via `toast.success(<a href>)`.

Add to `_app.writeups.$slug.tsx` (owner/team only) and `MarkdownEditor` toolbar.

### Files
**New:**
- `supabase/migrations/{ts}_realtime_and_integrations.sql`
- `src/components/PresenceStack.tsx`
- `src/components/SyndicateMenu.tsx`
- `src/lib/integrations.ts`
- `src/lib/syndication.functions.ts`

**Edited:**
- `src/routes/_app.events.$id.tsx` (realtime + presence)
- `src/routes/_app.events.index.tsx` (realtime list)
- `src/routes/_app.settings.tsx` (integrations cards)
- `src/routes/_app.writeups.$slug.tsx` (syndicate button)
- `src/components/MarkdownEditor.tsx` (syndicate in toolbar — only if writeup exists; skip if too coupled)
- `src/integrations/supabase/types.ts` (regenerated after migration)

### Security notes
- Tokens stored in `user_integrations` with strict RLS (`auth.uid() = user_id`).
- Server fns validate ownership before use.
- Never log tokens.

Approve to implement.
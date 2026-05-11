
-- enums
create type public.difficulty as enum ('easy','medium','hard','insane');
create type public.category as enum ('web','pwn','crypto','forensics','rev','misc','osint');

-- teams
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  owner_id uuid not null,
  created_at timestamptz not null default now()
);

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ctf events
create table public.ctf_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  start_date timestamptz,
  end_date timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- writeups
create table public.writeups (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  body_md text not null default '',
  summary text,
  difficulty public.difficulty not null default 'easy',
  category public.category not null default 'misc',
  points integer not null default 0,
  flag text,
  tools_used text[] not null default '{}',
  is_published boolean not null default false,
  team_id uuid references public.teams(id) on delete set null,
  author_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.ctf_events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index writeups_author_idx on public.writeups(author_id);
create index writeups_team_idx on public.writeups(team_id);
create index writeups_search_idx on public.writeups using gin (to_tsvector('english', title || ' ' || coalesce(body_md,'')));

-- tags
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#00e5b8'
);
create table public.writeup_tags (
  writeup_id uuid not null references public.writeups(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (writeup_id, tag_id)
);

-- comments
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  writeup_id uuid not null references public.writeups(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index comments_writeup_idx on public.comments(writeup_id);

-- helper: get current user's team
create or replace function public.current_team_id()
returns uuid language sql stable security definer set search_path = public as $$
  select team_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_team_member(_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and team_id = _team_id)
$$;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger writeups_updated before update on public.writeups
  for each row execute function public.set_updated_at();

-- new user -> profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.ctf_events enable row level security;
alter table public.writeups enable row level security;
alter table public.tags enable row level security;
alter table public.writeup_tags enable row level security;
alter table public.comments enable row level security;

-- profiles
create policy "profiles read all" on public.profiles for select using (true);
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = id);

-- teams
create policy "teams read members or by code" on public.teams for select using (
  public.is_team_member(id) or owner_id = auth.uid()
);
create policy "teams insert auth" on public.teams for insert with check (auth.uid() = owner_id);
create policy "teams update owner" on public.teams for update using (auth.uid() = owner_id);

-- ctf_events: any auth user can read & insert
create policy "events read all" on public.ctf_events for select using (true);
create policy "events insert auth" on public.ctf_events for insert with check (auth.uid() = created_by);
create policy "events update creator" on public.ctf_events for update using (auth.uid() = created_by);

-- writeups
create policy "writeups read published or owner/team" on public.writeups for select using (
  is_published or author_id = auth.uid() or (team_id is not null and public.is_team_member(team_id))
);
create policy "writeups insert own" on public.writeups for insert with check (auth.uid() = author_id);
create policy "writeups update owner or team" on public.writeups for update using (
  author_id = auth.uid() or (team_id is not null and public.is_team_member(team_id))
);
create policy "writeups delete owner" on public.writeups for delete using (author_id = auth.uid());

-- tags
create policy "tags read all" on public.tags for select using (true);
create policy "tags insert auth" on public.tags for insert with check (auth.uid() is not null);

create policy "writeup_tags read all" on public.writeup_tags for select using (true);
create policy "writeup_tags write owner" on public.writeup_tags for all using (
  exists(select 1 from public.writeups w where w.id = writeup_id and (w.author_id = auth.uid() or (w.team_id is not null and public.is_team_member(w.team_id))))
) with check (
  exists(select 1 from public.writeups w where w.id = writeup_id and (w.author_id = auth.uid() or (w.team_id is not null and public.is_team_member(w.team_id))))
);

-- comments
create policy "comments read if writeup visible" on public.comments for select using (
  exists(select 1 from public.writeups w where w.id = writeup_id and (
    w.is_published or w.author_id = auth.uid() or (w.team_id is not null and public.is_team_member(w.team_id))
  ))
);
create policy "comments insert auth" on public.comments for insert with check (auth.uid() = author_id);
create policy "comments delete own" on public.comments for delete using (auth.uid() = author_id);

-- realtime
alter publication supabase_realtime add table public.comments;

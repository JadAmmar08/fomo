create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_id text not null unique,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists browsing_signals (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_id text not null,
  normalized_domain text not null,
  url_path text not null,
  page_title text not null,
  timestamp_bucket timestamptz not null,
  broad_category text not null,
  topic_label text not null,
  topic_tags text[] not null default array[]::text[],
  confidence numeric(4,3) not null,
  reasoning text not null,
  source text not null default 'extension',
  created_at timestamptz not null default now()
);

create index if not exists browsing_signals_user_time_idx
  on browsing_signals (anonymous_user_id, timestamp_bucket desc);

create index if not exists browsing_signals_category_time_idx
  on browsing_signals (broad_category, timestamp_bucket desc);

create table if not exists user_interests (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_id text not null,
  broad_category text not null,
  confidence numeric(4,3) not null,
  change_state text not null,
  reasoning text not null,
  hidden boolean not null default false,
  feedback_score numeric(6,3) not null default 0,
  updated_at timestamptz not null default now(),
  unique (anonymous_user_id, broad_category)
);

create table if not exists community_trends (
  id uuid primary key default gen_random_uuid(),
  broad_category text not null,
  topic_label text not null default '',
  topic_tags text[] not null default array[]::text[],
  trend_score numeric(8,2) not null,
  anonymous_signals integer not null,
  unique_users integer not null,
  time_window text not null,
  change_pct numeric(8,2) not null,
  explanation text not null,
  generated_at timestamptz not null default now()
);

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_id text not null,
  target_type text not null,
  target_id text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create table if not exists blocked_domains (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_id text not null,
  domain text not null,
  reason text not null default 'never-track',
  created_at timestamptz not null default now(),
  unique (anonymous_user_id, domain)
);

create table if not exists privacy_settings (
  anonymous_user_id text primary key,
  tracking_paused boolean not null default false,
  shareable_categories text[] not null default array['startups','technology','research','events','finance']::text[],
  local_data_retention text not null default 'keep',
  account_data_retention text not null default 'keep',
  updated_at timestamptz not null default now()
);

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  anonymous_user_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_waitlist_anonymous_user_id on waitlist(anonymous_user_id);

create table if not exists digest_clicks (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_id text not null,
  destination text not null,
  clicked_at timestamptz not null default now()
);

-- ROOMS (also used for Teams — same infrastructure, distinguished by `type`.
-- 'room' = community pulse (editorial, personalized, no cross-person connections).
-- 'team' = research pulse (AI-found connections between separate members' work).)
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_by text not null,
  max_members integer default 500,
  is_active boolean not null default true,
  type text not null default 'room' check (type in ('room', 'team')),
  pulse_last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  anonymous_user_id text not null,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  unique (room_id, anonymous_user_id)
);

create index if not exists idx_room_members_user on room_members(anonymous_user_id);
create index if not exists idx_room_members_room on room_members(room_id);

-- TEAM MIRROR (an evolving mental model of the team, distinct from the connections-engine
-- pulse. Persisted and updated incrementally, rather than recomputed fresh each time, so it
-- can track things a snapshot can't: reinforced theses, stale assumptions, belief shifts.)
create table if not exists team_connection_history (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  connections jsonb not null,
  captured_at timestamptz not null default now()
);
create index if not exists idx_team_conn_history_room on team_connection_history(room_id, captured_at desc);

create table if not exists team_mirror_state (
  room_id uuid primary key references rooms(id) on delete cascade,
  onboarding_summary text,
  theses jsonb not null default '[]'::jsonb,
  stale_assumptions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists team_mirror_shifts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  description text not null,
  detected_at timestamptz not null default now()
);
create index if not exists idx_team_mirror_shifts_room on team_mirror_shifts(room_id, detected_at desc);

-- ACCOUNTS (magic-link login — lets a user return to their existing anonymous_user_id
-- from any device, without ever attaching a password or real identity to their signals)
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  anonymous_user_id text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists magic_link_tokens (
  token text primary key,
  email text not null,
  anonymous_user_id text not null,
  redirect_to text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_magic_link_expires on magic_link_tokens(expires_at);

-- ROOM CONNECTIONS (cached AI-generated web of ideas per room — never attributes a
-- connection to a specific member, only links between topics/themes)
create table if not exists room_connections (
  room_id uuid primary key references rooms(id) on delete cascade,
  connections jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

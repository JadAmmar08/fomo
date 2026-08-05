create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

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
alter table room_members add column if not exists workstream_note text;
-- Kept so Discovery can notice a real shift in what someone's working on, not just
-- describe the current note as if it were always true.
alter table room_members add column if not exists previous_workstream_note text;
alter table room_members add column if not exists workstream_note_updated_at timestamptz;

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
alter table team_mirror_state add column if not exists active_disagreements jsonb not null default '[]'::jsonb;
alter table team_mirror_state add column if not exists decisions jsonb not null default '[]'::jsonb;
alter table team_mirror_state add column if not exists open_questions jsonb not null default '[]'::jsonb;

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
-- Unused for now (login is still email-only, no password) — added ahead of time so real
-- password auth doesn't need another migration against live account data later.
alter table accounts add column if not exists password_hash text;

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

-- INDIVIDUAL GUIDANCE (single-player value on day one, before a team has enough
-- shared history for real cross-person connections — a pattern in one person's own
-- research plus recommended next directions. Keyed by (anonymous_user_id, room_id)
-- since guidance uses that team's pulse/mirror data once it exists, so the same
-- person can get different guidance in different teams. room_id is '' for the
-- team-less/solo case.)
create table if not exists individual_guidance (
  anonymous_user_id text not null,
  room_id text not null default '',
  pattern text not null,
  recommendations jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  primary key (anonymous_user_id, room_id)
);

-- COST LOG (one row per Anthropic API call site, used to compute unit economics
-- on the admin dashboard: spend by call type, spend per team, cache hit rate)
create table if not exists cost_log (
  id uuid primary key default gen_random_uuid(),
  call_type text not null check (call_type in ('classification', 'pulse_synthesis', 'mirror_synthesis', 'guidance_synthesis')),
  room_id uuid references rooms(id) on delete set null,
  anonymous_user_id text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost numeric(10,6) not null default 0,
  cache_hit boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_cost_log_type_time on cost_log(call_type, created_at desc);
create index if not exists idx_cost_log_room on cost_log(room_id);

-- FEATURE VIEWS (page-load level view events for Team Pulse / Team Mirror / Guidance,
-- used for feature engagement metrics and the activation funnel's last two steps)
create table if not exists feature_views (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('pulse_view', 'mirror_view', 'guidance_view')),
  anonymous_user_id text not null,
  room_id uuid references rooms(id) on delete cascade,
  viewed_at timestamptz not null default now()
);
create index if not exists idx_feature_views_type_time on feature_views(event_type, viewed_at desc);
create index if not exists idx_feature_views_user on feature_views(anonymous_user_id);

-- GOOGLE CONNECTIONS (per-user, per-room OAuth grant to read Drive file/revision
-- history for the workstream-handoff feature. room_id is '' for a solo connection
-- not yet tied to a team. One row per (anonymous_user_id, room_id) pair.)
create table if not exists slack_connections (
  room_id text primary key,
  slack_team_id text not null,
  slack_team_name text,
  access_token text not null,
  bot_user_id text,
  scope text not null,
  installed_by text not null,
  linked_channel_id text,
  linked_channel_name text,
  linked_channel_is_external boolean not null default false,
  auto_join_all boolean not null default false,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table slack_connections add column if not exists auto_join_all boolean not null default false;
alter table slack_connections add column if not exists linked_channel_is_external boolean not null default false;

create table if not exists google_connections (
  anonymous_user_id text not null,
  room_id text not null default '',
  google_email text,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz not null,
  scope text not null,
  linked_folder_id text,
  linked_folder_name text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (anonymous_user_id, room_id)
);
alter table google_connections add column if not exists linked_folder_id text;
alter table google_connections add column if not exists linked_folder_name text;
alter table google_connections add column if not exists auto_all_files boolean not null default false;
alter table google_connections add column if not exists include_shared_files boolean not null default false;
alter table google_connections add column if not exists linked_file_ids jsonb not null default '[]'::jsonb;

create table if not exists microsoft_connections (
  anonymous_user_id text not null,
  room_id text not null default '',
  microsoft_email text,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz not null,
  scope text not null,
  linked_folder_id text,
  linked_folder_name text,
  auto_all_files boolean not null default false,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (anonymous_user_id, room_id)
);
alter table microsoft_connections add column if not exists auto_all_files boolean not null default false;
alter table microsoft_connections add column if not exists include_shared_files boolean not null default false;
alter table microsoft_connections add column if not exists linked_file_ids jsonb not null default '[]'::jsonb;

-- WORKSTREAM SNAPSHOTS (one row per summary generation, across all connected
-- sources — lets a new summary say "what changed since last time" instead of
-- re-describing the same static state from scratch on every page load.)
create table if not exists workstream_snapshots (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  source text not null check (source in ('google', 'slack', 'microsoft')),
  raw_data jsonb not null,
  summary text,
  captured_at timestamptz not null default now()
);
create index if not exists idx_workstream_snapshots_room_source on workstream_snapshots(room_id, source, captured_at desc);
alter table workstream_snapshots drop constraint if exists workstream_snapshots_source_check;
alter table workstream_snapshots add constraint workstream_snapshots_source_check check (source in ('google', 'slack', 'microsoft', 'combined'));

-- PUSH SUBSCRIPTIONS (Web Push endpoints, one per browser/device a user has
-- enabled notifications on — not email, real OS-level push via the browser.)
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_id text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_user on push_subscriptions(anonymous_user_id);

-- HANDOFF REQUESTS (Discovery's team_signal can point at a specific teammate's connected
-- item. Clicking "Request it" auto-shares it immediately, no owner approval gate, this
-- table exists for tracking/analytics and so the owner can get an FYI notification.)
create table if not exists handoff_requests (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  requester_id text not null,
  owner_id text not null,
  source text not null,
  item_name text not null,
  item_link text,
  item_content text,
  topic text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_handoff_requests_owner on handoff_requests(owner_id);
create index if not exists idx_handoff_requests_requester on handoff_requests(requester_id);

-- GUIDANCE FEEDBACK (lightweight correction signal collected in the same interaction as
-- a handoff request, not a separate feature. "useful" / "not_relevant" per recommendation.)
create table if not exists guidance_feedback (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_id text not null,
  room_id text not null,
  recommendation_text text not null,
  feedback text not null check (feedback in ('useful', 'not_relevant')),
  created_at timestamptz not null default now()
);

-- PINNED CARDS (any Pulse connection, Discovery recommendation, or Mirror card can be
-- pinned so it stays visible across recomputes even if a future pass doesn't reproduce
-- it. card_data holds the full card content so a pinned card can still render after it
-- drops out of the live computed set.)
create table if not exists pinned_cards (
  anonymous_user_id text not null,
  room_id text not null,
  card_type text not null check (card_type in ('pulse', 'discovery', 'mirror')),
  card_key text not null,
  card_data jsonb not null,
  pinned_at timestamptz not null default now(),
  primary key (anonymous_user_id, room_id, card_type, card_key)
);

-- FILE WATCH CHANNELS (one row per file someone's asked FOMO to watch live —
-- Google Drive `files.watch` / Microsoft Graph `/subscriptions`, whichever provider
-- owns the file. Lets a webhook ping route straight back to "whose file, which room,
-- which file" without re-deriving it, and last_content_hash dedupes the notifications
-- both providers fire multiple times per real edit.)
create table if not exists file_watch_channels (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google', 'microsoft')),
  anonymous_user_id text not null,
  room_id text not null,
  file_id text not null,
  file_name text not null,
  channel_id text not null,
  resource_id text,
  last_content_hash text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, file_id, anonymous_user_id, room_id)
);
create index if not exists idx_file_watch_channels_expiry on file_watch_channels(expires_at);
create index if not exists idx_file_watch_channels_lookup on file_watch_channels(provider, channel_id);

-- FOLDER WATCH CHANNELS (one row per linked folder someone's asked FOMO to watch for
-- newly created files — Drive's account-wide `changes.watch` feed filtered to this
-- folder, or Graph's `/children` delta subscription. `page_token`/`delta_link` is the
-- provider's cursor: on each ping we pull only what changed since last time, not a
-- full folder re-scan.)
create table if not exists folder_watch_channels (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google', 'microsoft')),
  anonymous_user_id text not null,
  room_id text not null,
  folder_id text not null,
  folder_name text not null,
  channel_id text not null,
  resource_id text,
  page_token text,
  known_file_ids jsonb not null default '[]',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, folder_id, anonymous_user_id, room_id)
);
create index if not exists idx_folder_watch_channels_expiry on folder_watch_channels(expires_at);
create index if not exists idx_folder_watch_channels_lookup on folder_watch_channels(provider, channel_id);

-- MEMBER WORKSTREAM DIGESTS (one cached, synthesized "what this person's actual
-- work currently shows" per person per room — replaces raw file/message excerpts
-- as the input to Pulse and Discovery's cross-referencing, since raw excerpts are
-- too thin and too token-expensive to reason over as connected work grows. This is
-- the deeper evidence layer: real conclusions, not just topic labels or snippets.)
create table if not exists member_workstream_digests (
  anonymous_user_id text not null,
  room_id text not null,
  digest text not null,
  generated_at timestamptz not null default now(),
  primary key (anonymous_user_id, room_id)
);

-- PROJECT FACTS (structured, atomic facts extracted from spreadsheet cells —
-- {subject, value, location} rather than a flattened text blob, so contradiction
-- detection can compare exact values with exact citations instead of asking one AI
-- call to spot a conflict in truncated prose. Accumulates as a persistent project
-- memory: a changed value supersedes the old row (`superseded_by`) rather than
-- overwriting it, so the fact history itself stays usable later. v1 covers Excel/
-- Google Sheets only; see lib/file-watch.ts `checkFactsForConflict`.)
create table if not exists project_facts (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_id text not null,
  room_id text not null,
  provider text not null check (provider in ('google', 'microsoft')),
  file_id text not null,
  file_name text not null,
  subject text not null,
  value text not null,
  location text not null,
  snippet text,
  superseded_by uuid references project_facts(id),
  extracted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_project_facts_room on project_facts(room_id) where superseded_by is null;
create index if not exists idx_project_facts_file on project_facts(provider, file_id);
create index if not exists idx_project_facts_subject_trgm on project_facts using gin (subject gin_trgm_ops);

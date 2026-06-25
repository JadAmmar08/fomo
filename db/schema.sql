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

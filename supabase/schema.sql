create table if not exists public.settings (
  id smallint primary key default 1 check (id = 1),
  shop_name text,
  alert_email text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  alert_email text not null,
  display_name text,
  plan text not null default 'starter' check (plan in ('starter', 'growth')),
  plan_status text not null default 'beta' check (plan_status in ('beta', 'trial', 'active', 'past_due', 'canceled')),
  url_limit integer not null default 10,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trackers (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  label text,
  url text not null,
  normalized_url text not null,
  domain text not null,
  currency text,
  current_price_minor bigint,
  previous_price_minor bigint,
  status text not null default 'active' check (status in ('active', 'paused', 'needs_review')),
  selector_hint text,
  last_checked_at timestamptz,
  last_change_at timestamptz,
  last_error text,
  consecutive_failures integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.price_checks (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  tracker_id bigint not null references public.trackers(id) on delete cascade,
  checked_at timestamptz not null,
  outcome text not null,
  http_status integer,
  price_minor bigint,
  currency text,
  extracted_from text,
  raw_price_text text,
  changed boolean not null default false,
  page_title text,
  error_message text
);

create table if not exists public.alerts (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  tracker_id bigint not null references public.trackers(id) on delete cascade,
  price_check_id bigint not null references public.price_checks(id) on delete cascade,
  channel text not null default 'email',
  recipient text not null,
  status text not null default 'logged',
  provider_id text,
  sent_at timestamptz,
  message text not null,
  error_message text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.trackers add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.price_checks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.alerts add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.trackers drop constraint if exists trackers_normalized_url_key;

create unique index if not exists trackers_user_normalized_url_key
  on public.trackers (user_id, normalized_url)
  where user_id is not null;

create index if not exists trackers_status_updated_at_idx on public.trackers (status, updated_at desc);
create index if not exists trackers_user_status_updated_at_idx on public.trackers (user_id, status, updated_at desc);
create index if not exists price_checks_tracker_checked_at_idx on public.price_checks (tracker_id, checked_at desc);
create index if not exists price_checks_user_tracker_checked_at_idx on public.price_checks (user_id, tracker_id, checked_at desc);
create index if not exists alerts_created_at_idx on public.alerts (created_at desc);
create index if not exists alerts_user_created_at_idx on public.alerts (user_id, created_at desc);

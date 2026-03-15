create table if not exists public.settings (
  id smallint primary key default 1 check (id = 1),
  shop_name text,
  alert_email text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trackers (
  id bigint generated always as identity primary key,
  label text,
  url text not null,
  normalized_url text not null unique,
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

create index if not exists trackers_status_updated_at_idx on public.trackers (status, updated_at desc);
create index if not exists price_checks_tracker_checked_at_idx on public.price_checks (tracker_id, checked_at desc);
create index if not exists alerts_created_at_idx on public.alerts (created_at desc);

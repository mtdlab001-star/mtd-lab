create extension if not exists pgcrypto;

create table if not exists public.taxpayers (
  id text primary key,
  display_name text not null,
  nino text,
  utr text,
  mtditid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hmrc_connections (
  id uuid primary key default gen_random_uuid(),
  taxpayer_id text not null unique references public.taxpayers(id) on delete cascade,
  environment text not null default 'sandbox',
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hmrc_businesses (
  id uuid primary key default gen_random_uuid(),
  taxpayer_id text not null references public.taxpayers(id) on delete cascade,
  business_id text,
  business_type text,
  business_name text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.hmrc_obligations (
  id uuid primary key default gen_random_uuid(),
  taxpayer_id text not null references public.taxpayers(id) on delete cascade,
  business_id text,
  period_start date,
  period_end date,
  due_date date,
  status text,
  received_date date,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.hmrc_sync_runs (
  id uuid primary key default gen_random_uuid(),
  taxpayer_id text not null references public.taxpayers(id) on delete cascade,
  status text not null,
  businesses_count integer,
  obligations_count integer,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

insert into public.taxpayers(id,display_name) values ('demo','HMRC Sandbox Taxpayer') on conflict (id) do nothing;

alter table public.taxpayers enable row level security;
alter table public.hmrc_connections enable row level security;
alter table public.hmrc_businesses enable row level security;
alter table public.hmrc_obligations enable row level security;
alter table public.hmrc_sync_runs enable row level security;

revoke all on public.taxpayers from anon, authenticated;
revoke all on public.hmrc_connections from anon, authenticated;
revoke all on public.hmrc_businesses from anon, authenticated;
revoke all on public.hmrc_obligations from anon, authenticated;
revoke all on public.hmrc_sync_runs from anon, authenticated;

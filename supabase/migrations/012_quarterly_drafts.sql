create table if not exists public.hmrc_quarterly_drafts (
  id uuid primary key default gen_random_uuid(),
  taxpayer_id text not null references public.taxpayers(id) on delete cascade,
  business_id text not null,
  income_source_type text not null check (income_source_type in ('self-employment','uk-property','foreign-property')),
  period_start date not null,
  period_end date not null,
  figures jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (taxpayer_id, business_id, income_source_type, period_end)
);

create index if not exists idx_hmrc_quarterly_drafts_taxpayer_period
  on public.hmrc_quarterly_drafts(taxpayer_id, period_end desc);

alter table public.hmrc_quarterly_drafts enable row level security;
revoke all on public.hmrc_quarterly_drafts from anon, authenticated;

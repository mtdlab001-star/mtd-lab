create table if not exists public.hmrc_quarterly_submissions (
  id uuid primary key default gen_random_uuid(),
  taxpayer_id text not null references public.taxpayers(id) on delete cascade,
  business_id text not null,
  period_start date,
  period_end date,
  tax_year text,
  status text not null default 'draft',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  hmrc_correlation_id text,
  hmrc_http_status integer,
  error_message text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_hmrc_quarterly_submissions_taxpayer
  on public.hmrc_quarterly_submissions(taxpayer_id, created_at desc);

create index if not exists idx_hmrc_quarterly_submissions_business
  on public.hmrc_quarterly_submissions(business_id, period_end desc);

alter table public.hmrc_quarterly_submissions enable row level security;
revoke all on public.hmrc_quarterly_submissions from anon, authenticated;

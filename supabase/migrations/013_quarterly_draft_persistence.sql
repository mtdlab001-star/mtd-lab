create table if not exists public.hmrc_quarterly_drafts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  taxpayer_id text not null references public.taxpayers(id) on delete cascade,
  business_id text not null,
  income_source_type text not null check (income_source_type in ('self-employment','uk-property','foreign-property')),
  period_start date not null,
  period_end date not null,
  figures jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hmrc_quarterly_drafts add column if not exists firm_id uuid;
update public.hmrc_quarterly_drafts d set firm_id=t.firm_id from public.taxpayers t where d.taxpayer_id=t.id and d.firm_id is null;
alter table public.hmrc_quarterly_drafts alter column firm_id set not null;

alter table public.hmrc_quarterly_drafts drop constraint if exists hmrc_quarterly_drafts_taxpayer_id_business_id_income_source_key;
alter table public.hmrc_quarterly_drafts drop constraint if exists hmrc_quarterly_drafts_firm_period_key;
alter table public.hmrc_quarterly_drafts add constraint hmrc_quarterly_drafts_firm_period_key unique (firm_id,taxpayer_id,business_id,income_source_type,period_end);

create index if not exists hmrc_quarterly_drafts_lookup_idx on public.hmrc_quarterly_drafts(firm_id,taxpayer_id,business_id,income_source_type,period_end);

alter table public.hmrc_quarterly_drafts enable row level security;
drop policy if exists server_managed_no_browser_select on public.hmrc_quarterly_drafts;
drop policy if exists server_managed_no_browser_insert on public.hmrc_quarterly_drafts;
drop policy if exists server_managed_no_browser_update on public.hmrc_quarterly_drafts;
drop policy if exists server_managed_no_browser_delete on public.hmrc_quarterly_drafts;
create policy server_managed_no_browser_select on public.hmrc_quarterly_drafts for select to anon, authenticated using (false);
create policy server_managed_no_browser_insert on public.hmrc_quarterly_drafts for insert to anon, authenticated with check (false);
create policy server_managed_no_browser_update on public.hmrc_quarterly_drafts for update to anon, authenticated using (false) with check (false);
create policy server_managed_no_browser_delete on public.hmrc_quarterly_drafts for delete to anon, authenticated using (false);
revoke all on public.hmrc_quarterly_drafts from anon, authenticated;

create table if not exists public.agent_hmrc_connections (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null unique references public.mtd_agents(id) on delete cascade,
  environment text not null default 'sandbox',
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_hmrc_connections_agent
  on public.agent_hmrc_connections(agent_id);

alter table public.agent_hmrc_connections enable row level security;

drop policy if exists server_managed_no_browser_select on public.agent_hmrc_connections;
drop policy if exists server_managed_no_browser_insert on public.agent_hmrc_connections;
drop policy if exists server_managed_no_browser_update on public.agent_hmrc_connections;
drop policy if exists server_managed_no_browser_delete on public.agent_hmrc_connections;

create policy server_managed_no_browser_select
  on public.agent_hmrc_connections for select to anon, authenticated using (false);
create policy server_managed_no_browser_insert
  on public.agent_hmrc_connections for insert to anon, authenticated with check (false);
create policy server_managed_no_browser_update
  on public.agent_hmrc_connections for update to anon, authenticated using (false) with check (false);
create policy server_managed_no_browser_delete
  on public.agent_hmrc_connections for delete to anon, authenticated using (false);

revoke all on public.agent_hmrc_connections from anon, authenticated;

comment on table public.agent_hmrc_connections is 'HMRC OAuth tokens for agent ASA software connections. Server managed only.';

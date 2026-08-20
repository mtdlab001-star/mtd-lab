create table if not exists public.mtd_agents (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  organisation_name text,
  hmrc_arn text,
  email text,
  phone text,
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mtd_agent_authorisations (
  id uuid primary key default gen_random_uuid(),
  taxpayer_id text not null references public.taxpayers(id) on delete cascade,
  agent_id uuid not null references public.mtd_agents(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','authorised','revoked','expired')),
  can_view_records boolean not null default true,
  can_manage_records boolean not null default false,
  can_view_obligations boolean not null default true,
  can_submit_quarterly boolean not null default false,
  can_manage_year_end boolean not null default false,
  can_submit_final_declaration boolean not null default false,
  authorised_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  authorisation_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (taxpayer_id, agent_id)
);

create index if not exists idx_mtd_agent_authorisations_taxpayer on public.mtd_agent_authorisations(taxpayer_id);
create index if not exists idx_mtd_agent_authorisations_agent on public.mtd_agent_authorisations(agent_id);
create index if not exists idx_mtd_agent_authorisations_status on public.mtd_agent_authorisations(status);

alter table public.mtd_agents enable row level security;
alter table public.mtd_agent_authorisations enable row level security;

comment on table public.mtd_agents is 'MTD Lab tax agents or accountancy organisations that may be authorised to act for specific taxpayers.';
comment on table public.mtd_agent_authorisations is 'Scoped taxpayer to agent permissions. Application routes must verify an active authorised relationship before delegated actions.';

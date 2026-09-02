do $$
declare legacy_id uuid;
begin
  select id into legacy_id from public.accounting_firms where firm_name='MTD Lab Legacy Workspace' limit 1;
  if legacy_id is null then
    insert into public.accounting_firms(firm_name,trading_name,status,approved_at,approved_by)
    values('MTD Lab Legacy Workspace','MTD Lab','approved',now(),'system-migration')
    returning id into legacy_id;
  end if;

  alter table public.taxpayers add column if not exists firm_id uuid references public.accounting_firms(id);
  update public.taxpayers set firm_id=legacy_id where firm_id is null;
  alter table public.taxpayers alter column firm_id set not null;
  create index if not exists taxpayers_firm_id_idx on public.taxpayers(firm_id);

  alter table public.hmrc_businesses add column if not exists firm_id uuid references public.accounting_firms(id);
  update public.hmrc_businesses b set firm_id=t.firm_id from public.taxpayers t where b.taxpayer_id=t.id and b.firm_id is null;
  alter table public.hmrc_businesses alter column firm_id set not null;
  create index if not exists hmrc_businesses_firm_id_idx on public.hmrc_businesses(firm_id);

  alter table public.hmrc_connections add column if not exists firm_id uuid references public.accounting_firms(id);
  update public.hmrc_connections c set firm_id=t.firm_id from public.taxpayers t where c.taxpayer_id=t.id and c.firm_id is null;
  alter table public.hmrc_connections alter column firm_id set not null;
  create index if not exists hmrc_connections_firm_id_idx on public.hmrc_connections(firm_id);

  alter table public.hmrc_obligations add column if not exists firm_id uuid references public.accounting_firms(id);
  update public.hmrc_obligations o set firm_id=t.firm_id from public.taxpayers t where o.taxpayer_id=t.id and o.firm_id is null;
  alter table public.hmrc_obligations alter column firm_id set not null;
  create index if not exists hmrc_obligations_firm_id_idx on public.hmrc_obligations(firm_id);

  alter table public.hmrc_quarterly_submissions add column if not exists firm_id uuid references public.accounting_firms(id);
  update public.hmrc_quarterly_submissions q set firm_id=t.firm_id from public.taxpayers t where q.taxpayer_id=t.id and q.firm_id is null;
  alter table public.hmrc_quarterly_submissions alter column firm_id set not null;
  create index if not exists hmrc_quarterly_submissions_firm_id_idx on public.hmrc_quarterly_submissions(firm_id);

  alter table public.hmrc_sync_runs add column if not exists firm_id uuid references public.accounting_firms(id);
  update public.hmrc_sync_runs s set firm_id=t.firm_id from public.taxpayers t where s.taxpayer_id=t.id and s.firm_id is null;
  alter table public.hmrc_sync_runs alter column firm_id set not null;
  create index if not exists hmrc_sync_runs_firm_id_idx on public.hmrc_sync_runs(firm_id);

  alter table public.mtd_digital_records add column if not exists firm_id uuid references public.accounting_firms(id);
  update public.mtd_digital_records r set firm_id=t.firm_id from public.taxpayers t where r.taxpayer_id=t.id and r.firm_id is null;
  alter table public.mtd_digital_records alter column firm_id set not null;
  create index if not exists mtd_digital_records_firm_id_idx on public.mtd_digital_records(firm_id);

  alter table public.mtd_submission_audit add column if not exists firm_id uuid references public.accounting_firms(id);
  update public.mtd_submission_audit a set firm_id=t.firm_id from public.taxpayers t where a.taxpayer_id=t.id and a.firm_id is null;
  alter table public.mtd_submission_audit alter column firm_id set not null;
  create index if not exists mtd_submission_audit_firm_id_idx on public.mtd_submission_audit(firm_id);

  alter table public.mtd_year_end_reviews add column if not exists firm_id uuid references public.accounting_firms(id);
  update public.mtd_year_end_reviews y set firm_id=t.firm_id from public.taxpayers t where y.taxpayer_id=t.id and y.firm_id is null;
  alter table public.mtd_year_end_reviews alter column firm_id set not null;
  create index if not exists mtd_year_end_reviews_firm_id_idx on public.mtd_year_end_reviews(firm_id);

  alter table public.mtd_agents add column if not exists firm_id uuid references public.accounting_firms(id);
  update public.mtd_agents set firm_id=legacy_id where firm_id is null;
  alter table public.mtd_agents alter column firm_id set not null;
  create index if not exists mtd_agents_firm_id_idx on public.mtd_agents(firm_id);

  alter table public.agent_hmrc_connections add column if not exists firm_id uuid references public.accounting_firms(id);
  update public.agent_hmrc_connections c set firm_id=a.firm_id from public.mtd_agents a where c.agent_id=a.id and c.firm_id is null;
  alter table public.agent_hmrc_connections alter column firm_id set not null;
  create index if not exists agent_hmrc_connections_firm_id_idx on public.agent_hmrc_connections(firm_id);

  alter table public.mtd_agent_authorisations add column if not exists firm_id uuid references public.accounting_firms(id);
  update public.mtd_agent_authorisations x set firm_id=t.firm_id from public.taxpayers t where x.taxpayer_id=t.id and x.firm_id is null;
  alter table public.mtd_agent_authorisations alter column firm_id set not null;
  create index if not exists mtd_agent_authorisations_firm_id_idx on public.mtd_agent_authorisations(firm_id);
end $$;

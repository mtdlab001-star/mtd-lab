create or replace function public.mtd_set_firm_from_taxpayer() returns trigger language plpgsql security definer set search_path=public as $$
begin
  select firm_id into new.firm_id from public.taxpayers where id=new.taxpayer_id;
  if new.firm_id is null then raise exception 'Taxpayer workspace not found'; end if;
  return new;
end $$;

do $$
declare tbl text;
begin
  foreach tbl in array array['hmrc_businesses','hmrc_connections','hmrc_obligations','hmrc_quarterly_submissions','hmrc_sync_runs','mtd_digital_records','mtd_submission_audit','mtd_year_end_reviews','mtd_agent_authorisations'] loop
    execute format('drop trigger if exists mtd_assign_firm on public.%I',tbl);
    execute format('create trigger mtd_assign_firm before insert or update of taxpayer_id,firm_id on public.%I for each row execute function public.mtd_set_firm_from_taxpayer()',tbl);
  end loop;
end $$;

create or replace function public.mtd_set_firm_from_agent() returns trigger language plpgsql security definer set search_path=public as $$
begin
  select firm_id into new.firm_id from public.mtd_agents where id=new.agent_id;
  if new.firm_id is null then raise exception 'Agent workspace not found'; end if;
  return new;
end $$;

drop trigger if exists mtd_assign_firm on public.agent_hmrc_connections;
create trigger mtd_assign_firm before insert or update of agent_id,firm_id on public.agent_hmrc_connections for each row execute function public.mtd_set_firm_from_agent();

create or replace function public.mtd_enforce_authorisation_firm() returns trigger language plpgsql security definer set search_path=public as $$
declare taxpayer_firm uuid; agent_firm uuid;
begin
  select firm_id into taxpayer_firm from public.taxpayers where id=new.taxpayer_id;
  select firm_id into agent_firm from public.mtd_agents where id=new.agent_id;
  if taxpayer_firm is null or agent_firm is null or taxpayer_firm<>agent_firm then raise exception 'Agent and taxpayer must belong to the same accounting workspace'; end if;
  new.firm_id:=taxpayer_firm;
  return new;
end $$;

drop trigger if exists mtd_assign_firm on public.mtd_agent_authorisations;
create trigger mtd_assign_firm before insert or update of taxpayer_id,agent_id,firm_id on public.mtd_agent_authorisations for each row execute function public.mtd_enforce_authorisation_firm();

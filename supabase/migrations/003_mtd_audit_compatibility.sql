alter table public.mtd_submission_audit
  add column if not exists correlation_id text,
  add column if not exists hmrc_status integer,
  add column if not exists request_payload jsonb,
  add column if not exists response_payload jsonb,
  add column if not exists submitted_at timestamptz;

update public.mtd_submission_audit
set correlation_id=coalesce(correlation_id,hmrc_correlation_id),
    request_payload=coalesce(request_payload,request_summary),
    response_payload=coalesce(response_payload,response_summary),
    submitted_at=coalesce(submitted_at,created_at)
where correlation_id is null or request_payload is null or response_payload is null or submitted_at is null;

create or replace function public.sync_mtd_submission_audit_compat()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.hmrc_correlation_id=coalesce(new.hmrc_correlation_id,new.correlation_id);
  new.correlation_id=coalesce(new.correlation_id,new.hmrc_correlation_id);
  new.request_summary=coalesce(new.request_summary,new.request_payload);
  new.request_payload=coalesce(new.request_payload,new.request_summary);
  new.response_summary=coalesce(new.response_summary,new.response_payload);
  new.response_payload=coalesce(new.response_payload,new.response_summary);
  new.created_at=coalesce(new.created_at,new.submitted_at,now());
  new.submitted_at=coalesce(new.submitted_at,new.created_at,now());
  return new;
end
$$;

drop trigger if exists trg_sync_mtd_submission_audit_compat on public.mtd_submission_audit;
create trigger trg_sync_mtd_submission_audit_compat
before insert or update on public.mtd_submission_audit
for each row execute function public.sync_mtd_submission_audit_compat();

alter table public.hmrc_quarterly_submissions add column if not exists correlation_id text;
update public.hmrc_quarterly_submissions set correlation_id=coalesce(correlation_id,hmrc_correlation_id) where correlation_id is null;

create or replace function public.sync_hmrc_quarterly_correlation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.hmrc_correlation_id=coalesce(new.hmrc_correlation_id,new.correlation_id);
  new.correlation_id=coalesce(new.correlation_id,new.hmrc_correlation_id);
  return new;
end
$$;

drop trigger if exists trg_sync_hmrc_quarterly_correlation on public.hmrc_quarterly_submissions;
create trigger trg_sync_hmrc_quarterly_correlation
before insert or update on public.hmrc_quarterly_submissions
for each row execute function public.sync_hmrc_quarterly_correlation();

alter table public.taxpayers
  add column if not exists archived_at timestamptz;

create index if not exists idx_taxpayers_active
  on public.taxpayers (created_at)
  where archived_at is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mtd_digital_records_taxpayer_id_fkey'
      and conrelid = 'public.mtd_digital_records'::regclass
  ) then
    alter table public.mtd_digital_records
      add constraint mtd_digital_records_taxpayer_id_fkey
      foreign key (taxpayer_id) references public.taxpayers(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mtd_submission_audit_taxpayer_id_fkey'
      and conrelid = 'public.mtd_submission_audit'::regclass
  ) then
    alter table public.mtd_submission_audit
      add constraint mtd_submission_audit_taxpayer_id_fkey
      foreign key (taxpayer_id) references public.taxpayers(id) on delete cascade;
  end if;
end $$;

comment on column public.taxpayers.archived_at is
  'Soft archive timestamp. Archived taxpayers are hidden from active lists while all HMRC and filing history remains intact.';

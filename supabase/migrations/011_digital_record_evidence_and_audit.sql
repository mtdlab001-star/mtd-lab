alter table public.mtd_digital_records
  add column if not exists document_name text,
  add column if not exists document_mime_type text,
  add column if not exists document_size bigint,
  add column if not exists document_uploaded_at timestamptz;

update public.mtd_digital_records
set source_reference = coalesce(source_reference, document_url), document_url = null
where document_url is not null and document_name is null;

alter table public.mtd_digital_records
  drop constraint if exists mtd_digital_records_document_size_check,
  add constraint mtd_digital_records_document_size_check check (document_size is null or document_size between 1 and 10000000),
  drop constraint if exists mtd_digital_records_document_mime_type_check,
  add constraint mtd_digital_records_document_mime_type_check check (document_mime_type is null or document_mime_type in ('application/pdf','image/jpeg','image/png','image/webp'));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('mtd-evidence','mtd-evidence',false,10000000,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

comment on column public.mtd_digital_records.document_url is 'Private Supabase Storage object path. Never expose as a public URL.';
comment on column public.mtd_digital_records.source_reference is 'User-supplied receipt or invoice reference, separate from uploaded evidence.';

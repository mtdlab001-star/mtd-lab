alter table public.taxpayers
  add column if not exists qualifying_income numeric(12,2),
  add column if not exists qualifying_income_tax_year text,
  add column if not exists mtd_signup_status text not null default 'not_checked',
  add column if not exists mtd_exemption_status text not null default 'not_assessed',
  add column if not exists previous_return_submitted boolean;

alter table public.taxpayers drop constraint if exists taxpayers_qualifying_income_nonnegative;
alter table public.taxpayers add constraint taxpayers_qualifying_income_nonnegative check (qualifying_income is null or qualifying_income >= 0);
alter table public.taxpayers drop constraint if exists taxpayers_qualifying_income_tax_year_format;
alter table public.taxpayers add constraint taxpayers_qualifying_income_tax_year_format check (qualifying_income_tax_year is null or qualifying_income_tax_year ~ '^20[0-9]{2}-[0-9]{2}$');
alter table public.taxpayers drop constraint if exists taxpayers_mtd_signup_status_valid;
alter table public.taxpayers add constraint taxpayers_mtd_signup_status_valid check (mtd_signup_status in ('not_checked','not_required','needs_signup','signed_up'));
alter table public.taxpayers drop constraint if exists taxpayers_mtd_exemption_status_valid;
alter table public.taxpayers add constraint taxpayers_mtd_exemption_status_valid check (mtd_exemption_status in ('not_assessed','not_exempt','application_pending','approved'));

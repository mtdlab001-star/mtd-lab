alter table public.hmrc_quarterly_drafts add column if not exists firm_id uuid;

update public.hmrc_quarterly_drafts d
set firm_id=t.firm_id
from public.taxpayers t
where t.id=d.taxpayer_id and d.firm_id is null;

alter table public.hmrc_quarterly_drafts alter column firm_id set not null;

alter table public.hmrc_quarterly_drafts drop constraint if exists hmrc_quarterly_drafts_taxpayer_id_business_id_income_source_key;

alter table public.hmrc_quarterly_drafts add constraint hmrc_quarterly_drafts_firm_taxpayer_business_source_period_key unique (firm_id,taxpayer_id,business_id,income_source_type,period_end);

create index if not exists idx_hmrc_quarterly_drafts_firm_taxpayer_period
  on public.hmrc_quarterly_drafts(firm_id,taxpayer_id,period_end desc);

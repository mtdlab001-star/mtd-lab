delete from public.hmrc_obligations a
using public.hmrc_obligations b
where a.ctid < b.ctid
  and a.taxpayer_id = b.taxpayer_id
  and coalesce(a.business_id,'') = coalesce(b.business_id,'')
  and a.period_start is not distinct from b.period_start
  and a.period_end is not distinct from b.period_end
  and a.due_date is not distinct from b.due_date
  and coalesce(lower(a.status),'') = coalesce(lower(b.status),'');

create unique index if not exists idx_hmrc_obligations_unique_period
on public.hmrc_obligations (
  taxpayer_id,
  coalesce(business_id,''),
  period_start,
  period_end,
  due_date,
  coalesce(lower(status),'')
);

create unique index if not exists idx_hmrc_quarterly_submissions_one_active_period
  on public.hmrc_quarterly_submissions(taxpayer_id,business_id,period_start,period_end)
  where status in ('sending','submitted');

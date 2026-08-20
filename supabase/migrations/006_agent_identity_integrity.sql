create unique index if not exists uq_mtd_agents_hmrc_arn
  on public.mtd_agents (upper(hmrc_arn))
  where hmrc_arn is not null and btrim(hmrc_arn) <> '';

create unique index if not exists uq_mtd_agents_email
  on public.mtd_agents (lower(email))
  where email is not null and btrim(email) <> '';

alter table public.hmrc_quarterly_submissions
  add column if not exists acting_agent_id uuid references public.mtd_agents(id) on delete set null;

alter table public.mtd_submission_audit
  add column if not exists acting_agent_id uuid references public.mtd_agents(id) on delete set null;

create index if not exists idx_hmrc_quarterly_submissions_agent on public.hmrc_quarterly_submissions(acting_agent_id);
create index if not exists idx_mtd_submission_audit_agent on public.mtd_submission_audit(acting_agent_id);

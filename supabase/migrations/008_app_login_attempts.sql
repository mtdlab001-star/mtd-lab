create table if not exists public.app_login_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  username_hash text not null,
  success boolean not null default false,
  reason text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists app_login_attempts_created_at_idx
  on public.app_login_attempts (created_at desc);

create index if not exists app_login_attempts_ip_created_idx
  on public.app_login_attempts (ip_hash, created_at desc);

create index if not exists app_login_attempts_username_created_idx
  on public.app_login_attempts (username_hash, created_at desc);

create index if not exists app_login_attempts_failed_idx
  on public.app_login_attempts (created_at desc)
  where success = false;

alter table public.app_login_attempts enable row level security;

drop policy if exists "app_login_attempts deny anon authenticated select" on public.app_login_attempts;
drop policy if exists "app_login_attempts deny anon authenticated insert" on public.app_login_attempts;
drop policy if exists "app_login_attempts deny anon authenticated update" on public.app_login_attempts;
drop policy if exists "app_login_attempts deny anon authenticated delete" on public.app_login_attempts;

create policy "app_login_attempts deny anon authenticated select"
  on public.app_login_attempts
  for select
  to anon, authenticated
  using (false);

create policy "app_login_attempts deny anon authenticated insert"
  on public.app_login_attempts
  for insert
  to anon, authenticated
  with check (false);

create policy "app_login_attempts deny anon authenticated update"
  on public.app_login_attempts
  for update
  to anon, authenticated
  using (false)
  with check (false);

create policy "app_login_attempts deny anon authenticated delete"
  on public.app_login_attempts
  for delete
  to anon, authenticated
  using (false);

revoke all on public.app_login_attempts from anon, authenticated;

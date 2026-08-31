create table if not exists public.app_auth_credentials (
  credential_key text primary key default 'primary',
  username text not null,
  password_hash text not null,
  session_version integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint app_auth_credentials_primary_key_only check (credential_key = 'primary'),
  constraint app_auth_credentials_session_version_non_negative check (session_version >= 0)
);

create table if not exists public.app_password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  account_hash text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  delivery_status text not null default 'created',
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_password_reset_audit (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  account_hash text not null,
  event text not null,
  delivery_status text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists app_password_reset_tokens_hash_idx
  on public.app_password_reset_tokens (token_hash);

create index if not exists app_password_reset_tokens_account_created_idx
  on public.app_password_reset_tokens (account_hash, created_at desc);

create index if not exists app_password_reset_tokens_expiry_idx
  on public.app_password_reset_tokens (expires_at)
  where used_at is null;

create index if not exists app_password_reset_audit_ip_created_idx
  on public.app_password_reset_audit (ip_hash, created_at desc);

create index if not exists app_password_reset_audit_account_created_idx
  on public.app_password_reset_audit (account_hash, created_at desc);

alter table public.app_auth_credentials enable row level security;
alter table public.app_password_reset_tokens enable row level security;
alter table public.app_password_reset_audit enable row level security;

drop policy if exists "app_auth_credentials deny anon authenticated select" on public.app_auth_credentials;
drop policy if exists "app_auth_credentials deny anon authenticated insert" on public.app_auth_credentials;
drop policy if exists "app_auth_credentials deny anon authenticated update" on public.app_auth_credentials;
drop policy if exists "app_auth_credentials deny anon authenticated delete" on public.app_auth_credentials;

drop policy if exists "app_password_reset_tokens deny anon authenticated select" on public.app_password_reset_tokens;
drop policy if exists "app_password_reset_tokens deny anon authenticated insert" on public.app_password_reset_tokens;
drop policy if exists "app_password_reset_tokens deny anon authenticated update" on public.app_password_reset_tokens;
drop policy if exists "app_password_reset_tokens deny anon authenticated delete" on public.app_password_reset_tokens;

drop policy if exists "app_password_reset_audit deny anon authenticated select" on public.app_password_reset_audit;
drop policy if exists "app_password_reset_audit deny anon authenticated insert" on public.app_password_reset_audit;
drop policy if exists "app_password_reset_audit deny anon authenticated update" on public.app_password_reset_audit;
drop policy if exists "app_password_reset_audit deny anon authenticated delete" on public.app_password_reset_audit;

create policy "app_auth_credentials deny anon authenticated select"
  on public.app_auth_credentials for select to anon, authenticated using (false);
create policy "app_auth_credentials deny anon authenticated insert"
  on public.app_auth_credentials for insert to anon, authenticated with check (false);
create policy "app_auth_credentials deny anon authenticated update"
  on public.app_auth_credentials for update to anon, authenticated using (false) with check (false);
create policy "app_auth_credentials deny anon authenticated delete"
  on public.app_auth_credentials for delete to anon, authenticated using (false);

create policy "app_password_reset_tokens deny anon authenticated select"
  on public.app_password_reset_tokens for select to anon, authenticated using (false);
create policy "app_password_reset_tokens deny anon authenticated insert"
  on public.app_password_reset_tokens for insert to anon, authenticated with check (false);
create policy "app_password_reset_tokens deny anon authenticated update"
  on public.app_password_reset_tokens for update to anon, authenticated using (false) with check (false);
create policy "app_password_reset_tokens deny anon authenticated delete"
  on public.app_password_reset_tokens for delete to anon, authenticated using (false);

create policy "app_password_reset_audit deny anon authenticated select"
  on public.app_password_reset_audit for select to anon, authenticated using (false);
create policy "app_password_reset_audit deny anon authenticated insert"
  on public.app_password_reset_audit for insert to anon, authenticated with check (false);
create policy "app_password_reset_audit deny anon authenticated update"
  on public.app_password_reset_audit for update to anon, authenticated using (false) with check (false);
create policy "app_password_reset_audit deny anon authenticated delete"
  on public.app_password_reset_audit for delete to anon, authenticated using (false);

revoke all on public.app_auth_credentials from anon, authenticated;
revoke all on public.app_password_reset_tokens from anon, authenticated;
revoke all on public.app_password_reset_audit from anon, authenticated;

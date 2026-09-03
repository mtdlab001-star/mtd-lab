do $$
declare table_name text;
begin
  foreach table_name in array array[
    'accounting_firms',
    'app_active_sessions',
    'app_users',
    'firm_access_audit',
    'firm_subscription_purchases',
    'firm_subscriptions',
    'subscription_bundles'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);

    execute format('drop policy if exists server_managed_no_browser_select on public.%I', table_name);
    execute format('drop policy if exists server_managed_no_browser_insert on public.%I', table_name);
    execute format('drop policy if exists server_managed_no_browser_update on public.%I', table_name);
    execute format('drop policy if exists server_managed_no_browser_delete on public.%I', table_name);

    execute format(
      'create policy server_managed_no_browser_select on public.%I for select to anon, authenticated using (false)',
      table_name
    );
    execute format(
      'create policy server_managed_no_browser_insert on public.%I for insert to anon, authenticated with check (false)',
      table_name
    );
    execute format(
      'create policy server_managed_no_browser_update on public.%I for update to anon, authenticated using (false) with check (false)',
      table_name
    );
    execute format(
      'create policy server_managed_no_browser_delete on public.%I for delete to anon, authenticated using (false)',
      table_name
    );

    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end $$;

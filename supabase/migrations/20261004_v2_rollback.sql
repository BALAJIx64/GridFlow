-- Rolls back the v2 migration's structural additions. Data in the dropped tables is lost.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists guard_bill_update on public.bills;
do $$ declare t text; begin
  foreach t in array array['consumers','meters','technicians','zones','tariffs','bills','payments'] loop
    execute format('drop trigger if exists protect_history on public.%I',t);
  end loop;
  foreach t in array array['consumers','technicians'] loop
    execute format('drop trigger if exists sync_zone_ref on public.%I',t);
  end loop;
end $$;
drop trigger if exists cascade_zone_rename on public.zones;
drop function if exists public.protect_history(), public.guard_bill_update(), public.sync_zone_ref(), public.cascade_zone_rename();
drop function if exists public.mark_overdue_bills(), public.report_table_counts(), public.report_consumption_by_zone(),
  public.report_revenue_by_tariff(), public.report_top_consumers(integer), public.db_explorer_tables(),
  public.db_explorer_rows(text,integer,integer,text,boolean,text), public.bootstrap_super_admin(), public.handle_new_user();
drop table if exists public.db_operation_logs;
drop table if exists public.user_profiles cascade;
alter table public.consumers drop constraint if exists consumers_status_check;
alter table public.consumers add constraint consumers_status_check check (status in ('active','pending','suspended','inactive'));
-- Re-running supabase/schema.sql restores the original is_gridflow_admin() and admin-only policies.

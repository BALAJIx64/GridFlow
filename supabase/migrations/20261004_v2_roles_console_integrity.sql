-- GridFlow v2 migration: database-managed roles, operation log, consumer Active/Inactive,
-- historical-data protection, reporting + explorer RPCs.
-- Apply AFTER supabase/schema.sql, in the Supabase SQL Editor. Safe to re-run.
-- Rollback: supabase/migrations/20261004_v2_rollback.sql

-- ---------------------------------------------------------------- 1. user_profiles & roles
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, full_name text,
  role text not null default 'operator' check (role in ('super_admin','admin','operator')),
  is_active boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.user_profiles where id = (select auth.uid()) and is_active
$$;
create or replace function public.has_role(variadic roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() = any(roles), false)
$$;
-- "Any active staff member" (kept name: existing RPCs and policies call it).
create or replace function public.is_gridflow_admin()
returns boolean language sql stable security invoker set search_path = '' as $$
  select public.has_role('super_admin','admin','operator')
$$;

-- New auth users get an INACTIVE operator profile until a super_admin approves them.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_profiles(id,email,full_name)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)))
  on conflict(id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.user_profiles(id,email,full_name)
  select id,email,split_part(email,'@',1) from auth.users on conflict(id) do nothing;

-- First-run bootstrap: works only while no active super_admin exists.
create or replace function public.bootstrap_super_admin()
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return false; end if;
  if exists(select 1 from public.user_profiles where role='super_admin' and is_active) then return false; end if;
  insert into public.user_profiles(id,email,full_name,role,is_active)
    select u.id,u.email,split_part(u.email,'@',1),'super_admin',true from auth.users u where u.id=auth.uid()
  on conflict(id) do update set role='super_admin',is_active=true;
  return true;
end $$;

create or replace function public.protect_last_super_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role='super_admin' and old.is_active
     and (tg_op='DELETE' or new.role<>'super_admin' or not new.is_active)
     and not exists(select 1 from public.user_profiles where role='super_admin' and is_active and id<>old.id) then
    raise exception 'At least one active super_admin must remain.' using errcode='23001';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists protect_last_super_admin on public.user_profiles;
create trigger protect_last_super_admin before update or delete on public.user_profiles
  for each row execute function public.protect_last_super_admin();

-- ---------------------------------------------------------------- 2. operation log
create table if not exists public.db_operation_logs (
  id bigint generated always as identity primary key,
  actor_id uuid default auth.uid() references auth.users(id) on delete set null,
  actor_email text, op_type text not null, table_name text,
  sql_text text not null, rows_affected integer, duration_ms numeric(10,2),
  success boolean not null default true, error_message text,
  created_at timestamptz not null default now()
);
create index if not exists db_operation_logs_created_idx on public.db_operation_logs(created_at desc);

-- ---------------------------------------------------------------- 3. consumer Active / Inactive
do $$ declare c record; begin
  for c in select conname from pg_constraint
           where conrelid='public.consumers'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%status%' loop
    execute format('alter table public.consumers drop constraint %I',c.conname);
  end loop;
end $$;
update public.consumers set status='inactive' where status in ('pending','suspended');
alter table public.consumers add constraint consumers_status_check check (status in ('active','inactive'));
alter table public.consumers alter column status set default 'active';

alter table public.zones add column if not exists is_active boolean not null default true;
alter table public.technicians add column if not exists is_active boolean not null default true;
alter table public.meters add column if not exists is_active boolean not null default true;

-- ---------------------------------------------------------------- 4. zone reference sync
create or replace function public.sync_zone_ref()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if nullif(trim(new.zone),'') is not null then
    new.zone := trim(new.zone);
    insert into public.zones(name) values(new.zone) on conflict(name) do nothing;
    select id into new.zone_id from public.zones where name = new.zone;
  else
    new.zone := null; new.zone_id := null;
  end if;
  return new;
end $$;
create or replace function public.cascade_zone_rename()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.name <> old.name then
    update public.consumers set zone = new.name where zone_id = new.id;
    update public.technicians set zone = new.name where zone_id = new.id;
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['consumers','technicians'] loop
    execute format('drop trigger if exists sync_zone_ref on public.%I',t);
    execute format('create trigger sync_zone_ref before insert or update of zone on public.%I for each row execute function public.sync_zone_ref()',t);
  end loop;
end $$;
drop trigger if exists cascade_zone_rename on public.zones;
create trigger cascade_zone_rename after update of name on public.zones for each row execute function public.cascade_zone_rename();

-- ---------------------------------------------------------------- 5. historical-data protection
create or replace function public.protect_history()
returns trigger language plpgsql security definer set search_path = '' as $$
declare reasons text[] := '{}'; n bigint;
begin
  if tg_table_name = 'payments' then
    raise exception 'Payment records form the financial ledger and cannot be deleted.' using errcode='23001';
  elsif tg_table_name = 'consumers' then
    select count(*) into n from public.bills where consumer_id=old.id; if n>0 then reasons := reasons || format('%s bill(s)',n); end if;
    select count(*) into n from public.meters where consumer_id=old.id; if n>0 then reasons := reasons || format('%s meter(s)',n); end if;
    select count(*) into n from public.service_records where consumer_id=old.id; if n>0 then reasons := reasons || format('%s service record(s)',n); end if;
  elsif tg_table_name = 'meters' then
    select count(*) into n from public.meter_readings where meter_id=old.id; if n>0 then reasons := reasons || format('%s meter reading(s)',n); end if;
    select count(*) into n from public.service_records where meter_id=old.id; if n>0 then reasons := reasons || format('%s service record(s)',n); end if;
  elsif tg_table_name = 'technicians' then
    select count(*) into n from public.service_records where technician_id=old.id; if n>0 then reasons := reasons || format('%s service record(s)',n); end if;
  elsif tg_table_name = 'zones' then
    select count(*) into n from public.consumers where zone_id=old.id or zone=old.name; if n>0 then reasons := reasons || format('%s consumer(s)',n); end if;
    select count(*) into n from public.technicians where zone_id=old.id or zone=old.name; if n>0 then reasons := reasons || format('%s technician(s)',n); end if;
    select count(*) into n from public.service_records where zone_id=old.id; if n>0 then reasons := reasons || format('%s service record(s)',n); end if;
  elsif tg_table_name = 'tariffs' then
    select count(*) into n from public.consumers where tariff_id=old.id; if n>0 then reasons := reasons || format('%s consumer(s)',n); end if;
    select count(*) into n from public.meters where tariff_id=old.id; if n>0 then reasons := reasons || format('%s meter(s)',n); end if;
  elsif tg_table_name = 'bills' then
    select count(*) into n from public.payments where bill_id=old.id; if n>0 then reasons := reasons || format('%s payment(s)',n); end if;
  end if;
  if coalesce(array_length(reasons,1),0) > 0 then
    raise exception 'Cannot delete this % record: it is referenced by %. Deactivate it instead of deleting.',
      tg_table_name, array_to_string(reasons,', ') using errcode='23001';
  end if;
  return old;
end $$;
do $$ declare t text; begin
  foreach t in array array['consumers','meters','technicians','zones','tariffs','bills','payments'] loop
    execute format('drop trigger if exists protect_history on public.%I',t);
    execute format('create trigger protect_history before delete on public.%I for each row execute function public.protect_history()',t);
  end loop;
end $$;

-- Operators may only change the payment status of a bill, never its amounts.
create or replace function public.guard_bill_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not public.has_role('super_admin','admin') then
    if (new.bill_number,new.consumer_id,new.period_start,new.period_end,new.due_date,new.usage_kwh,new.energy_charge,new.fixed_charge,new.total_amount,new.currency)
       is distinct from
       (old.bill_number,old.consumer_id,old.period_start,old.period_end,old.due_date,old.usage_kwh,old.energy_charge,old.fixed_charge,old.total_amount,old.currency) then
      raise exception 'Your role may only record payment status on bills.' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_bill_update on public.bills;
create trigger guard_bill_update before update on public.bills for each row execute function public.guard_bill_update();

-- Latest reading must sync even when an operator records the reading.
create or replace function public.sync_latest_meter_reading()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.meters set latest_reading=(select r.reading_kwh from public.meter_readings r where r.meter_id=new.meter_id order by r.recorded_at desc,r.created_at desc limit 1) where id=new.meter_id;
  return new;
end $$;

-- ---------------------------------------------------------------- 6. triggers for new table
do $$ declare t text; begin
  foreach t in array array['user_profiles'] loop
    execute format('drop trigger if exists touch_updated_at on public.%I',t);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
    execute format('drop trigger if exists log_gridflow_change on public.%I',t);
    execute format('create trigger log_gridflow_change after insert or update or delete on public.%I for each row execute function public.log_gridflow_change()',t);
  end loop;
end $$;

-- ---------------------------------------------------------------- 7. RPCs
create or replace function public.mark_overdue_bills()
returns integer language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  if not public.is_gridflow_admin() then raise exception 'Staff access required'; end if;
  update public.bills set status='overdue' where status='pending' and due_date < current_date;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.report_table_counts()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_array(
    jsonb_build_object('table','consumers','total',(select count(*) from public.consumers),'active',(select count(*) from public.consumers where status='active')),
    jsonb_build_object('table','meters','total',(select count(*) from public.meters),'active',(select count(*) from public.meters where status='online')),
    jsonb_build_object('table','bills','total',(select count(*) from public.bills),'active',(select count(*) from public.bills where status='paid')),
    jsonb_build_object('table','payments','total',(select count(*) from public.payments),'active',(select count(*) from public.payments where status='succeeded')),
    jsonb_build_object('table','technicians','total',(select count(*) from public.technicians),'active',(select count(*) from public.technicians where status='available')))
$$;
create or replace function public.report_consumption_by_zone()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(r),'[]'::jsonb) from (
    select coalesce(c.zone,'Unassigned') as zone, count(distinct c.id) as consumers,
           count(b.id) as bills, coalesce(sum(b.usage_kwh),0) as total_kwh, coalesce(sum(b.total_amount),0) as billed_inr
    from public.consumers c left join public.bills b on b.consumer_id = c.id
    group by 1 order by billed_inr desc) r
$$;
create or replace function public.report_revenue_by_tariff()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(r),'[]'::jsonb) from (
    select t.name as tariff, t.category, count(b.id) as bills,
           coalesce(sum(b.total_amount),0) as billed_inr,
           coalesce(sum(b.total_amount) filter (where b.status='paid'),0) as collected_inr
    from public.tariffs t
    left join public.consumers c on c.tariff_id = t.id
    left join public.bills b on b.consumer_id = c.id
    group by t.id order by billed_inr desc) r
$$;
create or replace function public.report_top_consumers(p_limit integer default 10)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(r),'[]'::jsonb) from (
    select c.account_number, c.full_name, c.status, coalesce(sum(b.usage_kwh),0) as total_kwh, coalesce(sum(b.total_amount),0) as billed_inr
    from public.consumers c join public.bills b on b.consumer_id = c.id
    group by c.id order by total_kwh desc limit greatest(1,least(p_limit,100))) r
$$;

create or replace function public.db_explorer_tables()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('table',t,
    'rows',(xpath('/row/c/text()',query_to_xml(format('select count(*) as c from public.%I',t),false,true,'')))[1]::text::bigint) order by t),'[]'::jsonb)
  from unnest(array['activity_logs','bills','consumers','db_operation_logs','meter_readings','meters','notifications','payments','service_records','system_settings','tariffs','technicians','user_profiles','zones']) t
$$;
create or replace function public.db_explorer_rows(p_table text,p_limit integer default 25,p_offset integer default 0,p_order text default null,p_desc boolean default false,p_search text default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare cols jsonb; total bigint; result jsonb; ord text := ''; flt text := '';
begin
  if p_table <> all(array['activity_logs','bills','consumers','db_operation_logs','meter_readings','meters','notifications','payments','service_records','system_settings','tariffs','technicians','user_profiles','zones']) then
    raise exception 'Table % is not available in the explorer', p_table;
  end if;
  select jsonb_agg(jsonb_build_object('name',column_name,'type',data_type) order by ordinal_position) into cols
    from information_schema.columns where table_schema='public' and table_name=p_table;
  if p_order is not null and exists(select 1 from information_schema.columns where table_schema='public' and table_name=p_table and column_name=p_order) then
    ord := format(' order by %I %s',p_order,case when p_desc then 'desc' else 'asc' end);
  end if;
  if coalesce(p_search,'') <> '' then flt := format(' where t::text ilike %L','%'||p_search||'%'); end if;
  execute format('select count(*) from public.%I t%s',p_table,flt) into total;
  execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select * from public.%I t%s%s limit %s offset %s) x',
    p_table,flt,ord,greatest(1,least(p_limit,200)),greatest(0,p_offset)) into result;
  return jsonb_build_object('total',total,'columns',coalesce(cols,'[]'::jsonb),'rows',result);
end $$;

-- ---------------------------------------------------------------- 8. grants
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
do $$ declare f text; begin
  foreach f in array array[
    'current_app_role()','has_role(text[])','bootstrap_super_admin()','mark_overdue_bills()','report_table_counts()',
    'report_consumption_by_zone()','report_revenue_by_tariff()','report_top_consumers(integer)','db_explorer_tables()',
    'db_explorer_rows(text,integer,integer,text,boolean,text)'] loop
    execute format('revoke execute on function public.%s from public, anon',f);
    execute format('grant execute on function public.%s to authenticated',f);
  end loop;
end $$;

-- ---------------------------------------------------------------- 9. role-aware RLS
do $$ declare t text; p record; begin
  foreach t in array array['zones','tariffs','consumers','meters','meter_readings','bills','payments','technicians','service_records','activity_logs','notifications','system_settings','user_profiles','db_operation_logs'] loop
    execute format('alter table public.%I enable row level security',t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I',p.policyname,t);
    end loop;
  end loop;
end $$;

-- SELECT: any active staff on operational tables
do $$ declare t text; begin
  foreach t in array array['zones','tariffs','consumers','meters','meter_readings','bills','payments','technicians','service_records','activity_logs','notifications','system_settings'] loop
    execute format('create policy gf_select on public.%I for select to authenticated using (public.has_role(''super_admin'',''admin'',''operator''))',t);
  end loop;
end $$;
-- INSERT / UPDATE / DELETE: administrators on master data
do $$ declare t text; begin
  foreach t in array array['zones','tariffs','consumers','meters','technicians','notifications'] loop
    execute format('create policy gf_insert on public.%I for insert to authenticated with check (public.has_role(''super_admin'',''admin''))',t);
    execute format('create policy gf_update on public.%I for update to authenticated using (public.has_role(''super_admin'',''admin'')) with check (public.has_role(''super_admin'',''admin''))',t);
    execute format('create policy gf_delete on public.%I for delete to authenticated using (public.has_role(''super_admin'',''admin''))',t);
  end loop;
end $$;
-- Operational data that operators may write
create policy gf_insert on public.meter_readings for insert to authenticated with check (public.has_role('super_admin','admin','operator'));
create policy gf_delete on public.meter_readings for delete to authenticated using (public.has_role('super_admin','admin'));
create policy gf_insert on public.payments for insert to authenticated with check (public.has_role('super_admin','admin','operator'));
create policy gf_insert on public.service_records for insert to authenticated with check (public.has_role('super_admin','admin','operator'));
create policy gf_update on public.service_records for update to authenticated using (public.has_role('super_admin','admin','operator')) with check (public.has_role('super_admin','admin','operator'));
create policy gf_delete on public.service_records for delete to authenticated using (public.has_role('super_admin','admin'));
create policy gf_insert on public.bills for insert to authenticated with check (public.has_role('super_admin','admin'));
create policy gf_update on public.bills for update to authenticated using (public.has_role('super_admin','admin','operator')) with check (public.has_role('super_admin','admin','operator'));
create policy gf_delete on public.bills for delete to authenticated using (public.has_role('super_admin','admin'));
create policy gf_insert on public.activity_logs for insert to authenticated with check (public.has_role('super_admin','admin','operator'));
-- Super-admin only
create policy gf_insert on public.system_settings for insert to authenticated with check (public.has_role('super_admin'));
create policy gf_update on public.system_settings for update to authenticated using (public.has_role('super_admin')) with check (public.has_role('super_admin'));
create policy gf_delete on public.system_settings for delete to authenticated using (public.has_role('super_admin'));
-- Profiles: read own row, administrators read all, only super_admin changes roles
create policy gf_select on public.user_profiles for select to authenticated using (id = (select auth.uid()) or public.has_role('super_admin','admin'));
create policy gf_update on public.user_profiles for update to authenticated using (public.has_role('super_admin')) with check (public.has_role('super_admin'));
create policy gf_delete on public.user_profiles for delete to authenticated using (public.has_role('super_admin'));
-- Operation log: staff append, administrators read; rows are immutable
create policy gf_select on public.db_operation_logs for select to authenticated using (public.has_role('super_admin','admin'));
create policy gf_insert on public.db_operation_logs for insert to authenticated with check (public.has_role('super_admin','admin','operator'));

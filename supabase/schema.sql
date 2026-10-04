-- GridFlow initial database setup. Apply once in the Supabase SQL editor.
-- Tables are intentionally empty; seed tariffs/zones through the secured admin UI.
create extension if not exists pgcrypto;

create or replace function public.is_gridflow_admin()
returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'gridflow_admin';
$$;

create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  description text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.tariffs (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  category text not null check (category in ('residential','business','commercial')),
  rate_per_kwh numeric(12,4) not null check (rate_per_kwh >= 0), fixed_charge numeric(12,2) not null default 0 check (fixed_charge >= 0),
  currency char(3) not null default 'INR' check (currency = 'INR'), is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.consumers (
  id uuid primary key default gen_random_uuid(), account_number text not null unique,
  full_name text not null, email text, phone text, address text not null,
  zone_id uuid references public.zones(id) on delete set null, zone text,
  tariff_id uuid references public.tariffs(id) on delete set null, plan text,
  status text not null default 'pending' check (status in ('active','pending','suspended')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.meters (
  id uuid primary key default gen_random_uuid(), serial_number text not null unique,
  consumer_id uuid references public.consumers(id) on delete set null,
  tariff_id uuid references public.tariffs(id) on delete set null,
  latest_reading numeric(14,3) not null default 0 check (latest_reading >= 0),
  status text not null default 'installing' check (status in ('online','offline','installing')),
  installed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.meter_readings (
  id uuid primary key default gen_random_uuid(), meter_id uuid not null references public.meters(id) on delete cascade,
  reading_kwh numeric(14,3) not null check (reading_kwh >= 0), recorded_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual','smart_meter','imported')), created_at timestamptz not null default now()
);
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(), bill_number text not null unique,
  consumer_id uuid not null references public.consumers(id) on delete restrict,
  period_start date not null, period_end date not null, due_date date not null,
  usage_kwh numeric(14,3) not null default 0 check (usage_kwh >= 0),
  energy_charge numeric(14,2) not null default 0 check (energy_charge >= 0),
  fixed_charge numeric(14,2) not null default 0 check (fixed_charge >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  status text not null default 'pending' check (status in ('paid','pending','overdue','void')),
  paid_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (period_end >= period_start), unique(consumer_id, period_start, period_end)
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), bill_id uuid not null references public.bills(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0), currency char(3) not null default 'INR' check (currency = 'INR'),
  method text, reference text unique, status text not null default 'pending' check(status in ('pending','succeeded','failed','refunded')),
  paid_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(), employee_number text unique,
  full_name text not null, email text, phone text, zone_id uuid references public.zones(id) on delete set null, zone text,
  status text not null default 'available' check(status in ('available','on-site','off-duty')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.service_records (
  id uuid primary key default gen_random_uuid(), technician_id uuid references public.technicians(id) on delete set null,
  consumer_id uuid references public.consumers(id) on delete set null, meter_id uuid references public.meters(id) on delete set null,
  zone_id uuid references public.zones(id) on delete set null, summary text not null,
  priority text not null default 'normal' check(priority in ('low','normal','high','critical')),
  status text not null default 'scheduled' check(status in ('scheduled','in-progress','complete','cancelled')),
  scheduled_for timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.activity_logs (
  id bigint generated always as identity primary key, actor_id uuid references auth.users(id) on delete set null,
  action text not null, entity text not null, entity_id text, details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  title text not null, body text not null, read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.system_settings (
  key text primary key, value jsonb not null default '{}'::jsonb, updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists consumers_status_idx on public.consumers(status);
create index if not exists consumers_zone_idx on public.consumers(zone_id);
create index if not exists meters_consumer_idx on public.meters(consumer_id);
create index if not exists readings_meter_time_idx on public.meter_readings(meter_id, recorded_at desc);
create index if not exists bills_period_idx on public.bills(period_start, period_end);
create index if not exists bills_status_due_idx on public.bills(status, due_date);
create index if not exists payments_bill_idx on public.payments(bill_id, created_at desc);
create index if not exists service_records_scheduled_idx on public.service_records(scheduled_for);
create index if not exists activity_logs_created_idx on public.activity_logs(created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;
create unique index if not exists tariffs_one_active_category_idx on public.tariffs(category) where is_active;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['zones','tariffs','consumers','meters','bills','technicians','service_records','system_settings'] loop
    execute format('drop trigger if exists touch_updated_at on public.%I',t);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
  end loop;
end $$;

create or replace function public.sync_latest_meter_reading()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.meters set latest_reading=(select r.reading_kwh from public.meter_readings r where r.meter_id=new.meter_id order by r.recorded_at desc,r.created_at desc limit 1) where id=new.meter_id;
  return new;
end $$;
drop trigger if exists sync_latest_meter_reading on public.meter_readings;
create trigger sync_latest_meter_reading after insert on public.meter_readings for each row execute function public.sync_latest_meter_reading();

create or replace function public.log_gridflow_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare row_id text;
        record_json jsonb;
begin
  if TG_OP='DELETE' then record_json:=to_jsonb(old); else record_json:=to_jsonb(new); end if;
  row_id := record_json->>'id';
  insert into public.activity_logs(actor_id,action,entity,entity_id,details)
  values(auth.uid(),lower(TG_OP),TG_TABLE_NAME,row_id,jsonb_build_object('record',record_json));
  if TG_OP='DELETE' then return old; else return new; end if;
end $$;
do $$ declare t text; begin
  foreach t in array array['consumers','meters','meter_readings','bills','payments','technicians','service_records','tariffs','zones'] loop
    execute format('drop trigger if exists log_gridflow_change on public.%I',t);
    execute format('create trigger log_gridflow_change after insert or update or delete on public.%I for each row execute function public.log_gridflow_change()',t);
  end loop;
end $$;

create or replace function public.generate_bills(p_period_start date,p_period_end date,p_due_date date)
returns integer language plpgsql security invoker set search_path = '' as $$
declare inserted_count integer;
begin
  if not public.is_gridflow_admin() then raise exception 'GridFlow administrator access required'; end if;
  if p_period_end < p_period_start then raise exception 'Billing period end must not precede its start'; end if;
  with meter_usage as (
    select consumer_id,sum(greatest(0,last_reading-first_reading)) usage from (
      select m.id,m.consumer_id,
       (select r0.reading_kwh from public.meter_readings r0 where r0.meter_id=m.id and r0.recorded_at::date < p_period_start order by r0.recorded_at desc limit 1) first_reading,
       max(r.reading_kwh) filter(where r.recorded_at::date <= p_period_end) last_reading
      from public.meters m join public.meter_readings r on r.meter_id=m.id
      where m.consumer_id is not null and r.recorded_at::date <= p_period_end
      group by m.id,m.consumer_id
    ) meter_totals where first_reading is not null and last_reading is not null group by consumer_id
  ), candidates as (
    select c.id consumer_id,coalesce(u.usage,0) usage,coalesce(t.rate_per_kwh,0) rate,coalesce(t.fixed_charge,0) fixed
    from public.consumers c join public.tariffs t on t.id=c.tariff_id and t.is_active left join meter_usage u on u.consumer_id=c.id
    where c.status='active' and u.consumer_id is not null
  ), inserted as (
    insert into public.bills(bill_number,consumer_id,period_start,period_end,due_date,usage_kwh,energy_charge,fixed_charge,total_amount)
    select 'GF-'||to_char(p_period_start,'YYYYMM')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
      consumer_id,p_period_start,p_period_end,p_due_date,usage,round((usage*rate)::numeric,2),fixed,round((usage*rate+fixed)::numeric,2)
    from candidates on conflict(consumer_id,period_start,period_end) do nothing returning id
  ) select count(*) into inserted_count from inserted;
  return inserted_count;
end $$;

create or replace function public.get_dashboard_metrics()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
 if not public.is_gridflow_admin() then raise exception 'GridFlow administrator access required'; end if;
 return jsonb_build_object(
  'consumers',(select count(*) from public.consumers),
  'active_consumers',(select count(*) from public.consumers where status='active'),
  'meters',(select count(*) from public.meters),
  'online_meters',(select count(*) from public.meters where status='online'),
  'technicians',(select count(*) from public.technicians),
  'bills',(select count(*) from public.bills),
  'paid_bills',(select count(*) from public.bills where status='paid'),
  'pending_amount',(select coalesce(sum(total_amount),0) from public.bills where status in ('pending','overdue')),
  'collected_amount',(select coalesce(sum(total_amount),0) from public.bills where status='paid'),
  'energy_kwh',(select coalesce(sum(usage_kwh),0) from public.bills)
 );
end $$;
create or replace function public.record_manual_payment(p_bill_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare bill_row public.bills%rowtype;
begin
 if not public.is_gridflow_admin() then raise exception 'GridFlow administrator access required'; end if;
 select * into bill_row from public.bills where id=p_bill_id for update;
 if not found then raise exception 'Bill not found'; end if;
 if bill_row.status='paid' then raise exception 'Bill is already paid'; end if;
 insert into public.payments(bill_id,amount,currency,method,status,paid_at)
 values(bill_row.id,bill_row.total_amount,bill_row.currency,'manual','succeeded',now());
 update public.bills set status='paid',paid_at=now() where id=bill_row.id;
end $$;
create or replace function public.get_report_analytics(p_from date default null,p_to date default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
 if not public.is_gridflow_admin() then raise exception 'GridFlow administrator access required'; end if;
 return jsonb_build_object(
  'monthly_energy',coalesce((select jsonb_agg(jsonb_build_object('month',to_char(period_start,'Mon'),'usage_kwh',usage) order by period_start) from (select date_trunc('month',period_start)::date period_start,sum(usage_kwh) usage from public.bills where (p_from is null or period_start>=p_from) and (p_to is null or period_end<=p_to) group by 1) q),'[]'::jsonb),
  'monthly_collection',coalesce((select jsonb_agg(jsonb_build_object('month',to_char(period_start,'Mon'),'paid',paid,'pending',pending) order by period_start) from (select date_trunc('month',period_start)::date period_start,count(*) filter(where status='paid') paid,count(*) filter(where status in ('pending','overdue')) pending from public.bills where (p_from is null or period_start>=p_from) and (p_to is null or period_end<=p_to) group by 1) q),'[]'::jsonb),
  'consumer_distribution',coalesce((select jsonb_object_agg(coalesce(plan,'Unassigned'),n) from (select plan,count(*) n from public.consumers group by plan) q),'{}'::jsonb),
  'recent_activity',coalesce((select jsonb_agg(jsonb_build_object('action',action,'entity',entity,'entity_id',entity_id,'created_at',created_at) order by created_at desc) from (select action,entity,entity_id,created_at from public.activity_logs order by created_at desc limit 10) q),'[]'::jsonb)
 );
end $$;

-- Explicit API grants accompany RLS; unauthenticated users have no table access.
grant usage on schema public to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;
grant execute on function public.is_gridflow_admin() to authenticated;
grant execute on function public.generate_bills(date,date,date) to authenticated;
grant execute on function public.get_dashboard_metrics() to authenticated;
grant execute on function public.get_report_analytics(date,date) to authenticated;
grant execute on function public.record_manual_payment(uuid) to authenticated;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on function public.generate_bills(date,date,date) from public,anon;
revoke execute on function public.get_dashboard_metrics() from public,anon;
revoke execute on function public.get_report_analytics(date,date) from public,anon;
revoke execute on function public.record_manual_payment(uuid) from public,anon;

do $$ declare t text; begin
 foreach t in array array['zones','tariffs','consumers','meters','meter_readings','bills','payments','technicians','service_records','activity_logs','notifications','system_settings'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists gridflow_admin_select on public.%I',t);
  execute format('create policy gridflow_admin_select on public.%I for select to authenticated using ((select public.is_gridflow_admin()))',t);
  execute format('drop policy if exists gridflow_admin_insert on public.%I',t);
  execute format('create policy gridflow_admin_insert on public.%I for insert to authenticated with check ((select public.is_gridflow_admin()))',t);
  execute format('drop policy if exists gridflow_admin_update on public.%I',t);
  execute format('create policy gridflow_admin_update on public.%I for update to authenticated using ((select public.is_gridflow_admin())) with check ((select public.is_gridflow_admin()))',t);
  execute format('drop policy if exists gridflow_admin_delete on public.%I',t);
  execute format('create policy gridflow_admin_delete on public.%I for delete to authenticated using ((select public.is_gridflow_admin()))',t);
 end loop;
end $$;

-- Supabase Realtime feeds fresh rows to the existing live-status UI.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['consumers','meters','meter_readings','bills','technicians','service_records','activity_logs','tariffs'] loop
   begin execute format('alter publication supabase_realtime add table public.%I',t);
   exception when duplicate_object then null; end;
  end loop;
 end if;
end $$;

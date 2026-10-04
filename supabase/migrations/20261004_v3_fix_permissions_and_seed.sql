-- ==============================================================================
-- GridFlow v3 Migration: Permission Fix, Admin Confirmation & Default Seeding
-- Run this in the Supabase SQL Editor to enable full CRUD & consumer portal access.
-- ==============================================================================

-- 1. Auto-confirm the Super Admin account in Supabase Auth
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email = 'balaji.c.m.x64@gmail.com';

-- 2. Bootstrap Super Admin Profile
insert into public.user_profiles (id, email, full_name, role, is_active)
select 
  id, 
  email, 
  'Balaji C M (Super Admin)', 
  'super_admin', 
  true 
from auth.users 
where email = 'balaji.c.m.x64@gmail.com'
on conflict (id) do update 
set role = 'super_admin', is_active = true, full_name = 'Balaji C M (Super Admin)';

-- 3. Seed Default Utility Zones
insert into public.zones (name, description) values
  ('North End', 'Northern utility grid sector'),
  ('Riverside', 'Waterfront and residential sector'),
  ('Midtown', 'Central commercial and business district'),
  ('Eastside', 'Eastern industrial and residential zone')
on conflict (name) do nothing;

-- 4. Seed Default Electricity Tariffs (INR Currency)
insert into public.tariffs (name, category, rate_per_kwh, fixed_charge, currency, is_active) values
  ('Residential Standard', 'residential', 6.5000, 120.00, 'INR', true),
  ('Business General', 'business', 9.2000, 250.00, 'INR', true),
  ('Commercial High-Tension', 'commercial', 12.8000, 500.00, 'INR', true)
on conflict (name) do nothing;

-- 5. Grant Full Schema, Table, Sequence and Routine Access
-- Needed because Consumers authenticate passwordlessly (anon role) and Admin uses publishable key
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

-- 6. Configure Permissive Row Level Security
-- Enables seamless CRUD for Admin and passwordless access for Consumer Portal
do $$ declare t text; p record; begin
  foreach t in array array[
    'zones','tariffs','consumers','meters','meter_readings','bills',
    'payments','technicians','service_records','activity_logs',
    'notifications','system_settings','user_profiles','db_operation_logs'
  ] loop
    -- Drop existing restrictive policies
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
    
    -- Create open access policies for public utility operations
    execute format('create policy %I on public.%I for all to anon, authenticated using (true) with check (true)', 'gf_allow_all_' || t, t);
  end loop;
end $$;

-- 7. Ensure consumers status check includes active and inactive
alter table public.consumers drop constraint if exists consumers_status_check;
alter table public.consumers add constraint consumers_status_check check (status in ('active','inactive','pending','suspended'));

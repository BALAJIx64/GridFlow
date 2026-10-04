create extension if not exists "pgcrypto";

create table if not exists consumers (
  id uuid primary key default gen_random_uuid(),
  account_number text unique not null,
  full_name text not null,
  email text,
  phone text,
  address text,
  zone text,
  tariff_id uuid,
  status text not null default 'active' check (status in ('active', 'pending', 'suspended')),
  created_at timestamptz not null default now()
);

create table if not exists tariffs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rate_per_unit numeric(10,2) not null default 0,
  category text not null default 'Residential',
  created_at timestamptz not null default now()
);

create table if not exists meters (
  id uuid primary key default gen_random_uuid(),
  serial_number text unique not null,
  consumer_id uuid references consumers(id) on delete set null,
  tariff_id uuid references tariffs(id) on delete set null,
  latest_reading numeric(12,2) not null default 0,
  status text not null default 'online' check (status in ('online', 'offline', 'installing')),
  installed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table consumers drop constraint if exists consumers_tariff_id_fkey;
alter table consumers add constraint consumers_tariff_id_fkey foreign key (tariff_id) references tariffs(id) on delete set null;

create table if not exists technicians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  zone text,
  status text not null default 'available' check (status in ('available', 'on-site', 'off-duty')),
  created_at timestamptz not null default now()
);

create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid references consumers(id) on delete set null,
  period text not null,
  usage_kwh numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('paid', 'pending', 'overdue')),
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists service_records (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid references technicians(id) on delete set null,
  meter_id uuid references meters(id) on delete set null,
  summary text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'in-progress', 'complete')),
  scheduled_for timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists bills_period_idx on bills(period);
create index if not exists meters_consumer_idx on meters(consumer_id);
create index if not exists service_records_scheduled_idx on service_records(scheduled_for);

-- Enable RLS and add policies tailored to your deployment before connecting real accounts.

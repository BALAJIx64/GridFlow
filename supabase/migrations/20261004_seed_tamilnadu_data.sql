-- ==============================================================================
-- GridFlow: Tamil Nadu Utility Seed Migration
-- 25 Consumers, 25 Meters, Bills, 15 Technicians, Zones, Tariffs
-- Email convention: <consumer_name>@grid
-- ==============================================================================

-- PREREQUISITE: run supabase/migrations/20261004_v3_fix_permissions_and_seed.sql FIRST.
-- It creates the tables (zones, consumers, meters, ...). Error 42P01
-- 'relation public.zones does not exist' means that step was skipped.
create extension if not exists pgcrypto;

-- 1. Ensure Tamil Nadu Zones exist
insert into public.zones (id, name, description, is_active) values
  ('11111111-0000-4000-8000-000000000001', 'Chennai Central', 'Chennai Metro Distribution Circle (T. Nagar, Anna Nagar, Mylapore)', true),
  ('11111111-0000-4000-8000-000000000002', 'Coimbatore Urban', 'Western Circle (Gandhipuram, RS Puram, Peelamedu)', true),
  ('11111111-0000-4000-8000-000000000003', 'Madurai Metro', 'Southern Heritage Circle (KK Nagar, Simmakkal, Mattuthavani)', true),
  ('11111111-0000-4000-8000-000000000004', 'Tiruchirappalli Central', 'Delta Region Circle (Thillai Nagar, Cantonment, Srirangam)', true),
  ('11111111-0000-4000-8000-000000000005', 'Salem Metro', 'Steel City Circle (Fairlands, Hasthampatti, Alagapuram)', true)
on conflict (name) do update set is_active = true, updated_at = now();

-- 2. Ensure Tariffs exist
insert into public.tariffs (id, name, category, rate_per_kwh, fixed_charge, currency, is_active)
select v.id::uuid, v.name, v.category, v.rate_per_kwh, v.fixed_charge, v.currency, v.is_active
from (values
  ('22222222-0000-4000-8000-000000000001', 'Residential Standard (LT-1A)', 'residential', 5.5000, 100.00, 'INR', true),
  ('22222222-0000-4000-8000-000000000002', 'Business General (LT-2B)', 'business', 8.7500, 250.00, 'INR', true),
  ('22222222-0000-4000-8000-000000000003', 'Commercial High-Tension (LT-3B)', 'commercial', 11.5000, 500.00, 'INR', true)
) as v(id, name, category, rate_per_kwh, fixed_charge, currency, is_active)
where not exists (select 1 from public.tariffs t where t.category = v.category and t.is_active)
on conflict (name) do nothing;

-- 3. Insert 25 Tamil Nadu Consumers (<consumer_name>@grid)
insert into public.consumers (id, account_number, full_name, email, phone, address, zone, plan, status) values
  ('c0000001-0000-4000-8000-000000000001', 'GF-TN-1001', 'Karthikeyan Ramaswamy', 'karthikeyan.ramaswamy@grid', '+91 98401 23451', '14, Usman Road, T. Nagar, Chennai', 'Chennai Central', 'Residential', 'active'),
  ('c0000001-0000-4000-8000-000000000002', 'GF-TN-1002', 'Priya Natarajan', 'priya.natarajan@grid', '+91 94432 87652', '45, DB Road, RS Puram, Coimbatore', 'Coimbatore Urban', 'Residential', 'active'),
  ('c0000001-0000-4000-8000-000000000003', 'GF-TN-1003', 'Senthilkumar Balan', 'senthilkumar.balan@grid', '+91 98410 34563', '88, 80 Feet Road, KK Nagar, Madurai', 'Madurai Metro', 'Business', 'active'),
  ('c0000001-0000-4000-8000-000000000004', 'GF-TN-1004', 'Vijayalakshmi Subramanian', 'vijayalakshmi.subramanian@grid', '+91 97890 12344', '22, Shastri Road, Thillai Nagar, Trichy', 'Tiruchirappalli Central', 'Residential', 'active'),
  ('c0000001-0000-4000-8000-000000000005', 'GF-TN-1005', 'Anirudh Sundaram', 'anirudh.sundaram@grid', '+91 99402 76545', '71, Saradha College Road, Fairlands, Salem', 'Salem Metro', 'Commercial', 'active'),
  ('c0000001-0000-4000-8000-000000000006', 'GF-TN-1006', 'Kavitha Meenakshi', 'kavitha.meenakshi@grid', '+91 98421 87656', '5, 2nd Avenue, Anna Nagar, Chennai', 'Chennai Central', 'Residential', 'active'),
  ('c0000001-0000-4000-8000-000000000007', 'GF-TN-1007', 'Saravanan Murugesan', 'saravanan.murugesan@grid', '+91 94420 54327', '102, Cross Cut Road, Gandhipuram, Coimbatore', 'Coimbatore Urban', 'Business', 'active'),
  ('c0000001-0000-4000-8000-000000000008', 'GF-TN-1008', 'Divya Balakrishnan', 'divya.balakrishnan@grid', '+91 98940 32108', '33, West Tower Street, Simmakkal, Madurai', 'Madurai Metro', 'Residential', 'active'),
  ('c0000001-0000-4000-8000-000000000009', 'GF-TN-1009', 'Muthukumar Pandian', 'muthukumar.pandian@grid', '+91 97500 45679', '19, Salai Road, Woraiyur, Trichy', 'Tiruchirappalli Central', 'Commercial', 'active'),
  ('c0000001-0000-4000-8000-000000000010', 'GF-TN-1010', 'Aishwarya Rajendran', 'aishwarya.rajendran@grid', '+91 94435 98710', '40, Cherry Road, Hasthampatti, Salem', 'Salem Metro', 'Residential', 'active'),
  ('c0000001-0000-4000-8000-000000000011', 'GF-TN-1011', 'Vignesh Kumar', 'vignesh.kumar@grid', '+91 98403 65411', '12, Luz Church Road, Mylapore, Chennai', 'Chennai Central', 'Residential', 'active'),
  ('c0000001-0000-4000-8000-000000000012', 'GF-TN-1012', 'Deepa Shankaran', 'deepa.shankaran@grid', '+91 94421 12312', '56, Avinashi Road, Peelamedu, Coimbatore', 'Coimbatore Urban', 'Commercial', 'active'),
  ('c0000001-0000-4000-8000-000000000013', 'GF-TN-1013', 'Suresh Kannan', 'suresh.kannan@grid', '+91 98412 87613', '77, Vakkil New Street, Simmakkal, Madurai', 'Madurai Metro', 'Business', 'active'),
  ('c0000001-0000-4000-8000-000000000014', 'GF-TN-1014', 'Meenakshi Sundaram', 'meenakshi.sundaram@grid', '+91 97900 34514', '28, Reynolds Road, Cantonment, Trichy', 'Tiruchirappalli Central', 'Residential', 'active'),
  ('c0000001-0000-4000-8000-000000000015', 'GF-TN-1015', 'Jayanthi Krishnan', 'jayanthi.krishnan@grid', '+91 99420 78915', '18, Meyyanur Main Road, Salem', 'Salem Metro', 'Residential', 'active'),
  ('c0000001-0000-4000-8000-000000000016', 'GF-TN-1016', 'Gokulnath Raja', 'gokulnath.raja@grid', '+91 98408 43216', '9, LB Road, Adyar, Chennai', 'Chennai Central', 'Commercial', 'active'),
  ('c0000001-0000-4000-8000-000000000017', 'GF-TN-1017', 'Nithya Kalyani', 'nithya.kalyani@grid', '+91 94438 65417', '63, NSR Road, Saibaba Colony, Coimbatore', 'Coimbatore Urban', 'Residential', 'active'),
  ('c0000001-0000-4000-8000-000000000018', 'GF-TN-1018', 'Venkatesh Prabhu', 'venkatesh.prabhu@grid', '+91 98419 87618', '11, Lake View Road, Mattuthavani, Madurai', 'Madurai Metro', 'Residential', 'active'),
  ('c0000001-0000-4000-8000-000000000019', 'GF-TN-1019', 'Radhika Srinivasan', 'radhika.srinivasan@grid', '+91 97899 23419', '84, EVR Road, Puthur, Trichy', 'Tiruchirappalli Central', 'Business', 'active'),
  ('c0000001-0000-4000-8000-000000000020', 'GF-TN-1020', 'Manikandan Selvam', 'manikandan.selvam@grid', '+91 99405 67820', '31, Omalur Main Road, Alagapuram, Salem', 'Salem Metro', 'Commercial', 'active'),
  ('c0000001-0000-4000-8000-000000000021', 'GF-TN-1021', 'Abinaya Ramesh', 'abinaya.ramesh@grid', '+91 98406 54321', '4, 100 Feet Bypass Road, Velachery, Chennai', 'Chennai Central', 'Residential', 'active'),
  ('c0000001-0000-4000-8000-000000000022', 'GF-TN-1022', 'Prakash Soundararajan', 'prakash.soundararajan@grid', '+91 94429 87622', '90, Trichy Road, Singanallur, Coimbatore', 'Coimbatore Urban', 'Business', 'active'),
  ('c0000001-0000-4000-8000-000000000023', 'GF-TN-1023', 'Swetha Narayanan', 'swetha.narayanan@grid', '+91 98944 12323', '27, Melur Main Road, K.Pudur, Madurai', 'Madurai Metro', 'Residential', 'active'),
  ('c0000001-0000-4000-8000-000000000024', 'GF-TN-1024', 'Dinesh Chandrasekar', 'dinesh.chandrasekar@grid', '+91 97509 45624', '15, South Chitra Street, Srirangam, Trichy', 'Tiruchirappalli Central', 'Residential', 'active'),
  ('c0000001-0000-4000-8000-000000000025', 'GF-TN-1025', 'Revathi Govindaraj', 'revathi.govindaraj@grid', '+91 94430 98725', '52, Gugai Main Road, Salem', 'Salem Metro', 'Residential', 'inactive')
on conflict (account_number) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  phone = excluded.phone,
  address = excluded.address,
  zone = excluded.zone,
  plan = excluded.plan,
  status = excluded.status,
  updated_at = now();

-- 4. Insert 25 Connected Smart Meters for Consumers
insert into public.meters (id, serial_number, consumer_id, latest_reading, status, is_active) values
  ('e0000001-0000-4000-8000-000000000001', 'MT-TN-4001', 'c0000001-0000-4000-8000-000000000001', 345.500, 'online', true),
  ('e0000001-0000-4000-8000-000000000002', 'MT-TN-4002', 'c0000001-0000-4000-8000-000000000002', 412.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000003', 'MT-TN-4003', 'c0000001-0000-4000-8000-000000000003', 890.250, 'online', true),
  ('e0000001-0000-4000-8000-000000000004', 'MT-TN-4004', 'c0000001-0000-4000-8000-000000000004', 280.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000005', 'MT-TN-4005', 'c0000001-0000-4000-8000-000000000005', 1420.750, 'online', true),
  ('e0000001-0000-4000-8000-000000000006', 'MT-TN-4006', 'c0000001-0000-4000-8000-000000000006', 530.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000007', 'MT-TN-4007', 'c0000001-0000-4000-8000-000000000007', 760.500, 'online', true),
  ('e0000001-0000-4000-8000-000000000008', 'MT-TN-4008', 'c0000001-0000-4000-8000-000000000008', 315.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000009', 'MT-TN-4009', 'c0000001-0000-4000-8000-000000000009', 1150.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000010', 'MT-TN-4010', 'c0000001-0000-4000-8000-000000000010', 290.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000011', 'MT-TN-4011', 'c0000001-0000-4000-8000-000000000011', 460.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000012', 'MT-TN-4012', 'c0000001-0000-4000-8000-000000000012', 1380.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000013', 'MT-TN-4013', 'c0000001-0000-4000-8000-000000000013', 690.000, 'offline', true),
  ('e0000001-0000-4000-8000-000000000014', 'MT-TN-4014', 'c0000001-0000-4000-8000-000000000014', 310.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000015', 'MT-TN-4015', 'c0000001-0000-4000-8000-000000000015', 240.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000016', 'MT-TN-4016', 'c0000001-0000-4000-8000-000000000016', 1520.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000017', 'MT-TN-4017', 'c0000001-0000-4000-8000-000000000017', 375.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000018', 'MT-TN-4018', 'c0000001-0000-4000-8000-000000000018', 420.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000019', 'MT-TN-4019', 'c0000001-0000-4000-8000-000000000019', 810.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000020', 'MT-TN-4020', 'c0000001-0000-4000-8000-000000000020', 1650.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000021', 'MT-TN-4021', 'c0000001-0000-4000-8000-000000000021', 490.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000022', 'MT-TN-4022', 'c0000001-0000-4000-8000-000000000022', 920.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000023', 'MT-TN-4023', 'c0000001-0000-4000-8000-000000000023', 330.000, 'online', true),
  ('e0000001-0000-4000-8000-000000000024', 'MT-TN-4024', 'c0000001-0000-4000-8000-000000000024', 270.000, 'offline', true),
  ('e0000001-0000-4000-8000-000000000025', 'MT-TN-4025', 'c0000001-0000-4000-8000-000000000025', 180.000, 'online', false)
on conflict (serial_number) do update set
  consumer_id = excluded.consumer_id,
  latest_reading = excluded.latest_reading,
  status = excluded.status,
  is_active = excluded.is_active,
  updated_at = now();

-- 5. Insert 15 Tamil Nadu Field Technicians
insert into public.technicians (id, employee_number, full_name, email, phone, zone, status, is_active) values
  ('d0000001-0000-4000-8000-000000000001', 'EMP-TN-201', 'Murugan Palanisamy', 'murugan.palanisamy@grid.flow', '+91 94441 55601', 'Chennai Central', 'available', true),
  ('d0000001-0000-4000-8000-000000000002', 'EMP-TN-202', 'Vigneshwaran Arumugam', 'vignesh.arumugam@grid.flow', '+91 98402 77802', 'Chennai Central', 'on-site', true),
  ('d0000001-0000-4000-8000-000000000003', 'EMP-TN-203', 'Manikandan Velu', 'manikandan.velu@grid.flow', '+91 97893 11203', 'Chennai Central', 'available', true),
  ('d0000001-0000-4000-8000-000000000004', 'EMP-TN-204', 'Dinesh Selvaraj', 'dinesh.selvaraj@grid.flow', '+91 94424 44504', 'Coimbatore Urban', 'available', true),
  ('d0000001-0000-4000-8000-000000000005', 'EMP-TN-205', 'Rajkumar Karuppasamy', 'rajkumar.karuppasamy@grid.flow', '+91 98425 88905', 'Coimbatore Urban', 'on-site', true),
  ('d0000001-0000-4000-8000-000000000006', 'EMP-TN-206', 'Balasubramanian Thangaraj', 'balasubramanian.t@grid.flow', '+91 99436 22306', 'Coimbatore Urban', 'off-duty', true),
  ('d0000001-0000-4000-8000-000000000007', 'EMP-TN-207', 'Sridhar Govindasamy', 'sridhar.govindasamy@grid.flow', '+91 98417 66707', 'Madurai Metro', 'available', true),
  ('d0000001-0000-4000-8000-000000000008', 'EMP-TN-208', 'Aravindhan Kalimuthu', 'aravindhan.kalimuthu@grid.flow', '+91 98948 99108', 'Madurai Metro', 'on-site', true),
  ('d0000001-0000-4000-8000-000000000009', 'EMP-TN-209', 'Kalaiarasan Chinnasamy', 'kalaiarasan.c@grid.flow', '+91 97509 33409', 'Madurai Metro', 'available', true),
  ('d0000001-0000-4000-8000-000000000010', 'EMP-TN-210', 'Senthil Nathan', 'senthil.nathan@grid.flow', '+91 94430 77810', 'Tiruchirappalli Central', 'available', true),
  ('d0000001-0000-4000-8000-000000000011', 'EMP-TN-211', 'Mohanraj Veerappan', 'mohanraj.veerappan@grid.flow', '+91 97901 11211', 'Tiruchirappalli Central', 'on-site', true),
  ('d0000001-0000-4000-8000-000000000012', 'EMP-TN-212', 'Ilangovan Muthusamy', 'ilangovan.m@grid.flow', '+91 99402 55612', 'Tiruchirappalli Central', 'available', true),
  ('d0000001-0000-4000-8000-000000000013', 'EMP-TN-213', 'Thamizhchelvan Marimuthu', 'thamizhchelvan.m@grid.flow', '+91 98403 99013', 'Salem Metro', 'available', true),
  ('d0000001-0000-4000-8000-000000000014', 'EMP-TN-214', 'Sakthivel Periasamy', 'sakthivel.periasamy@grid.flow', '+91 94434 33414', 'Salem Metro', 'on-site', true),
  ('d0000001-0000-4000-8000-000000000015', 'EMP-TN-215', 'Sivakumar Natarajan', 'sivakumar.natarajan@grid.flow', '+91 98945 77815', 'Salem Metro', 'off-duty', true)
on conflict (employee_number) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  phone = excluded.phone,
  zone = excluded.zone,
  status = excluded.status,
  is_active = excluded.is_active,
  updated_at = now();

-- 6. Insert Bills for the Consumers
insert into public.bills (id, bill_number, consumer_id, period_start, period_end, due_date, usage_kwh, energy_charge, fixed_charge, total_amount, currency, status, paid_at) values
  ('b0000001-0000-4000-8000-000000000001', 'INV-202610-01', 'c0000001-0000-4000-8000-000000000001', '2026-09-01', '2026-09-30', '2026-10-14', 345.500, 1900.25, 100.00, 2000.25, 'INR', 'paid', '2026-10-02 11:30:00+00'),
  ('b0000001-0000-4000-8000-000000000002', 'INV-202610-02', 'c0000001-0000-4000-8000-000000000002', '2026-09-01', '2026-09-30', '2026-10-14', 412.000, 2266.00, 100.00, 2366.00, 'INR', 'paid', '2026-10-03 09:15:00+00'),
  ('b0000001-0000-4000-8000-000000000003', 'INV-202610-03', 'c0000001-0000-4000-8000-000000000003', '2026-09-01', '2026-09-30', '2026-10-14', 890.250, 7789.68, 250.00, 8039.68, 'INR', 'paid', '2026-10-04 14:00:00+00'),
  ('b0000001-0000-4000-8000-000000000004', 'INV-202610-04', 'c0000001-0000-4000-8000-000000000004', '2026-09-01', '2026-09-30', '2026-10-14', 280.000, 1540.00, 100.00, 1640.00, 'INR', 'pending', null),
  ('b0000001-0000-4000-8000-000000000005', 'INV-202610-05', 'c0000001-0000-4000-8000-000000000005', '2026-09-01', '2026-09-30', '2026-10-14', 1420.750, 16338.62, 500.00, 16838.62, 'INR', 'paid', '2026-10-01 16:45:00+00'),
  ('b0000001-0000-4000-8000-000000000006', 'INV-202610-06', 'c0000001-0000-4000-8000-000000000006', '2026-09-01', '2026-09-30', '2026-10-14', 530.000, 2915.00, 100.00, 3015.00, 'INR', 'pending', null),
  ('b0000001-0000-4000-8000-000000000007', 'INV-202610-07', 'c0000001-0000-4000-8000-000000000007', '2026-09-01', '2026-09-30', '2026-10-14', 760.500, 6654.37, 250.00, 6904.37, 'INR', 'paid', '2026-10-02 10:20:00+00'),
  ('b0000001-0000-4000-8000-000000000008', 'INV-202610-08', 'c0000001-0000-4000-8000-000000000008', '2026-09-01', '2026-09-30', '2026-10-14', 315.000, 1732.50, 100.00, 1832.50, 'INR', 'paid', '2026-10-03 13:10:00+00'),
  ('b0000001-0000-4000-8000-000000000009', 'INV-202610-09', 'c0000001-0000-4000-8000-000000000009', '2026-09-01', '2026-09-30', '2026-10-14', 1150.000, 13225.00, 500.00, 13725.00, 'INR', 'overdue', null),
  ('b0000001-0000-4000-8000-000000000010', 'INV-202610-10', 'c0000001-0000-4000-8000-000000000010', '2026-09-01', '2026-09-30', '2026-10-14', 290.000, 1595.00, 100.00, 1695.00, 'INR', 'paid', '2026-10-04 11:00:00+00'),
  ('b0000001-0000-4000-8000-000000000011', 'INV-202610-11', 'c0000001-0000-4000-8000-000000000011', '2026-09-01', '2026-09-30', '2026-10-14', 460.000, 2530.00, 100.00, 2630.00, 'INR', 'paid', '2026-10-02 18:00:00+00'),
  ('b0000001-0000-4000-8000-000000000012', 'INV-202610-12', 'c0000001-0000-4000-8000-000000000012', '2026-09-01', '2026-09-30', '2026-10-14', 1380.000, 15870.00, 500.00, 16370.00, 'INR', 'paid', '2026-10-01 12:00:00+00'),
  ('b0000001-0000-4000-8000-000000000013', 'INV-202610-13', 'c0000001-0000-4000-8000-000000000013', '2026-09-01', '2026-09-30', '2026-10-14', 690.000, 6037.50, 250.00, 6287.50, 'INR', 'pending', null),
  ('b0000001-0000-4000-8000-000000000014', 'INV-202610-14', 'c0000001-0000-4000-8000-000000000014', '2026-09-01', '2026-09-30', '2026-10-14', 310.000, 1705.00, 100.00, 1805.00, 'INR', 'paid', '2026-10-03 15:30:00+00'),
  ('b0000001-0000-4000-8000-000000000015', 'INV-202610-15', 'c0000001-0000-4000-8000-000000000015', '2026-09-01', '2026-09-30', '2026-10-14', 240.000, 1320.00, 100.00, 1420.00, 'INR', 'paid', '2026-10-04 08:30:00+00'),
  ('b0000001-0000-4000-8000-000000000016', 'INV-202610-16', 'c0000001-0000-4000-8000-000000000016', '2026-09-01', '2026-09-30', '2026-10-14', 1520.000, 17480.00, 500.00, 17980.00, 'INR', 'paid', '2026-10-01 14:20:00+00'),
  ('b0000001-0000-4000-8000-000000000017', 'INV-202610-17', 'c0000001-0000-4000-8000-000000000017', '2026-09-01', '2026-09-30', '2026-10-14', 375.000, 2062.50, 100.00, 2162.50, 'INR', 'paid', '2026-10-02 09:40:00+00'),
  ('b0000001-0000-4000-8000-000000000018', 'INV-202610-18', 'c0000001-0000-4000-8000-000000000018', '2026-09-01', '2026-09-30', '2026-10-14', 420.000, 2310.00, 100.00, 2410.00, 'INR', 'paid', '2026-10-03 17:05:00+00'),
  ('b0000001-0000-4000-8000-000000000019', 'INV-202610-19', 'c0000001-0000-4000-8000-000000000019', '2026-09-01', '2026-09-30', '2026-10-14', 810.000, 7087.50, 250.00, 7337.50, 'INR', 'paid', '2026-10-02 12:25:00+00'),
  ('b0000001-0000-4000-8000-000000000020', 'INV-202610-20', 'c0000001-0000-4000-8000-000000000020', '2026-09-01', '2026-09-30', '2026-10-14', 1650.000, 18975.00, 500.00, 19475.00, 'INR', 'paid', '2026-10-04 10:10:00+00'),
  ('b0000001-0000-4000-8000-000000000021', 'INV-202610-21', 'c0000001-0000-4000-8000-000000000021', '2026-09-01', '2026-09-30', '2026-10-14', 490.000, 2695.00, 100.00, 2795.00, 'INR', 'paid', '2026-10-01 19:30:00+00'),
  ('b0000001-0000-4000-8000-000000000022', 'INV-202610-22', 'c0000001-0000-4000-8000-000000000022', '2026-09-01', '2026-09-30', '2026-10-14', 920.000, 8050.00, 250.00, 8300.00, 'INR', 'paid', '2026-10-03 11:45:00+00'),
  ('b0000001-0000-4000-8000-000000000023', 'INV-202610-23', 'c0000001-0000-4000-8000-000000000023', '2026-09-01', '2026-09-30', '2026-10-14', 330.000, 1815.00, 100.00, 1915.00, 'INR', 'paid', '2026-10-02 15:00:00+00'),
  ('b0000001-0000-4000-8000-000000000024', 'INV-202610-24', 'c0000001-0000-4000-8000-000000000024', '2026-09-01', '2026-09-30', '2026-10-14', 270.000, 1485.00, 100.00, 1585.00, 'INR', 'pending', null),
  ('b0000001-0000-4000-8000-000000000025', 'INV-202610-25', 'c0000001-0000-4000-8000-000000000025', '2026-09-01', '2026-09-30', '2026-10-14', 180.000, 990.00, 100.00, 1090.00, 'INR', 'paid', '2026-10-01 10:00:00+00')
on conflict (bill_number) do update set
  total_amount = excluded.total_amount,
  status = excluded.status,
  paid_at = excluded.paid_at,
  updated_at = now();

-- 7. Insert Service Records for the Field Technicians
insert into public.service_records (summary, priority, status, scheduled_for, technician_id, consumer_id, meter_id) values
  ('Routine quarterly meter calibration and optical port testing', 'normal', 'complete', now() - interval '2 days', 'd0000001-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001', 'e0000001-0000-4000-8000-000000000001'),
  ('Signal drop investigation and antenna re-alignment', 'high', 'in-progress', now() + interval '1 day', 'd0000001-0000-4000-8000-000000000005', 'c0000001-0000-4000-8000-000000000007', 'e0000001-0000-4000-8000-000000000007'),
  ('Commercial three-phase smart meter inspection', 'normal', 'complete', now() - interval '4 days', 'd0000001-0000-4000-8000-000000000008', 'c0000001-0000-4000-8000-000000000005', 'e0000001-0000-4000-8000-000000000005'),
  ('Voltage surge protection and earth loop check', 'normal', 'scheduled', now() + interval '2 days', 'd0000001-0000-4000-8000-000000000011', 'c0000001-0000-4000-8000-000000000004', 'e0000001-0000-4000-8000-000000000004')
on conflict do nothing;

-- 8. Grant access to anon, authenticated, and service_role
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;


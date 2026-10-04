import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://strxgcwtmmbltybnlphh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Tbom6KHNDhIwtj62VVOLyA_gW5ceeoV';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ZONES = [
  { id: '11111111-0000-4000-8000-000000000001', name: 'Chennai Central', description: 'Chennai Metro Distribution Circle (T. Nagar, Anna Nagar, Mylapore)', is_active: true },
  { id: '11111111-0000-4000-8000-000000000002', name: 'Coimbatore Urban', description: 'Western Circle (Gandhipuram, RS Puram, Peelamedu)', is_active: true },
  { id: '11111111-0000-4000-8000-000000000003', name: 'Madurai Metro', description: 'Southern Heritage Circle (KK Nagar, Simmakkal, Mattuthavani)', is_active: true },
  { id: '11111111-0000-4000-8000-000000000004', name: 'Tiruchirappalli Central', description: 'Delta Region Circle (Thillai Nagar, Cantonment, Srirangam)', is_active: true },
  { id: '11111111-0000-4000-8000-000000000005', name: 'Salem Metro', description: 'Steel City Circle (Fairlands, Hasthampatti, Alagapuram)', is_active: true }
];

const TARIFFS = [
  { id: '22222222-0000-4000-8000-000000000001', name: 'Residential Standard (LT-1A)', category: 'residential', rate_per_kwh: 5.5, fixed_charge: 100, currency: 'INR', is_active: true },
  { id: '22222222-0000-4000-8000-000000000002', name: 'Business General (LT-2B)', category: 'business', rate_per_kwh: 8.75, fixed_charge: 250, currency: 'INR', is_active: true },
  { id: '22222222-0000-4000-8000-000000000003', name: 'Commercial High-Tension (LT-3B)', category: 'commercial', rate_per_kwh: 11.5, fixed_charge: 500, currency: 'INR', is_active: true }
];

const CONSUMERS = [
  { id: 'c0000001-0000-4000-8000-000000000001', account_number: 'GF-TN-1001', full_name: 'Karthikeyan Ramaswamy', email: 'karthikeyan.ramaswamy@grid', phone: '+91 98401 23451', address: '14, Usman Road, T. Nagar, Chennai', zone: 'Chennai Central', plan: 'Residential', status: 'active', usage: 345 },
  { id: 'c0000001-0000-4000-8000-000000000002', account_number: 'GF-TN-1002', full_name: 'Priya Natarajan', email: 'priya.natarajan@grid', phone: '+91 94432 87652', address: '45, DB Road, RS Puram, Coimbatore', zone: 'Coimbatore Urban', plan: 'Residential', status: 'active', usage: 412 },
  { id: 'c0000001-0000-4000-8000-000000000003', account_number: 'GF-TN-1003', full_name: 'Senthilkumar Balan', email: 'senthilkumar.balan@grid', phone: '+91 98410 34563', address: '88, 80 Feet Road, KK Nagar, Madurai', zone: 'Madurai Metro', plan: 'Business', status: 'active', usage: 890 },
  { id: 'c0000001-0000-4000-8000-000000000004', account_number: 'GF-TN-1004', full_name: 'Vijayalakshmi Subramanian', email: 'vijayalakshmi.subramanian@grid', phone: '+91 97890 12344', address: '22, Shastri Road, Thillai Nagar, Trichy', zone: 'Tiruchirappalli Central', plan: 'Residential', status: 'active', usage: 280 },
  { id: 'c0000001-0000-4000-8000-000000000005', account_number: 'GF-TN-1005', full_name: 'Anirudh Sundaram', email: 'anirudh.sundaram@grid', phone: '+91 99402 76545', address: '71, Saradha College Road, Fairlands, Salem', zone: 'Salem Metro', plan: 'Commercial', status: 'active', usage: 1420 },
  { id: 'c0000001-0000-4000-8000-000000000006', account_number: 'GF-TN-1006', full_name: 'Kavitha Meenakshi', email: 'kavitha.meenakshi@grid', phone: '+91 98421 87656', address: '5, 2nd Avenue, Anna Nagar, Chennai', zone: 'Chennai Central', plan: 'Residential', status: 'active', usage: 530 },
  { id: 'c0000001-0000-4000-8000-000000000007', account_number: 'GF-TN-1007', full_name: 'Saravanan Murugesan', email: 'saravanan.murugesan@grid', phone: '+91 94420 54327', address: '102, Cross Cut Road, Gandhipuram, Coimbatore', zone: 'Coimbatore Urban', plan: 'Business', status: 'active', usage: 760 },
  { id: 'c0000001-0000-4000-8000-000000000008', account_number: 'GF-TN-1008', full_name: 'Divya Balakrishnan', email: 'divya.balakrishnan@grid', phone: '+91 98940 32108', address: '33, West Tower Street, Simmakkal, Madurai', zone: 'Madurai Metro', plan: 'Residential', status: 'active', usage: 315 },
  { id: 'c0000001-0000-4000-8000-000000000009', account_number: 'GF-TN-1009', full_name: 'Muthukumar Pandian', email: 'muthukumar.pandian@grid', phone: '+91 97500 45679', address: '19, Salai Road, Woraiyur, Trichy', zone: 'Tiruchirappalli Central', plan: 'Commercial', status: 'active', usage: 1150 },
  { id: 'c0000001-0000-4000-8000-000000000010', account_number: 'GF-TN-1010', full_name: 'Aishwarya Rajendran', email: 'aishwarya.rajendran@grid', phone: '+91 94435 98710', address: '40, Cherry Road, Hasthampatti, Salem', zone: 'Salem Metro', plan: 'Residential', status: 'active', usage: 290 },
  { id: 'c0000001-0000-4000-8000-000000000011', account_number: 'GF-TN-1011', full_name: 'Vignesh Kumar', email: 'vignesh.kumar@grid', phone: '+91 98403 65411', address: '12, Luz Church Road, Mylapore, Chennai', zone: 'Chennai Central', plan: 'Residential', status: 'active', usage: 460 },
  { id: 'c0000001-0000-4000-8000-000000000012', account_number: 'GF-TN-1012', full_name: 'Deepa Shankaran', email: 'deepa.shankaran@grid', phone: '+91 94421 12312', address: '56, Avinashi Road, Peelamedu, Coimbatore', zone: 'Coimbatore Urban', plan: 'Commercial', status: 'active', usage: 1380 },
  { id: 'c0000001-0000-4000-8000-000000000013', account_number: 'GF-TN-1013', full_name: 'Suresh Kannan', email: 'suresh.kannan@grid', phone: '+91 98412 87613', address: '77, Vakkil New Street, Simmakkal, Madurai', zone: 'Madurai Metro', plan: 'Business', status: 'active', usage: 690 },
  { id: 'c0000001-0000-4000-8000-000000000014', account_number: 'GF-TN-1014', full_name: 'Meenakshi Sundaram', email: 'meenakshi.sundaram@grid', phone: '+91 97900 34514', address: '28, Reynolds Road, Cantonment, Trichy', zone: 'Tiruchirappalli Central', plan: 'Residential', status: 'active', usage: 310 },
  { id: 'c0000001-0000-4000-8000-000000000015', account_number: 'GF-TN-1015', full_name: 'Jayanthi Krishnan', email: 'jayanthi.krishnan@grid', phone: '+91 99420 78915', address: '18, Meyyanur Main Road, Salem', zone: 'Salem Metro', plan: 'Residential', status: 'active', usage: 240 },
  { id: 'c0000001-0000-4000-8000-000000000016', account_number: 'GF-TN-1016', full_name: 'Gokulnath Raja', email: 'gokulnath.raja@grid', phone: '+91 98408 43216', address: '9, LB Road, Adyar, Chennai', zone: 'Chennai Central', plan: 'Commercial', status: 'active', usage: 1520 },
  { id: 'c0000001-0000-4000-8000-000000000017', account_number: 'GF-TN-1017', full_name: 'Nithya Kalyani', email: 'nithya.kalyani@grid', phone: '+91 94438 65417', address: '63, NSR Road, Saibaba Colony, Coimbatore', zone: 'Coimbatore Urban', plan: 'Residential', status: 'active', usage: 375 },
  { id: 'c0000001-0000-4000-8000-000000000018', account_number: 'GF-TN-1018', full_name: 'Venkatesh Prabhu', email: 'venkatesh.prabhu@grid', phone: '+91 98419 87618', address: '11, Lake View Road, Mattuthavani, Madurai', zone: 'Madurai Metro', plan: 'Residential', status: 'active', usage: 420 },
  { id: 'c0000001-0000-4000-8000-000000000019', account_number: 'GF-TN-1019', full_name: 'Radhika Srinivasan', email: 'radhika.srinivasan@grid', phone: '+91 97899 23419', address: '84, EVR Road, Puthur, Trichy', zone: 'Tiruchirappalli Central', plan: 'Business', status: 'active', usage: 810 },
  { id: 'c0000001-0000-4000-8000-000000000020', account_number: 'GF-TN-1020', full_name: 'Manikandan Selvam', email: 'manikandan.selvam@grid', phone: '+91 99405 67820', address: '31, Omalur Main Road, Alagapuram, Salem', zone: 'Salem Metro', plan: 'Commercial', status: 'active', usage: 1650 },
  { id: 'c0000001-0000-4000-8000-000000000021', account_number: 'GF-TN-1021', full_name: 'Abinaya Ramesh', email: 'abinaya.ramesh@grid', phone: '+91 98406 54321', address: '4, 100 Feet Bypass Road, Velachery, Chennai', zone: 'Chennai Central', plan: 'Residential', status: 'active', usage: 490 },
  { id: 'c0000001-0000-4000-8000-000000000022', account_number: 'GF-TN-1022', full_name: 'Prakash Soundararajan', email: 'prakash.soundararajan@grid', phone: '+91 94429 87622', address: '90, Trichy Road, Singanallur, Coimbatore', zone: 'Coimbatore Urban', plan: 'Business', status: 'active', usage: 920 },
  { id: 'c0000001-0000-4000-8000-000000000023', account_number: 'GF-TN-1023', full_name: 'Swetha Narayanan', email: 'swetha.narayanan@grid', phone: '+91 98944 12323', address: '27, Melur Main Road, K.Pudur, Madurai', zone: 'Madurai Metro', plan: 'Residential', status: 'active', usage: 330 },
  { id: 'c0000001-0000-4000-8000-000000000024', account_number: 'GF-TN-1024', full_name: 'Dinesh Chandrasekar', email: 'dinesh.chandrasekar@grid', phone: '+91 97509 45624', address: '15, South Chitra Street, Srirangam, Trichy', zone: 'Tiruchirappalli Central', plan: 'Residential', status: 'active', usage: 270 },
  { id: 'c0000001-0000-4000-8000-000000000025', account_number: 'GF-TN-1025', full_name: 'Revathi Govindaraj', email: 'revathi.govindaraj@grid', phone: '+91 94430 98725', address: '52, Gugai Main Road, Salem', zone: 'Salem Metro', plan: 'Residential', status: 'inactive', usage: 180 }
];

const METERS = CONSUMERS.map((c, idx) => ({
  id: `e0000001-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`,
  serial_number: `MT-TN-${4001 + idx}`,
  consumer_id: c.id,
  latest_reading: c.usage,
  status: idx === 12 || idx === 23 ? 'offline' : 'online',
  is_active: idx !== 24
}));

const TECHNICIANS = [
  { id: 'd0000001-0000-4000-8000-000000000001', employee_number: 'EMP-TN-201', full_name: 'Murugan Palanisamy', email: 'murugan.palanisamy@grid.flow', phone: '+91 94441 55601', zone: 'Chennai Central', status: 'available', is_active: true },
  { id: 'd0000001-0000-4000-8000-000000000002', employee_number: 'EMP-TN-202', full_name: 'Vigneshwaran Arumugam', email: 'vignesh.arumugam@grid.flow', phone: '+91 98402 77802', zone: 'Chennai Central', status: 'on-site', is_active: true },
  { id: 'd0000001-0000-4000-8000-000000000003', employee_number: 'EMP-TN-203', full_name: 'Manikandan Velu', email: 'manikandan.velu@grid.flow', phone: '+91 97893 11203', zone: 'Chennai Central', status: 'available', is_active: true },
  { id: 'd0000001-0000-4000-8000-000000000004', employee_number: 'EMP-TN-204', full_name: 'Dinesh Selvaraj', email: 'dinesh.selvaraj@grid.flow', phone: '+91 94424 44504', zone: 'Coimbatore Urban', status: 'available', is_active: true },
  { id: 'd0000001-0000-4000-8000-000000000005', employee_number: 'EMP-TN-205', full_name: 'Rajkumar Karuppasamy', email: 'rajkumar.karuppasamy@grid.flow', phone: '+91 98425 88905', zone: 'Coimbatore Urban', status: 'on-site', is_active: true },
  { id: 'd0000001-0000-4000-8000-000000000006', employee_number: 'EMP-TN-206', full_name: 'Balasubramanian Thangaraj', email: 'balasubramanian.t@grid.flow', phone: '+91 99436 22306', zone: 'Coimbatore Urban', status: 'off-duty', is_active: true },
  { id: 'd0000001-0000-4000-8000-000000000007', employee_number: 'EMP-TN-207', full_name: 'Sridhar Govindasamy', email: 'sridhar.govindasamy@grid.flow', phone: '+91 98417 66707', zone: 'Madurai Metro', status: 'available', is_active: true },
  { id: 'd0000001-0000-4000-8000-000000000008', employee_number: 'EMP-TN-208', full_name: 'Aravindhan Kalimuthu', email: 'aravindhan.kalimuthu@grid.flow', phone: '+91 98948 99108', zone: 'Madurai Metro', status: 'on-site', is_active: true },
  { id: 'd0000001-0000-4000-8000-000000000009', employee_number: 'EMP-TN-209', full_name: 'Kalaiarasan Chinnasamy', email: 'kalaiarasan.c@grid.flow', phone: '+91 97509 33409', zone: 'Madurai Metro', status: 'available', is_active: true },
  { id: 'd0000001-0000-4000-8000-000000000010', employee_number: 'EMP-TN-210', full_name: 'Senthil Nathan', email: 'senthil.nathan@grid.flow', phone: '+91 94430 77810', zone: 'Tiruchirappalli Central', status: 'available', is_active: true },
  { id: 'd0000001-0000-4000-8000-000000000011', employee_number: 'EMP-TN-211', full_name: 'Mohanraj Veerappan', email: 'mohanraj.veerappan@grid.flow', phone: '+91 97901 11211', zone: 'Tiruchirappalli Central', status: 'on-site', is_active: true },
  { id: 'd0000001-0000-4000-8000-000000000012', employee_number: 'EMP-TN-212', full_name: 'Ilangovan Muthusamy', email: 'ilangovan.m@grid.flow', phone: '+91 99402 55612', zone: 'Tiruchirappalli Central', status: 'available', is_active: true },
  { id: 'd0000001-0000-4000-8000-000000000013', employee_number: 'EMP-TN-213', full_name: 'Thamizhchelvan Marimuthu', email: 'thamizhchelvan.m@grid.flow', phone: '+91 98403 99013', zone: 'Salem Metro', status: 'available', is_active: true },
  { id: 'd0000001-0000-4000-8000-000000000014', employee_number: 'EMP-TN-214', full_name: 'Sakthivel Periasamy', email: 'sakthivel.periasamy@grid.flow', phone: '+91 94434 33414', zone: 'Salem Metro', status: 'on-site', is_active: true },
  { id: 'd0000001-0000-4000-8000-000000000015', employee_number: 'EMP-TN-215', full_name: 'Sivakumar Natarajan', email: 'sivakumar.natarajan@grid.flow', phone: '+91 98945 77815', zone: 'Salem Metro', status: 'off-duty', is_active: true }
];

const BILLS = CONSUMERS.map((c, idx) => {
  const isRes = c.plan === 'Residential';
  const isBus = c.plan === 'Business';
  const rate = isRes ? 5.5 : isBus ? 8.75 : 11.5;
  const fixed = isRes ? 100 : isBus ? 250 : 500;
  const amount = Math.round(c.usage * rate + fixed);
  const status = idx === 3 || idx === 5 || idx === 12 ? 'pending' : idx === 8 ? 'overdue' : 'paid';
  return {
    id: `b0000001-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`,
    bill_number: `INV-202610-${String(idx + 1).padStart(2, '0')}`,
    consumer_id: c.id,
    period_start: '2026-09-01',
    period_end: '2026-09-30',
    due_date: '2026-10-14',
    usage_kwh: c.usage,
    energy_charge: Math.round(c.usage * rate),
    fixed_charge: fixed,
    total_amount: amount,
    currency: 'INR',
    status,
    paid_at: status === 'paid' ? '2026-10-02T10:00:00Z' : null
  };
});

async function seed() {
  console.log('Seeding Tamil Nadu data directly to Supabase...');
  try {
    // 1. Zones
    const { error: zErr } = await supabase.from('zones').upsert(ZONES, { onConflict: 'name' });
    console.log('Zones upsert:', zErr ? zErr.message : 'OK (5 zones)');

    // 2. Tariffs
    const { error: tErr } = await supabase.from('tariffs').upsert(TARIFFS, { onConflict: 'name' });
    console.log('Tariffs upsert:', tErr ? tErr.message : 'OK (3 tariffs)');

    // 3. Consumers (only existing table columns)
    const consumersPayload = CONSUMERS.map(c => ({
      id: c.id,
      account_number: c.account_number,
      full_name: c.full_name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      zone: c.zone,
      plan: c.plan,
      status: c.status
    }));
    const { error: cErr } = await supabase.from('consumers').upsert(consumersPayload, { onConflict: 'account_number' });
    console.log('Consumers upsert:', cErr ? cErr.message : 'OK (25 consumers)');

    // 4. Meters
    const { error: mErr } = await supabase.from('meters').upsert(METERS, { onConflict: 'serial_number' });
    console.log('Meters upsert:', mErr ? mErr.message : 'OK (25 meters)');

    // 5. Technicians
    const { error: techErr } = await supabase.from('technicians').upsert(TECHNICIANS, { onConflict: 'employee_number' });
    console.log('Technicians upsert:', techErr ? techErr.message : 'OK (15 technicians)');

    // 6. Bills
    const { error: bErr } = await supabase.from('bills').upsert(BILLS, { onConflict: 'bill_number' });
    console.log('Bills upsert:', bErr ? bErr.message : 'OK (25 bills)');

    // 7. Save browser cache JSON for instant offline & local hydration
    const cacheData = {
      consumers: CONSUMERS.map(c => ({
        id: c.id,
        name: c.full_name,
        account: c.account_number,
        address: c.address,
        zone: c.zone,
        plan: c.plan,
        usage: c.usage,
        status: c.status === 'active' ? 'Active' : 'Inactive',
        email: c.email,
        phone: c.phone
      })),
      meters: METERS.map((m, idx) => ({
        id: m.id,
        serial: m.serial_number,
        consumer: CONSUMERS[idx].full_name,
        consumerId: m.consumer_id,
        zone: CONSUMERS[idx].zone,
        reading: m.latest_reading,
        status: m.status === 'online' ? 'Online' : 'Offline',
        signal: 95
      })),
      bills: BILLS.map((b, idx) => ({
        id: b.bill_number,
        dbId: b.id,
        consumer: CONSUMERS[idx].full_name,
        account: CONSUMERS[idx].account_number,
        period: 'September 2026',
        due: '14 Oct 2026',
        amount: b.total_amount,
        usage: b.usage_kwh,
        status: b.status === 'paid' ? 'Paid' : b.status === 'pending' ? 'Pending' : 'Overdue'
      })),
      technicians: TECHNICIANS.map(t => ({
        id: t.id,
        name: t.full_name,
        initials: t.full_name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase(),
        zone: t.zone,
        jobs: t.status === 'on-site' ? 2 : t.status === 'available' ? 1 : 0,
        status: t.status === 'available' ? 'Available' : t.status === 'on-site' ? 'On site' : 'Off duty'
      })),
      zones: ZONES,
      tariffs: TARIFFS,
      serviceRecords: [
        { id: 'sr-001', summary: 'Quarterly smart meter calibration and optical check', technician: 'Murugan Palanisamy', consumer: 'Karthikeyan Ramaswamy', meter: 'MT-TN-4001', status: 'Complete', scheduledAt: '02 Oct 2026' },
        { id: 'sr-002', summary: 'Signal drop investigation and antenna re-alignment', technician: 'Rajkumar Karuppasamy', consumer: 'Saravanan Murugesan', meter: 'MT-TN-4007', status: 'In progress', scheduledAt: '05 Oct 2026' },
        { id: 'sr-003', summary: 'Commercial 3-phase inspection and CT verification', technician: 'Aravindhan Kalimuthu', consumer: 'Anirudh Sundaram', meter: 'MT-TN-4005', status: 'Complete', scheduledAt: '30 Sep 2026' }
      ]
    };

    const outPath = path.join(__dirname, 'seed-data.json');
    fs.writeFileSync(outPath, JSON.stringify(cacheData, null, 2));
    console.log('Saved seed-data.json successfully to:', outPath);

  } catch (err) {
    console.error('Seed exception:', err);
  }
}

seed();

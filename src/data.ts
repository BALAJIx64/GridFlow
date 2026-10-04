export type Consumer = { id: string; name: string; account: string; address: string; zone: string; plan: string; usage: number; status: 'Active' | 'Pending' | 'Suspended' }
export type Meter = { id: string; serial: string; consumer: string; zone: string; reading: number; status: 'Online' | 'Offline' | 'Installing'; signal: number }
export type Bill = { id: string; consumer: string; account: string; period: string; due: string; amount: number; usage: number; status: 'Paid' | 'Pending' | 'Overdue' }
export type Technician = { id: string; name: string; initials: string; zone: string; jobs: number; status: 'Available' | 'On site' | 'Off duty' }

export const seedConsumers: Consumer[] = [
  { id:'c-1', name:'Maya Patel', account:'GF-2048', address:'14 Cedar Grove, North End', zone:'North End', plan:'Residential', usage:384, status:'Active' },
  { id:'c-2', name:'Oliver Chen', account:'GF-2047', address:'86 Meridian Road, Riverside', zone:'Riverside', plan:'Residential', usage:246, status:'Active' },
  { id:'c-3', name:'Amina Hassan', account:'GF-2046', address:'203 Linden Avenue, Midtown', zone:'Midtown', plan:'Business', usage:1240, status:'Pending' },
  { id:'c-4', name:'Ethan Williams', account:'GF-2045', address:'7 Willow Park, North End', zone:'North End', plan:'Residential', usage:318, status:'Active' },
  { id:'c-5', name:'Sofia Garcia', account:'GF-2044', address:'52 Harbor Street, Riverside', zone:'Riverside', plan:'Commercial', usage:2180, status:'Active' },
  { id:'c-6', name:'Noah Thompson', account:'GF-2043', address:'19 Summit Lane, Eastside', zone:'Eastside', plan:'Residential', usage:195, status:'Suspended' },
  { id:'c-7', name:'Priya Kumar', account:'GF-2042', address:'310 Parkview Drive, Midtown', zone:'Midtown', plan:'Residential', usage:426, status:'Active' },
  { id:'c-8', name:'Luca Moretti', account:'GF-2041', address:'5 Foundry Square, Eastside', zone:'Eastside', plan:'Business', usage:864, status:'Active' },
]
export const seedMeters: Meter[] = [
  { id:'MT-88421',serial:'MT-88421',consumer:'Maya Patel',zone:'North End',reading:1284,status:'Online',signal:96 },
  { id:'MT-88420',serial:'MT-88420',consumer:'Oliver Chen',zone:'Riverside',reading:962,status:'Online',signal:88 },
  { id:'MT-88419',serial:'MT-88419',consumer:'Amina Hassan',zone:'Midtown',reading:5421,status:'Offline',signal:0 },
  { id:'MT-88418',serial:'MT-88418',consumer:'Ethan Williams',zone:'North End',reading:1108,status:'Online',signal:93 },
  { id:'MT-88417',serial:'MT-88417',consumer:'Sofia Garcia',zone:'Riverside',reading:8650,status:'Online',signal:78 },
  { id:'MT-88416',serial:'MT-88416',consumer:'Noah Thompson',zone:'Eastside',reading:428,status:'Installing',signal:0 },
]
export const seedBills: Bill[] = [
  { id:'INV-2026-041',consumer:'Maya Patel',account:'GF-2048',period:'September 2026',due:'Oct 14, 2026',amount:86.40,usage:384,status:'Paid' },
  { id:'INV-2026-040',consumer:'Oliver Chen',account:'GF-2047',period:'September 2026',due:'Oct 14, 2026',amount:58.20,usage:246,status:'Pending' },
  { id:'INV-2026-039',consumer:'Amina Hassan',account:'GF-2046',period:'September 2026',due:'Oct 12, 2026',amount:310.00,usage:1240,status:'Overdue' },
  { id:'INV-2026-038',consumer:'Ethan Williams',account:'GF-2045',period:'September 2026',due:'Oct 14, 2026',amount:72.10,usage:318,status:'Paid' },
  { id:'INV-2026-037',consumer:'Sofia Garcia',account:'GF-2044',period:'September 2026',due:'Oct 15, 2026',amount:542.50,usage:2180,status:'Pending' },
  { id:'INV-2026-036',consumer:'Priya Kumar',account:'GF-2042',period:'September 2026',due:'Oct 13, 2026',amount:96.70,usage:426,status:'Paid' },
]
export const seedTechnicians: Technician[] = [
  {id:'t-1',name:'James Cooper',initials:'JC',zone:'North End',jobs:4,status:'Available'},
  {id:'t-2',name:'Fatima Ali',initials:'FA',zone:'Riverside',jobs:2,status:'On site'},
  {id:'t-3',name:'Daniel Kim',initials:'DK',zone:'Midtown',jobs:3,status:'Available'},
  {id:'t-4',name:'Elena Rossi',initials:'ER',zone:'Eastside',jobs:1,status:'Off duty'},
]
export const consumptionData = [
  { month:'Jan', usage:18.4, last:16.2 }, { month:'Feb', usage:16.8, last:15.4 }, { month:'Mar', usage:21.3, last:19.2 }, { month:'Apr', usage:19.7, last:18.8 }, { month:'May', usage:24.6, last:21.1 }, { month:'Jun', usage:22.4, last:20.7 }, { month:'Jul', usage:27.8, last:24.8 }, { month:'Aug', usage:25.2, last:23.4 }, { month:'Sep', usage:30.1, last:26.2 }, { month:'Oct', usage:27.4, last:25.6 }, { month:'Nov', usage:32.8, last:28.1 }, { month:'Dec', usage:29.6, last:26.8 },
]
export const collectionData = [
  {month:'Apr',paid:86,pending:14},{month:'May',paid:91,pending:9},{month:'Jun',paid:83,pending:17},{month:'Jul',paid:95,pending:5},{month:'Aug',paid:89,pending:11},{month:'Sep',paid:98,pending:2},
]
export const activities = [
  {icon:'check',title:'Payment received',detail:'Maya Patel · INV-2026-041',time:'2 min ago',tone:'green'},
  {icon:'meter',title:'Meter reading synced',detail:'MT-88421 · North End',time:'8 min ago',tone:'blue'},
  {icon:'user',title:'New consumer registered',detail:'Amina Hassan · Midtown',time:'24 min ago',tone:'violet'},
  {icon:'alert',title:'Payment reminder sent',detail:'Oliver Chen · INV-2026-040',time:'1 hr ago',tone:'amber'},
]

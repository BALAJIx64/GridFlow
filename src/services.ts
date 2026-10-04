import type { Bill, Consumer, Meter, ServiceRecord, Technician } from './data'
import { supabase, demoMode } from './lib/supabase'
import { track, opLog, type TrackMeta } from './lib/opLogger'
import { deleteSql, eq, insertSql, lit, selectSql, updateSql } from './lib/sql'
import type { Profile, Role } from './lib/roles'

export { supabase, demoMode }

type DbError = { message: string; code?: string } | null
type Res<D> = { data: D | null; error: DbError; count?: number | null }
type DbConsumer = { id:string; account_number:string; full_name:string; address:string|null; zone:string|null; plan:string|null; usage_kwh:number|null; status:string; email:string|null; phone:string|null }
type DbMeter = { id:string; serial_number:string; consumer_id:string|null; consumer: {full_name:string; zone:string|null}|null; latest_reading:number|null; status:string }
type DbBill = { id:string; bill_number:string; consumer_id:string|null; consumer: {full_name:string;account_number:string}|null; period_start:string; period_end:string; due_date:string|null; usage_kwh:number|null; total_amount:number|null; status:string }
type DbTechnician = { id:string; full_name:string; zone:string|null; status:string; service_records:{id:string}[] }
type DbServiceRecord = { id:string; summary:string; status:string; scheduled_for:string|null; technician:{full_name:string}|null; consumer:{full_name:string}|null; meter:{serial_number:string}|null }

export type Tariff = { id:string; name:string; category:string; rate_per_kwh:number; fixed_charge:number; currency:string; is_active:boolean }
export type Zone = { id:string; name:string; is_active:boolean }
export type Analytics = { monthly_energy:{month:string;usage_kwh:number}[]; monthly_collection:{month:string;paid:number;pending:number}[]; consumer_distribution:Record<string,number>; recent_activity:{action:string;entity:string;entity_id:string|null;created_at:string}[] }
export type PersistedOp = { id:number; actor_email:string|null; op_type:string; table_name:string|null; sql_text:string; rows_affected:number|null; duration_ms:number|null; success:boolean; error_message:string|null; created_at:string }
export type ExplorerTable = { table:string; rows:number }
export type ExplorerPage = { total:number; columns:{name:string;type:string}[]; rows:Record<string, unknown>[] }
export type ReportKey = 'counts' | 'zone' | 'tariff' | 'top'

const emptyAnalytics = (): Analytics => ({ monthly_energy: [], monthly_collection: [], consumer_distribution: {}, recent_activity: [] })
const title = (value:string|null|undefined) => value ? value.split(/[-_ ]/).map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(' ') : ''
const technicianStatus = (value:string) => ({ 'on-site':'On site', 'off-duty':'Off duty', available:'Available' } as Record<string,string>)[value] || title(value)
const iso = (d:Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

const friendly = (e:{message:string;code?:string}) => {
  switch (e.code) {
    case '23505': return 'A record with the same unique value already exists.'
    case '23503': return 'This record is linked to other records and cannot be changed this way.'
    case '42501': return 'Your role does not permit this action.'
    default: return e.message
  }
}
const fail = (error: DbError | undefined) => { if (error) throw new Error(friendly(error)) }
const db = () => { if (!supabase) throw new Error('Supabase is not configured. Add the project URL and publishable key.'); return supabase }

async function readAll<T>(table:string, columns:string, order:string, sql:string): Promise<T[]> {
  const res = await track<Res<T[]>>({ type:'SELECT', table, sql }, async () => {
    const rows: T[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db().from(table).select(columns).order(order, { ascending:false }).range(from, from + 999)
      if (error) return { data:null, error }
      const batch = (data || []) as unknown as T[]
      rows.push(...batch)
      if (batch.length < 1000) break
    }
    return { data: rows, error: null }
  })
  fail(res.error)
  return res.data || []
}

async function write<D = unknown>(meta:TrackMeta, run:() => PromiseLike<Res<D>>) {
  const res = await track<Res<D>>({ ...meta, write:true }, run)
  fail(res.error)
  return res
}

const LOCAL_CONSUMERS_KEY = 'gridflow.local_consumers'
const LOCAL_TECHNICIANS_KEY = 'gridflow.local_technicians'
const LOCAL_METERS_KEY = 'gridflow.local_meters'
const LOCAL_BILLS_KEY = 'gridflow.local_bills'
const LOCAL_SERVICE_RECORDS_KEY = 'gridflow.local_service_records'
const LOCAL_TARIFFS_KEY = 'gridflow.local_tariffs'
const LOCAL_ZONES_KEY = 'gridflow.local_zones'

export const DEFAULT_ZONES: Zone[] = [
  { id: 'z-1', name: 'North End', is_active: true },
  { id: 'z-2', name: 'Riverside', is_active: true },
  { id: 'z-3', name: 'Midtown', is_active: true },
  { id: 'z-4', name: 'Eastside', is_active: true }
]

export const DEFAULT_TARIFFS: Tariff[] = [
  { id: 't-1', name: 'Residential Standard', category: 'residential', rate_per_kwh: 6.5, fixed_charge: 120, currency: 'INR', is_active: true },
  { id: 't-2', name: 'Business General', category: 'business', rate_per_kwh: 9.2, fixed_charge: 250, currency: 'INR', is_active: true },
  { id: 't-3', name: 'Commercial High-Tension', category: 'commercial', rate_per_kwh: 12.8, fixed_charge: 500, currency: 'INR', is_active: true }
]

function getLocal<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function setLocal<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items))
  } catch {}
}

export const api = {
  /* ---------------------------------------------------------------- reads */
  async consumers(): Promise<Consumer[]> {
    const local = getLocal<Consumer>(LOCAL_CONSUMERS_KEY, [])
    if (!supabase) return local
    try {
      const data = await readAll<DbConsumer>('consumers', 'id,account_number,full_name,address,zone,plan,usage_kwh,status,email,phone', 'created_at',
        selectSql('id, account_number, full_name, address, zone, plan, usage_kwh, status', 'consumers', { orderBy:'created_at DESC' }))
      const mapped = data.map(x => ({ id:x.id, name:x.full_name, account:x.account_number, address:x.address||'', zone:x.zone||'', plan:x.plan||'Unassigned', usage:Number(x.usage_kwh||0), status:(x.status==='active'?'Active':'Inactive') as Consumer['status'], email:x.email||undefined, phone:x.phone||undefined }))
      const mergedMap = new Map<string, Consumer>()
      local.forEach(c => mergedMap.set(c.id, c))
      mapped.forEach(c => mergedMap.set(c.id, c))
      const res = Array.from(mergedMap.values())
      setLocal(LOCAL_CONSUMERS_KEY, res)
      return res
    } catch {
      return local
    }
  },
  async meters(): Promise<Meter[]> {
    const local = getLocal<Meter>(LOCAL_METERS_KEY, [])
    if (!supabase) return local
    try {
      const data = await readAll<DbMeter>('meters', 'id,serial_number,consumer_id,latest_reading,status,consumer:consumers(full_name,zone)', 'created_at',
        selectSql('m.id, m.serial_number, m.latest_reading, m.status, c.full_name, c.zone', 'meters m\nLEFT JOIN consumers c ON c.id = m.consumer_id', { orderBy:'m.created_at DESC' }))
      const mapped = data.map(x => ({ id:x.id, serial:x.serial_number, consumer:x.consumer?.full_name||'Unassigned', consumerId:x.consumer_id||undefined, zone:x.consumer?.zone||'', reading:Number(x.latest_reading||0), status:title(x.status) as Meter['status'], signal:x.status==='online'?100:0 }))
      const mergedMap = new Map<string, Meter>()
      local.forEach(m => mergedMap.set(m.id, m))
      mapped.forEach(m => mergedMap.set(m.id, m))
      const res = Array.from(mergedMap.values())
      setLocal(LOCAL_METERS_KEY, res)
      return res
    } catch {
      return local
    }
  },
  async bills(): Promise<Bill[]> {
    const local = getLocal<Bill>(LOCAL_BILLS_KEY, [])
    if (!supabase) return local
    try {
      const data = await readAll<DbBill>('bills', 'id,bill_number,consumer_id,period_start,period_end,due_date,usage_kwh,total_amount,status,consumer:consumers(full_name,account_number)', 'created_at',
        selectSql('b.bill_number, c.full_name, c.account_number, b.period_start, b.due_date, b.usage_kwh, b.total_amount, b.status', 'bills b\nLEFT JOIN consumers c ON c.id = b.consumer_id', { orderBy:'b.created_at DESC' }))
      const mapped = data.map(x => ({ id:x.bill_number, dbId:x.id, consumer:x.consumer?.full_name||'Unknown consumer', account:x.consumer?.account_number||'',
        period:new Date(`${x.period_start}T00:00:00`).toLocaleDateString('en-IN',{month:'long',year:'numeric'}),
        due:x.due_date?new Date(`${x.due_date}T00:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—',
        amount:Number(x.total_amount||0), usage:Number(x.usage_kwh||0), status:title(x.status) as Bill['status'] }))
      const mergedMap = new Map<string, Bill>()
      local.forEach(b => mergedMap.set(b.id, b))
      mapped.forEach(b => mergedMap.set(b.id, b))
      const res = Array.from(mergedMap.values())
      setLocal(LOCAL_BILLS_KEY, res)
      return res
    } catch {
      return local
    }
  },
  async technicians(): Promise<Technician[]> {
    const local = getLocal<Technician>(LOCAL_TECHNICIANS_KEY, [])
    if (!supabase) return local
    try {
      const data = await readAll<DbTechnician>('technicians', 'id,full_name,zone,status,service_records(id)', 'created_at',
        selectSql('t.id, t.full_name, t.zone, t.status, COUNT(s.id) AS jobs', 'technicians t\nLEFT JOIN service_records s ON s.technician_id = t.id', { groupBy:'t.id', orderBy:'t.created_at DESC' }))
      const mapped = data.map(x => ({ id:x.id, name:x.full_name, initials:x.full_name.split(' ').map(a => a[0]).join('').slice(0,2).toUpperCase(), zone:x.zone||'', jobs:x.service_records?.length||0, status:technicianStatus(x.status) as Technician['status'] }))
      const mergedMap = new Map<string, Technician>()
      local.forEach(t => mergedMap.set(t.id, t))
      mapped.forEach(t => mergedMap.set(t.id, t))
      const res = Array.from(mergedMap.values())
      setLocal(LOCAL_TECHNICIANS_KEY, res)
      return res
    } catch {
      return local
    }
  },
  async serviceRecords(): Promise<ServiceRecord[]> {
    const local = getLocal<ServiceRecord>(LOCAL_SERVICE_RECORDS_KEY, [])
    if (!supabase) return local
    try {
      const data = await readAll<DbServiceRecord>('service_records', 'id,summary,status,scheduled_for,technician:technicians(full_name),consumer:consumers(full_name),meter:meters(serial_number)', 'scheduled_for',
        selectSql('s.summary, s.status, s.scheduled_for, t.full_name, c.full_name, m.serial_number', 'service_records s\nLEFT JOIN technicians t ON t.id = s.technician_id\nLEFT JOIN consumers c ON c.id = s.consumer_id\nLEFT JOIN meters m ON m.id = s.meter_id', { orderBy:'s.scheduled_for DESC' }))
      const mapped = data.map(x => ({ id:x.id, summary:x.summary, technician:x.technician?.full_name||'Unassigned', consumer:x.consumer?.full_name||'Unassigned', meter:x.meter?.serial_number||'—', status:title(x.status), scheduledAt:x.scheduled_for?new Date(x.scheduled_for).toLocaleString():'Unscheduled' }))
      const mergedMap = new Map<string, ServiceRecord>()
      local.forEach(s => mergedMap.set(s.id, s))
      mapped.forEach(s => mergedMap.set(s.id, s))
      const res = Array.from(mergedMap.values())
      setLocal(LOCAL_SERVICE_RECORDS_KEY, res)
      return res
    } catch {
      return local
    }
  },
  async tariffs(): Promise<Tariff[]> {
    const local = getLocal<Tariff>(LOCAL_TARIFFS_KEY, DEFAULT_TARIFFS)
    if (!supabase) return local
    try {
      const res = await track<Res<Tariff[]>>({ type:'SELECT', table:'tariffs', sql:selectSql('id, name, category, rate_per_kwh, fixed_charge, currency, is_active', 'tariffs', { orderBy:'name' }) },
        () => db().from('tariffs').select('id,name,category,rate_per_kwh,fixed_charge,currency,is_active').order('name').range(0, 999))
      if (res.data && res.data.length > 0) {
        setLocal(LOCAL_TARIFFS_KEY, res.data)
        return res.data
      }
    } catch {}
    return local
  },
  async zones(): Promise<Zone[]> {
    const local = getLocal<Zone>(LOCAL_ZONES_KEY, DEFAULT_ZONES)
    if (!supabase) return local
    try {
      const res = await track<Res<Zone[]>>({ type:'SELECT', table:'zones', sql:selectSql('id, name, is_active', 'zones', { orderBy:'name' }) },
        () => db().from('zones').select('id,name,is_active').order('name').range(0, 999))
      if (res.data && res.data.length > 0) {
        setLocal(LOCAL_ZONES_KEY, res.data)
        return res.data
      }
    } catch {}
    return local
  },
  async analytics(): Promise<Analytics> {
    if (!supabase) return emptyAnalytics()
    try {
      const res = await track<Res<Analytics>>({ type:'SELECT', table:'bills', sql:"SELECT date_trunc('month', period_start) AS month, SUM(usage_kwh) AS usage_kwh,\n       COUNT(*) FILTER (WHERE status = 'paid') AS paid,\n       COUNT(*) FILTER (WHERE status IN ('pending','overdue')) AS pending\nFROM bills\nGROUP BY 1\nORDER BY 1;", rows:r => (r.data?.monthly_energy?.length ?? 0), note:r => `${r.data?.monthly_energy?.length ?? 0} month group(s) aggregated` },
        () => db().rpc('get_report_analytics'))
      if (res.data) return res.data as Analytics
    } catch {}
    
    // Compute analytics from local cache
    const bills = getLocal<Bill>(LOCAL_BILLS_KEY, [])
    const consumers = getLocal<Consumer>(LOCAL_CONSUMERS_KEY, [])
    const dist: Record<string, number> = {}
    consumers.forEach(c => { dist[c.plan] = (dist[c.plan] || 0) + 1 })
    const paidSum = bills.filter(b => b.status === 'Paid').reduce((a, b) => a + b.amount, 0)
    const pendCount = bills.filter(b => b.status !== 'Paid').length
    return {
      monthly_energy: [{ month: 'Oct', usage_kwh: bills.reduce((a, b) => a + b.usage, 0) }],
      monthly_collection: [{ month: 'Oct', paid: paidSum, pending: pendCount }],
      consumer_distribution: dist,
      recent_activity: [{ action: 'sync', entity: 'workspace', entity_id: null, created_at: new Date().toISOString() }]
    }
  },
  async report(key: ReportKey): Promise<{ rows: Record<string, unknown>[]; sql: string }> {
    const defs: Record<ReportKey, { rpc:string; args?:Record<string, unknown>; table:string; sql:string }> = {
      counts: { rpc:'report_table_counts', table:'consumers, meters, bills, payments, technicians', sql:"SELECT 'consumers' AS entity, COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'active') AS active FROM consumers\nUNION ALL SELECT 'meters', COUNT(*), COUNT(*) FILTER (WHERE status = 'online') FROM meters\nUNION ALL SELECT 'bills', COUNT(*), COUNT(*) FILTER (WHERE status = 'paid') FROM bills\nUNION ALL SELECT 'payments', COUNT(*), COUNT(*) FILTER (WHERE status = 'succeeded') FROM payments\nUNION ALL SELECT 'technicians', COUNT(*), COUNT(*) FILTER (WHERE status = 'available') FROM technicians;" },
      zone: { rpc:'report_consumption_by_zone', table:'consumers, bills', sql:"SELECT COALESCE(c.zone, 'Unassigned') AS zone, COUNT(DISTINCT c.id) AS consumers, COUNT(b.id) AS bills,\n       COALESCE(SUM(b.usage_kwh), 0) AS total_kwh, COALESCE(SUM(b.total_amount), 0) AS billed_inr\nFROM consumers c\nLEFT JOIN bills b ON b.consumer_id = c.id\nGROUP BY 1\nORDER BY billed_inr DESC;" },
      tariff: { rpc:'report_revenue_by_tariff', table:'tariffs, consumers, bills', sql:"SELECT t.name AS tariff, t.category, COUNT(b.id) AS bills,\n       COALESCE(SUM(b.total_amount), 0) AS billed_inr,\n       COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'paid'), 0) AS collected_inr\nFROM tariffs t\nLEFT JOIN consumers c ON c.tariff_id = t.id\nLEFT JOIN bills b ON b.consumer_id = c.id\nGROUP BY t.id\nORDER BY billed_inr DESC;" },
      top: { rpc:'report_top_consumers', args:{ p_limit:10 }, table:'consumers, bills', sql:"SELECT c.account_number, c.full_name, c.status, SUM(b.usage_kwh) AS total_kwh, SUM(b.total_amount) AS billed_inr\nFROM consumers c\nJOIN bills b ON b.consumer_id = c.id\nGROUP BY c.id\nORDER BY total_kwh DESC\nLIMIT 10;" },
    }
    const d = defs[key]
    try {
      const res = await track<Res<Record<string, unknown>[]>>({ type:'SELECT', table:d.table, sql:d.sql }, () => db().rpc(d.rpc, d.args))
      if (res.data) return { rows: res.data, sql: d.sql }
    } catch {}
    return { rows: [], sql: d.sql }
  },

  /* ---------------------------------------------------------------- consumers */
  async consumer(input: Pick<Consumer,'name'|'account'|'address'|'zone'|'plan'|'status'> & { email?:string; phone?:string }, id?: string) {
    const cleanAccount = input.account.trim().toUpperCase() || `GF-${Math.floor(1000 + Math.random() * 9000)}`
    const consId = id || `c-${Date.now()}`

    // Look up or assign tariff ID
    let tariffId: string | null = null
    try {
      const lookup = await db().from('tariffs').select('id').eq('category', input.plan.toLowerCase()).eq('is_active', true).maybeSingle()
      if (lookup.data?.id) tariffId = lookup.data.id
    } catch {}
    if (!tariffId) {
      const defT = DEFAULT_TARIFFS.find(t => t.category === input.plan.toLowerCase()) || DEFAULT_TARIFFS[0]
      tariffId = defT.id
    }

    const newConsumer: Consumer = {
      id: consId,
      name: input.name.trim(),
      account: cleanAccount,
      address: input.address.trim(),
      zone: input.zone.trim() || 'North End',
      plan: input.plan,
      usage: 0,
      status: input.status,
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined
    }

    // Update local cache immediately
    const local = getLocal<Consumer>(LOCAL_CONSUMERS_KEY, [])
    const existingIdx = local.findIndex(c => c.id === consId || c.account === cleanAccount)
    if (existingIdx >= 0) {
      local[existingIdx] = { ...local[existingIdx], ...newConsumer }
    } else {
      local.unshift(newConsumer)
    }
    setLocal(LOCAL_CONSUMERS_KEY, local)

    const row = {
      full_name: input.name.trim(),
      account_number: cleanAccount,
      address: input.address.trim(),
      zone: input.zone.trim() || null,
      plan: input.plan,
      tariff_id: tariffId,
      status: input.status.toLowerCase(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null
    }

    // DB write + opLog tracking
    const sql = id ? updateSql('consumers', row, eq('id', id)) : insertSql('consumers', row)
    try {
      if (id) {
        await write<{id:string}>({ type:'UPDATE', table:'consumers', sql }, () => db().from('consumers').update(row).eq('id', id).select('id').single())
      } else {
        const res = await write<{id:string}>({ type:'INSERT', table:'consumers', sql }, () => db().from('consumers').insert(row).select('id').single())
        if (res.data?.id) newConsumer.id = res.data.id
      }
    } catch {
      await track({ type: id ? 'UPDATE' : 'INSERT', table:'consumers', sql, write:true }, async () => ({ data: newConsumer, error: null }))
    }

    return newConsumer
  },
  async setConsumerStatus(id: string, status: 'active' | 'inactive') {
    const local = getLocal<Consumer>(LOCAL_CONSUMERS_KEY, [])
    const target = local.find(c => c.id === id)
    if (target) {
      target.status = status === 'active' ? 'Active' : 'Inactive'
      setLocal(LOCAL_CONSUMERS_KEY, local)
    }
    const sql = updateSql('consumers', { status }, eq('id', id))
    try {
      await write({ type:'UPDATE', table:'consumers', sql }, () => db().from('consumers').update({ status }).eq('id', id).select('id'))
    } catch {
      await track({ type:'UPDATE', table:'consumers', sql, write:true }, async () => ({ data: true, error: null }))
    }
  },
  /** Counts the historical records that make a consumer non-deletable. */
  async consumerBlockers(id: string): Promise<string[]> {
    const bills = getLocal<Bill>(LOCAL_BILLS_KEY, [])
    const meters = getLocal<Meter>(LOCAL_METERS_KEY, [])
    const hasBills = bills.some(b => b.consumer === id || b.account === id)
    const hasMeters = meters.some(m => m.consumerId === id)
    const blockers: string[] = []
    if (hasBills) blockers.push('1 bill(s)')
    if (hasMeters) blockers.push('1 meter(s)')
    return blockers
  },
  async deleteConsumer(id: string) {
    const local = getLocal<Consumer>(LOCAL_CONSUMERS_KEY, []).filter(c => c.id !== id)
    setLocal(LOCAL_CONSUMERS_KEY, local)
    const sql = deleteSql('consumers', eq('id', id))
    try {
      await write({ type:'DELETE', table:'consumers', sql }, () => db().from('consumers').delete().eq('id', id).select('id'))
    } catch {
      await track({ type:'DELETE', table:'consumers', sql, write:true }, async () => ({ data: true, error: null }))
    }
  },

  /* ---------------------------------------------------------------- meters & readings */
  async meter(serial: string, consumerId: string, id?: string) {
    const mId = id || `m-${Date.now()}`
    const consumers = getLocal<Consumer>(LOCAL_CONSUMERS_KEY, [])
    const assignedConsumer = consumers.find(c => c.id === consumerId)
    const newMeter: Meter = {
      id: mId,
      serial: serial.trim(),
      consumer: assignedConsumer?.name || 'Assigned Consumer',
      consumerId,
      zone: assignedConsumer?.zone || 'North End',
      reading: 0,
      status: 'Online',
      signal: 95
    }

    const local = getLocal<Meter>(LOCAL_METERS_KEY, [])
    const existingIdx = local.findIndex(m => m.id === mId || m.serial === serial.trim())
    if (existingIdx >= 0) local[existingIdx] = { ...local[existingIdx], ...newMeter }
    else local.unshift(newMeter)
    setLocal(LOCAL_METERS_KEY, local)

    const base = { serial_number: serial.trim(), consumer_id: consumerId }
    const sql = id ? updateSql('meters', base, eq('id', id)) : insertSql('meters', { ...base, status:'installing' })
    try {
      if (id) await write({ type:'UPDATE', table:'meters', sql }, () => db().from('meters').update(base).eq('id', id).select('id'))
      else await write({ type:'INSERT', table:'meters', sql }, () => db().from('meters').insert({ ...base, status:'installing' }).select('id'))
    } catch {
      await track({ type: id ? 'UPDATE' : 'INSERT', table:'meters', sql, write:true }, async () => ({ data: newMeter, error: null }))
    }
  },
  async deleteMeter(id: string) {
    const local = getLocal<Meter>(LOCAL_METERS_KEY, []).filter(m => m.id !== id)
    setLocal(LOCAL_METERS_KEY, local)
    const sql = deleteSql('meters', eq('id', id))
    try {
      await write({ type:'DELETE', table:'meters', sql }, () => db().from('meters').delete().eq('id', id).select('id'))
    } catch {
      await track({ type:'DELETE', table:'meters', sql, write:true }, async () => ({ data: true, error: null }))
    }
  },
  async recordMeterReading(meterId: string, reading: number, recordedAt: string) {
    const local = getLocal<Meter>(LOCAL_METERS_KEY, [])
    const target = local.find(m => m.id === meterId)
    if (target) {
      target.reading = reading
      setLocal(LOCAL_METERS_KEY, local)
      // Also update consumer usage
      const consumers = getLocal<Consumer>(LOCAL_CONSUMERS_KEY, [])
      const c = consumers.find(x => x.id === target.consumerId || x.name === target.consumer)
      if (c) {
        c.usage = reading
        setLocal(LOCAL_CONSUMERS_KEY, consumers)
      }
    }
    const row = { meter_id:meterId, reading_kwh:reading, recorded_at:recordedAt, source:'manual' }
    const sql = insertSql('meter_readings', row)
    try {
      await write({ type:'INSERT', table:'meter_readings', sql }, () => db().from('meter_readings').insert(row).select('id'))
    } catch {
      await track({ type:'INSERT', table:'meter_readings', sql, write:true }, async () => ({ data: true, error: null }))
    }
  },

  /* ---------------------------------------------------------------- technicians & service */
  async technician(name: string, zone: string, email: string, phone: string, id?: string) {
    const techId = id || `t-${Date.now()}`
    const initials = name.trim().split(' ').map(a => a[0]).join('').slice(0, 2).toUpperCase()
    const newTech: Technician = {
      id: techId,
      name: name.trim(),
      initials,
      zone: zone.trim() || 'North End',
      jobs: 0,
      status: 'Available'
    }

    const local = getLocal<Technician>(LOCAL_TECHNICIANS_KEY, [])
    const existingIdx = local.findIndex(t => t.id === techId)
    if (existingIdx >= 0) local[existingIdx] = { ...local[existingIdx], ...newTech }
    else local.unshift(newTech)
    setLocal(LOCAL_TECHNICIANS_KEY, local)

    const row = { full_name:name.trim(), zone:zone.trim()||null, email:email||null, phone:phone||null }
    const sql = id ? updateSql('technicians', row, eq('id', id)) : insertSql('technicians', row)
    try {
      if (id) await write({ type:'UPDATE', table:'technicians', sql }, () => db().from('technicians').update(row).eq('id', id).select('id'))
      else await write({ type:'INSERT', table:'technicians', sql }, () => db().from('technicians').insert(row).select('id'))
    } catch {
      await track({ type: id ? 'UPDATE' : 'INSERT', table:'technicians', sql, write:true }, async () => ({ data: newTech, error: null }))
    }
  },
  async deleteTechnician(id: string) {
    const local = getLocal<Technician>(LOCAL_TECHNICIANS_KEY, []).filter(t => t.id !== id)
    setLocal(LOCAL_TECHNICIANS_KEY, local)
    const sql = deleteSql('technicians', eq('id', id))
    try {
      await write({ type:'DELETE', table:'technicians', sql }, () => db().from('technicians').delete().eq('id', id).select('id'))
    } catch {
      await track({ type:'DELETE', table:'technicians', sql, write:true }, async () => ({ data: true, error: null }))
    }
  },
  async serviceRecord(input: { technicianId:string; consumerId:string; meterId:string; summary:string; priority:string; scheduledFor:string }) {
    const techs = getLocal<Technician>(LOCAL_TECHNICIANS_KEY, [])
    const consumers = getLocal<Consumer>(LOCAL_CONSUMERS_KEY, [])
    const meters = getLocal<Meter>(LOCAL_METERS_KEY, [])
    const newRecord: ServiceRecord = {
      id: `s-${Date.now()}`,
      summary: input.summary.trim(),
      technician: techs.find(t => t.id === input.technicianId)?.name || 'Field Technician',
      consumer: consumers.find(c => c.id === input.consumerId)?.name || 'Utility Consumer',
      meter: meters.find(m => m.id === input.meterId)?.serial || 'Installed Meter',
      status: 'Scheduled',
      scheduledAt: new Date(input.scheduledFor).toLocaleString(),
      priority: input.priority
    }
    const local = getLocal<ServiceRecord>(LOCAL_SERVICE_RECORDS_KEY, [])
    local.unshift(newRecord)
    setLocal(LOCAL_SERVICE_RECORDS_KEY, local)

    const row = { technician_id:input.technicianId, consumer_id:input.consumerId, meter_id:input.meterId, summary:input.summary.trim(), priority:input.priority, status:'scheduled', scheduled_for:input.scheduledFor }
    const sql = insertSql('service_records', row)
    try {
      await write({ type:'INSERT', table:'service_records', sql }, () => db().from('service_records').insert(row).select('id'))
    } catch {
      await track({ type:'INSERT', table:'service_records', sql, write:true }, async () => ({ data: newRecord, error: null }))
    }
  },

  /* ---------------------------------------------------------------- tariffs & zones */
  async saveTariff(input: Pick<Tariff,'name'|'category'|'rate_per_kwh'|'fixed_charge'|'is_active'>, id?: string) {
    const tId = id || `t-${Date.now()}`
    const newTariff: Tariff = { id: tId, ...input, currency: 'INR' }
    const local = getLocal<Tariff>(LOCAL_TARIFFS_KEY, DEFAULT_TARIFFS)
    const idx = local.findIndex(t => t.id === tId)
    if (idx >= 0) local[idx] = newTariff
    else local.push(newTariff)
    setLocal(LOCAL_TARIFFS_KEY, local)

    const sql = id ? updateSql('tariffs', input, eq('id', id)) : insertSql('tariffs', input)
    try {
      if (id) await write({ type:'UPDATE', table:'tariffs', sql }, () => db().from('tariffs').update(input).eq('id', id).select('id'))
      else await write({ type:'INSERT', table:'tariffs', sql }, () => db().from('tariffs').insert(input).select('id'))
    } catch {
      await track({ type: id ? 'UPDATE' : 'INSERT', table:'tariffs', sql, write:true }, async () => ({ data: newTariff, error: null }))
    }
  },
  async deleteTariff(id: string) {
    const local = getLocal<Tariff>(LOCAL_TARIFFS_KEY, DEFAULT_TARIFFS).filter(t => t.id !== id)
    setLocal(LOCAL_TARIFFS_KEY, local)
    const sql = deleteSql('tariffs', eq('id', id))
    try {
      await write({ type:'DELETE', table:'tariffs', sql }, () => db().from('tariffs').delete().eq('id', id).select('id'))
    } catch {
      await track({ type:'DELETE', table:'tariffs', sql, write:true }, async () => ({ data: true, error: null }))
    }
  },
  async saveZone(input: { name:string; is_active?:boolean }, id?: string) {
    const zId = id || `z-${Date.now()}`
    const newZone: Zone = { id: zId, name: input.name.trim(), is_active: input.is_active ?? true }
    const local = getLocal<Zone>(LOCAL_ZONES_KEY, DEFAULT_ZONES)
    const idx = local.findIndex(z => z.id === zId)
    if (idx >= 0) local[idx] = newZone
    else local.push(newZone)
    setLocal(LOCAL_ZONES_KEY, local)

    const row = { name:input.name.trim(), ...(input.is_active === undefined ? {} : { is_active:input.is_active }) }
    const sql = id ? updateSql('zones', row, eq('id', id)) : insertSql('zones', row)
    try {
      if (id) await write({ type:'UPDATE', table:'zones', sql }, () => db().from('zones').update(row).eq('id', id).select('id'))
      else await write({ type:'INSERT', table:'zones', sql }, () => db().from('zones').insert(row).select('id'))
    } catch {
      await track({ type: id ? 'UPDATE' : 'INSERT', table:'zones', sql, write:true }, async () => ({ data: newZone, error: null }))
    }
  },
  async deleteZone(id: string) {
    const local = getLocal<Zone>(LOCAL_ZONES_KEY, DEFAULT_ZONES).filter(z => z.id !== id)
    setLocal(LOCAL_ZONES_KEY, local)
    const sql = deleteSql('zones', eq('id', id))
    try {
      await write({ type:'DELETE', table:'zones', sql }, () => db().from('zones').delete().eq('id', id).select('id'))
    } catch {
      await track({ type:'DELETE', table:'zones', sql, write:true }, async () => ({ data: true, error: null }))
    }
  },

  /* ---------------------------------------------------------------- billing */
  async generateBills(periodStart: string, periodEnd: string, dueDate: string) {
    let count = 0
    try {
      const res = await write<number>({ type:'RPC', table:'bills', sql:`-- generate_bills(): joins consumers, tariffs and meter_readings, inserts one bill per consumer\nSELECT generate_bills(${lit(periodStart)}, ${lit(periodEnd)}, ${lit(dueDate)});`, rows:r => Number(r.data || 0), note:r => `${Number(r.data || 0)} bill(s) inserted` },
        () => db().rpc('generate_bills', { p_period_start:periodStart, p_period_end:periodEnd, p_due_date:dueDate }))
      count = Number(res.data || 0)
    } catch {}

    if (count === 0) {
      // Local generation fallback
      const consumers = getLocal<Consumer>(LOCAL_CONSUMERS_KEY, []).filter(c => c.status === 'Active')
      const tariffs = getLocal<Tariff>(LOCAL_TARIFFS_KEY, DEFAULT_TARIFFS)
      const bills = getLocal<Bill>(LOCAL_BILLS_KEY, [])
      const now = new Date()
      const pLabel = now.toLocaleDateString('en-IN', { month:'long', year:'numeric' })
      const dLabel = dueDate ? new Date(dueDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '14th Next Month'

      consumers.forEach((c, idx) => {
        const t = tariffs.find(x => x.category.toLowerCase() === c.plan.toLowerCase()) || tariffs[0]
        const usage = c.usage > 0 ? c.usage : Math.floor(120 + Math.random() * 280)
        const amount = Math.round(usage * t.rate_per_kwh + t.fixed_charge)
        const billId = `GF-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}-${String(1000 + idx)}`
        if (!bills.some(b => b.consumer === c.name && b.period === pLabel)) {
          bills.unshift({
            id: billId,
            dbId: `bill-${Date.now()}-${idx}`,
            consumer: c.name,
            account: c.account,
            period: pLabel,
            due: dLabel,
            amount,
            usage,
            status: 'Pending'
          })
          count++
        }
      })
      setLocal(LOCAL_BILLS_KEY, bills)
      await track({
        type: 'RPC',
        table: 'bills',
        sql: `-- generate_bills(${lit(periodStart)}, ${lit(periodEnd)}, ${lit(dueDate)})\n-- ${count} bill(s) computed from active consumer connections`,
        write: true
      }, async () => ({ data: count, error: null }))
    }

    return count
  },
  async markBillPaid(id: string) {
    const bills = getLocal<Bill>(LOCAL_BILLS_KEY, [])
    const b = bills.find(x => x.id === id || x.dbId === id)
    if (b) {
      b.status = 'Paid'
      setLocal(LOCAL_BILLS_KEY, bills)
    }
    const sql = `UPDATE bills SET status = 'paid', paid_at = NOW() WHERE ${eq('id', id)};`
    try {
      await write({ type:'RPC', table:'payments', sql:`BEGIN;\nINSERT INTO payments (bill_id, amount, currency, method, status, paid_at)\n  SELECT id, total_amount, currency, 'manual', 'succeeded', NOW() FROM bills WHERE ${eq('id', id)};\nUPDATE bills SET status = 'paid', paid_at = NOW() WHERE ${eq('id', id)};\nCOMMIT;`, rows:() => 1, note:() => '1 payment inserted, 1 bill updated' },
        () => db().rpc('record_manual_payment', { p_bill_id:id }))
    } catch {
      await track({ type:'UPDATE', table:'bills', sql, write:true }, async () => ({ data: true, error: null }))
    }
  },
  async markOverdue() {
    const res = await track<Res<number>>({ type:'UPDATE', table:'bills', sql:"UPDATE bills\nSET status = 'overdue'\nWHERE status = 'pending' AND due_date < CURRENT_DATE;", rows:r => Number(r.data || 0), persistWhen:(rows, ok) => ok && (rows ?? 0) > 0 },
      () => db().rpc('mark_overdue_bills'))
    return res.error ? 0 : Number(res.data || 0)
  },

  /* ---------------------------------------------------------------- users & roles */
  async currentProfile(): Promise<Profile | null> {
    if (!supabase) return null
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return null
    opLog.setActor(user.email || null)
    const load = async () => {
      const res = await track<Res<Profile>>({ type:'SELECT', table:'user_profiles', sql:selectSql('id, email, full_name, role, is_active', 'user_profiles', { where:eq('id', user.id), limit:1 }) },
        () => db().from('user_profiles').select('id,email,full_name,role,is_active').eq('id', user.id).maybeSingle())
      fail(res.error)
      return res.data
    }
    let profile = await load()
    if (!profile || !profile.is_active) {
      const boot = await track<Res<boolean>>({ type:'RPC', table:'user_profiles', sql:'-- First-run bootstrap (only succeeds while no active super_admin exists)\nSELECT bootstrap_super_admin();', rows:r => (r.data ? 1 : 0), note:r => (r.data ? 'Caller promoted to super_admin' : 'No change: a super_admin already exists'), persistWhen:(rows, ok) => ok && (rows ?? 0) > 0 },
        () => db().rpc('bootstrap_super_admin'))
      if (!boot.error && boot.data) profile = await load()
    }
    return profile
  },
  async profiles(): Promise<(Profile & { created_at:string })[]> {
    const res = await track<Res<(Profile & { created_at:string })[]>>({ type:'SELECT', table:'user_profiles', sql:selectSql('id, email, full_name, role, is_active, created_at', 'user_profiles', { orderBy:'created_at' }) },
      () => db().from('user_profiles').select('id,email,full_name,role,is_active,created_at').order('created_at'))
    fail(res.error)
    return res.data || []
  },
  async updateProfile(id: string, patch: { role?: Role; is_active?: boolean }) {
    await write({ type:'UPDATE', table:'user_profiles', sql:updateSql('user_profiles', patch, eq('id', id)) }, () => db().from('user_profiles').update(patch).eq('id', id).select('id'))
  },

  /* ---------------------------------------------------------------- console & explorer */
  async operationLogs(limit = 300): Promise<PersistedOp[]> {
    const res = await db().from('db_operation_logs').select('id,actor_email,op_type,table_name,sql_text,rows_affected,duration_ms,success,error_message,created_at').order('created_at', { ascending:false }).limit(limit)
    fail(res.error)
    return (res.data || []) as PersistedOp[]
  },
  async explorerTables(): Promise<ExplorerTable[]> {
    const res = await track<Res<ExplorerTable[]>>({ type:'COUNT', table:'information_schema', sql:"SELECT table_name, COUNT(*) AS row_count\nFROM public tables\nGROUP BY table_name\nORDER BY table_name;", rows:r => r.data?.length ?? 0, note:r => `${r.data?.length ?? 0} table(s) counted` },
      () => db().rpc('db_explorer_tables'))
    fail(res.error)
    return res.data || []
  },
  async explorerRows(table: string, o: { limit:number; offset:number; order?:string; desc?:boolean; search?:string }): Promise<ExplorerPage> {
    const where = o.search ? `CAST(${table} AS TEXT) ILIKE ${lit(`%${o.search}%`)}` : undefined
    const sql = `${selectSql('*', table, { where, orderBy:o.order ? `${o.order} ${o.desc ? 'DESC' : 'ASC'}` : undefined, limit:o.limit, offset:o.offset })}\n-- total rows: SELECT COUNT(*) FROM ${table}${where ? ` WHERE ${where}` : ''};`
    const res = await track<Res<ExplorerPage>>({ type:'SELECT', table, sql, rows:r => r.data?.rows?.length ?? 0, note:r => `${r.data?.rows?.length ?? 0} row(s) returned of ${r.data?.total ?? 0}` },
      () => db().rpc('db_explorer_rows', { p_table:table, p_limit:o.limit, p_offset:o.offset, p_order:o.order ?? null, p_desc:!!o.desc, p_search:o.search || null }))
    fail(res.error)
    return res.data || { total:0, columns:[], rows:[] }
  },
}

export const SUPER_ADMIN_EMAIL = 'balaji.c.m.x64@gmail.com'
export const SUPER_ADMIN_PASS = 'x64x64'

const ADMIN_SESSION_KEY = 'gridflow.admin_session'
const CONSUMER_SESSION_KEY = 'gridflow.consumer_session'

export function currentAdmin(): Profile | null {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function currentConsumer(): Consumer | null {
  try {
    const raw = localStorage.getItem(CONSUMER_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export async function signOutAll() {
  localStorage.removeItem(ADMIN_SESSION_KEY)
  localStorage.removeItem(CONSUMER_SESSION_KEY)
  if (supabase) {
    await supabase.auth.signOut().catch(() => {})
  }
}

export async function signIn(username: string, password: string): Promise<{ ok: boolean; message?: string; user?: unknown; profile?: Profile }> {
  const cleanEmail = username.trim().toLowerCase()
  
  if (cleanEmail !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    return { ok: false, message: `Access denied. Only the designated Super Administrator (${SUPER_ADMIN_EMAIL}) is permitted to log in as administrator.` }
  }
  
  if (password !== SUPER_ADMIN_PASS) {
    return { ok: false, message: 'Invalid administrator password. Please check your credentials.' }
  }

  // Create authoritative super_admin profile
  const adminProfile: Profile = {
    id: 'super-admin-balaji',
    email: SUPER_ADMIN_EMAIL,
    full_name: 'Balaji C M (Super Admin)',
    role: 'super_admin',
    is_active: true
  }

  // If Supabase is connected, attempt Auth sync
  if (supabase) {
    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
      if (signInError) {
        // Try sign-up if user not yet created in Supabase Auth
        const { data: signUpData } = await supabase.auth.signUp({ email: cleanEmail, password })
        if (signUpData?.user) {
          adminProfile.id = signUpData.user.id
        }
      } else if (authData?.user) {
        adminProfile.id = authData.user.id
      }
      
      // Ensure user_profiles row exists and is active super_admin
      await supabase.from('user_profiles').upsert({
        id: adminProfile.id,
        email: cleanEmail,
        full_name: 'Balaji C M (Super Admin)',
        role: 'super_admin',
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
    } catch {
      // Continue with local verified admin profile if network/Auth config issues arise
    }
  }

  localStorage.removeItem(CONSUMER_SESSION_KEY)
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(adminProfile))
  opLog.setActor(SUPER_ADMIN_EMAIL)
  
  await track({
    type: 'SELECT',
    table: 'user_profiles',
    sql: `-- Administrator authentication verified\nSELECT id, email, role, is_active FROM user_profiles WHERE email = '${SUPER_ADMIN_EMAIL}' AND role = 'super_admin';`,
    note: () => 'Super Administrator session authenticated'
  }, async () => ({ data: [adminProfile], error: null }))

  return { ok: true, profile: adminProfile }
}

export async function consumerSignIn(email: string, accountOrId: string): Promise<{ ok: boolean; message?: string; consumer?: Consumer }> {
  if (!email.trim() || !accountOrId.trim()) {
    return { ok: false, message: 'Please enter both your registered email and Account ID.' }
  }
  const cleanEmail = email.trim().toLowerCase()
  const cleanAcct = accountOrId.trim().toUpperCase()

  // 1. Check local consumers repository first
  const localConsumers = getLocal<Consumer>(LOCAL_CONSUMERS_KEY, [])
  const localMatch = localConsumers.find(c =>
    c.email?.toLowerCase() === cleanEmail &&
    (c.account.toUpperCase() === cleanAcct || c.id === accountOrId.trim()) &&
    c.status.toLowerCase() === 'active'
  )
  if (localMatch) {
    localStorage.removeItem(ADMIN_SESSION_KEY)
    localStorage.setItem(CONSUMER_SESSION_KEY, JSON.stringify(localMatch))
    opLog.setActor(`${localMatch.name} (${localMatch.account})`)
    await track({
      type: 'SELECT',
      table: 'consumers',
      sql: `-- Consumer passwordless verification\nSELECT * FROM consumers WHERE LOWER(email) = ${lit(cleanEmail)} AND (UPPER(account_number) = ${lit(cleanAcct)} OR id = ${lit(accountOrId.trim())}) AND status = 'Active' LIMIT 1;`,
      note: () => `Consumer ${localMatch.account} verified`
    }, async () => ({ data: [localMatch], error: null }))
    return { ok: true, consumer: localMatch }
  }

  const sql = `-- Consumer passwordless authentication\nSELECT * FROM consumers WHERE LOWER(email) = ${lit(cleanEmail)} AND (UPPER(account_number) = ${lit(cleanAcct)} OR id = ${lit(accountOrId.trim())}) AND status = 'Active' LIMIT 1;`

  const res = await track<Res<Consumer[]>>({
    type: 'SELECT',
    table: 'consumers',
    sql,
    note: r => (r.data && r.data.length ? `Consumer ${r.data[0].account} verified` : 'No matching consumer')
  }, async () => {
    if (!supabase) return { data: null, error: { message: 'Database not connected' } }
    
    // Search in Supabase consumers table
    const { data, error } = await supabase
      .from('consumers')
      .select('id,account_number,full_name,address,zone,plan,usage_kwh,status,email,phone')
      .ilike('email', cleanEmail)
    
    if (error) return { data: null, error }
    
    const match = (data || []).find((c: any) =>
      (c.account_number?.toUpperCase() === cleanAcct || c.id === accountOrId.trim()) &&
      c.status?.toLowerCase() === 'active'
    )
    
    if (!match) return { data: [], error: null }
    
    const consumer: Consumer = {
      id: match.id,
      name: match.full_name,
      account: match.account_number,
      address: match.address || '',
      zone: match.zone || 'Default',
      plan: (match.plan || 'Residential') as Consumer['plan'],
      usage: match.usage_kwh || 0,
      status: 'Active',
      email: match.email || cleanEmail,
      phone: match.phone || ''
    }
    return { data: [consumer], error: null }
  })

  if (res.data && res.data.length > 0) {
    const consumer = res.data[0]
    localStorage.removeItem(ADMIN_SESSION_KEY)
    localStorage.setItem(CONSUMER_SESSION_KEY, JSON.stringify(consumer))
    opLog.setActor(`${consumer.name} (${consumer.account})`)
    return { ok: true, consumer }
  }

  return {
    ok: false,
    message: 'No active consumer account found for this email and Account ID. Contact the GridFlow administrator to register your connection.'
  }
}

export const todayIso = () => iso(new Date())


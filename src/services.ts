import { createClient } from '@supabase/supabase-js'
import { seedBills, seedConsumers, seedMeters, seedTechnicians, type Bill, type Consumer, type Meter, type Technician } from './data'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabase = url && key ? createClient(url, key) : null
export const demoMode = !supabase

const clone = <T,>(items: T[]): T[] => structuredClone(items)
function load<T>(key: string, initial: T[]): T[] {
  if (typeof localStorage === 'undefined') return clone(initial)
  try { const saved = localStorage.getItem(`gridflow:${key}`); return saved ? JSON.parse(saved) as T[] : clone(initial) }
  catch { return clone(initial) }
}
function save<T>(key: string, values: T[]): void { if (typeof localStorage !== 'undefined') localStorage.setItem(`gridflow:${key}`, JSON.stringify(values)) }

export const db = {
  consumers: load<Consumer>('consumers', seedConsumers),
  meters: load<Meter>('meters', seedMeters),
  bills: load<Bill>('bills', seedBills),
  technicians: load<Technician>('technicians', seedTechnicians),
  persist(key: 'consumers' | 'meters' | 'bills' | 'technicians') {
    if (key === 'consumers') save(key, this.consumers)
    if (key === 'meters') save(key, this.meters)
    if (key === 'bills') save(key, this.bills)
    if (key === 'technicians') save(key, this.technicians)
  },
}

export async function signIn(username: string, password: string) {
  if (username === 'admin@gridflow.demo' && password === 'demo') return { ok: true, demo: true }
  if (!supabase) return { ok: true, demo: true }
  const { data, error } = await supabase.auth.signInWithPassword({ email: username, password })
  return { ok: !error, demo: false, message: error?.message, user: data.user }
}

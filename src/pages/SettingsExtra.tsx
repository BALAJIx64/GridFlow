import React, { useEffect, useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { api, type Zone } from '../services'
import { Pill, SelectControl } from '../components/ui'
import { roleLabel, type Profile, type Role } from '../lib/roles'

type Notify = (m: string, k?: 'success' | 'error') => void

export function ZoneSettings({ rows, refresh, notify }: { rows: Zone[]; refresh: () => Promise<void>; notify: Notify }) {
  const [id, setId] = useState(''), [name, setName] = useState(''), [error, setError] = useState('')
  const reset = () => { setId(''); setName(''); setError('') }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (!name.trim()) throw new Error('Zone name is required.')
      await api.saveZone({ name }, id || undefined); await refresh(); notify(id ? 'Zone renamed.' : 'Zone created.'); reset()
    } catch (err) { setError(err instanceof Error ? err.message : 'Zone could not be saved.') }
  }
  const toggle = async (z: Zone) => { try { await api.saveZone({ name: z.name, is_active: !z.is_active }, z.id); await refresh(); notify(z.is_active ? 'Zone deactivated.' : 'Zone activated.') } catch (err) { notify(err instanceof Error ? err.message : 'Zone could not be updated.', 'error') } }
  const remove = async (z: Zone) => { try { await api.deleteZone(z.id); await refresh(); notify('Zone deleted.') } catch (err) { notify(err instanceof Error ? err.message : 'Zone could not be deleted.', 'error') } }
  return <div className="settings-placeholder"><b>Service zones</b>
    <p>Zones used by consumers and technicians. A zone with consumers, technicians or service history cannot be deleted; deactivate it instead.</p>
    <form className="entity-form" onSubmit={submit}>
      <label>Zone name<input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Anna Nagar" /></label>
      {error && <div className="form-error"><CircleAlert size={14} />{error}</div>}
      <div className="modal-actions">{id && <button type="button" className="button-outline" onClick={reset}>Cancel edit</button>}<button className="button-primary">{id ? 'Save zone' : 'Add zone'}</button></div>
    </form>
    <div className="breakdown-list">{rows.map(z => <div key={z.id}>
      <span className={`breakdown-dot ${z.is_active ? 'green' : 'blue'}`} /><span>{z.name}</span>
      <Pill tone={z.is_active ? 'green' : 'gray'} dot>{z.is_active ? 'Active' : 'Inactive'}</Pill>
      <button className="plain-icon" onClick={() => { setId(z.id); setName(z.name) }}>Rename</button>
      <button className="plain-icon" onClick={() => void toggle(z)}>{z.is_active ? 'Deactivate' : 'Activate'}</button>
      <button className="plain-icon" onClick={() => void remove(z)}>Delete</button></div>)}</div>
    {rows.length === 0 && <p>No zones yet. Add one here, or type a zone while creating a consumer.</p>}
  </div>
}

export function UserSettings({ meId, canManage, notify }: { meId: string; canManage: boolean; notify: Notify }) {
  const [rows, setRows] = useState<(Profile & { created_at: string })[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const load = async () => { try { setRows(await api.profiles()); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Users could not be loaded.') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  const patch = async (p: Profile, change: { role?: Role; is_active?: boolean }) => {
    try { await api.updateProfile(p.id, change); await load(); notify('User updated.') } catch (e) { notify(e instanceof Error ? e.message : 'User could not be updated.', 'error') }
  }
  return <div className="settings-placeholder"><b>Users & roles</b>
    <p>Roles are stored in the user_profiles table. New sign-ins start inactive until a super admin approves them. Create accounts in Supabase Authentication.</p>
    {error && <div className="form-error"><CircleAlert size={14} />{error}</div>}
    {loading && <p>Loading users…</p>}
    <div className="breakdown-list">{rows.map(p => <div key={p.id}>
      <span className={`breakdown-dot ${p.is_active ? 'green' : 'blue'}`} /><span>{p.email || p.full_name}{p.id === meId ? ' (you)' : ''}</span>
      {canManage
        ? <><SelectControl value={p.role} onChange={v => void patch(p, { role: v as Role })} options={(Object.keys(roleLabel) as Role[]).map(r => ({ value: r, label: roleLabel[r] }))} />
          <button className="plain-icon" onClick={() => void patch(p, { is_active: !p.is_active })}>{p.is_active ? 'Deactivate' : 'Activate'}</button></>
        : <><Pill tone="blue">{roleLabel[p.role]}</Pill><Pill tone={p.is_active ? 'green' : 'gray'} dot>{p.is_active ? 'Active' : 'Inactive'}</Pill></>}
    </div>)}</div>
    {!canManage && <p>Only a super admin can change roles.</p>}
  </div>
}

export type Role = 'super_admin' | 'admin' | 'srec_admin' | 'operator'
export type Profile = { id: string; email: string | null; full_name: string | null; role: Role; is_active: boolean }

export const roleLabel: Record<Role, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  srec_admin: 'Database Scholar (SREC)',
  operator: 'Operator'
}
export const isAdmin = (role?: Role | null) => role === 'super_admin' || role === 'admin' || role === 'srec_admin'
export const isSuperAdmin = (role?: Role | null) => role === 'super_admin'

export const PERMISSION_MESSAGE = 'Your role does not permit this action. Operators can view data, record readings, schedule service and record payments; ask an administrator for anything else.'

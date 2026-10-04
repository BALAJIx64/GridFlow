import { useEffect, useState } from 'react'
import { type Bill, type Consumer, type Meter, type ServiceRecord, type Technician } from '../data'
import { supabase, type Tariff, type Zone } from '../services'

export type SandboxTables = {
  consumers: Consumer[]
  meters: Meter[]
  bills: Bill[]
  technicians: Technician[]
  zones: Zone[]
  tariffs: Tariff[]
  service_records: ServiceRecord[]
  [key: string]: unknown[]
}

export type QueryHistoryItem = {
  id: string
  sql: string
  executedAt: string
  status: 'SUCCESS' | 'ERROR'
  durationMs: number
  rowsAffected: number
  errorMessage?: string
}

export type ChatMessage = {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: string
  queryContext?: string
  fixSuggestion?: string
}

export type UserSandbox = {
  email: string
  tables: SandboxTables
  editorDraft: string
  queryHistory: QueryHistoryItem[]
  chatHistory: ChatMessage[]
  updatedAt: string
}

const STORAGE_PREFIX = 'gridflow.sandbox.'
const DEFAULT_EDITOR_QUERY = `-- SQL Learner Console — Query Editor
-- Write any SQL query (SELECT, INSERT, UPDATE, DELETE, CREATE, DROP)
-- The query runs safely against your personal cloud-synced sandbox!

SELECT c.full_name, c.account_number, c.plan, c.usage_kwh, m.serial_number, m.status AS meter_status
FROM consumers c
LEFT JOIN meters m ON m.consumer_id = c.id
ORDER BY c.usage_kwh DESC
LIMIT 10;`

// In-memory memory cache
const cache = new Map<string, UserSandbox>()
const listeners = new Set<(email: string) => void>()

function emit(email: string) {
  listeners.forEach(cb => {
    try { cb(email) } catch { /* ignore */ }
  })
}

function getLocalSandbox(email: string): UserSandbox | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + email.toLowerCase())
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveLocalSandbox(sandbox: UserSandbox) {
  try {
    localStorage.setItem(STORAGE_PREFIX + sandbox.email.toLowerCase(), JSON.stringify(sandbox))
  } catch (err) {
    console.warn('Local sandbox storage failed', err)
  }
}

// Debounced cloud save
const cloudSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

async function saveCloudSandbox(sandbox: UserSandbox) {
  if (!supabase) return
  try {
    // Attempt upsert into user_sandboxes table in Supabase
    await supabase.from('user_sandboxes').upsert({
      email: sandbox.email.toLowerCase(),
      sandbox_tables: sandbox.tables,
      editor_draft: sandbox.editorDraft,
      query_history: sandbox.queryHistory.slice(0, 100),
      chat_history: sandbox.chatHistory.slice(-50),
      updated_at: new Date().toISOString()
    }, { onConflict: 'email' })
  } catch (e) {
    // Cloud sync optional fallback
  }
}

function scheduleCloudSync(sandbox: UserSandbox) {
  const email = sandbox.email.toLowerCase()
  if (cloudSaveTimers.has(email)) {
    clearTimeout(cloudSaveTimers.get(email)!)
  }
  cloudSaveTimers.set(email, setTimeout(() => {
    void saveCloudSandbox(sandbox)
  }, 1200))
}

export const sandboxStore = {
  /** Subscribes to sandbox changes for a specific user */
  subscribe(callback: (email: string) => void) {
    listeners.add(callback)
    return () => { listeners.delete(callback) }
  },

  /** Gets or initializes a user's sandbox */
  getOrInit(email: string, defaultTables: SandboxTables): UserSandbox {
    const cleanEmail = email.toLowerCase()
    if (cache.has(cleanEmail)) {
      return cache.get(cleanEmail)!
    }

    const local = getLocalSandbox(cleanEmail)
    if (local && local.tables && local.tables.consumers) {
      cache.set(cleanEmail, local)
      return local
    }

    const newSandbox: UserSandbox = {
      email: cleanEmail,
      tables: JSON.parse(JSON.stringify(defaultTables)),
      editorDraft: DEFAULT_EDITOR_QUERY,
      queryHistory: [],
      chatHistory: [
        {
          id: 'welcome',
          sender: 'assistant',
          text: `Welcome to the GridFlow SQL Learner Console! I am your AI Query Mentor. You can write and execute SQL queries against your personal sandbox database. If you encounter any syntax or relational mistakes, I'll explain the error and help you fix it. Ask me any SQL questions anytime!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ],
      updatedAt: new Date().toISOString()
    }

    cache.set(cleanEmail, newSandbox)
    saveLocalSandbox(newSandbox)
    scheduleCloudSync(newSandbox)
    return newSandbox
  },

  /** Asynchronously pulls the latest cloud sandbox from Supabase */
  async pullCloud(email: string, defaultTables: SandboxTables): Promise<UserSandbox> {
    const cleanEmail = email.toLowerCase()
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('user_sandboxes')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle()

        if (data && !error && data.sandbox_tables) {
          const cloudSandbox: UserSandbox = {
            email: cleanEmail,
            tables: data.sandbox_tables,
            editorDraft: data.editor_draft || DEFAULT_EDITOR_QUERY,
            queryHistory: data.query_history || [],
            chatHistory: data.chat_history || [],
            updatedAt: data.updated_at || new Date().toISOString()
          }
          cache.set(cleanEmail, cloudSandbox)
          saveLocalSandbox(cloudSandbox)
          emit(cleanEmail)
          return cloudSandbox
        }
      } catch {
        // Fall back to local
      }
    }
    return this.getOrInit(cleanEmail, defaultTables)
  },

  /** Updates the active editor draft text */
  setEditorDraft(email: string, draft: string) {
    const cleanEmail = email.toLowerCase()
    const sandbox = cache.get(cleanEmail)
    if (!sandbox) return
    sandbox.editorDraft = draft
    sandbox.updatedAt = new Date().toISOString()
    saveLocalSandbox(sandbox)
    scheduleCloudSync(sandbox)
    emit(cleanEmail)
  },

  /** Appends an executed query to the user's history */
  addHistory(email: string, item: Omit<QueryHistoryItem, 'id' | 'executedAt'>) {
    const cleanEmail = email.toLowerCase()
    const sandbox = cache.get(cleanEmail)
    if (!sandbox) return
    const newItem: QueryHistoryItem = {
      ...item,
      id: `qh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      executedAt: new Date().toISOString()
    }
    sandbox.queryHistory = [newItem, ...sandbox.queryHistory.slice(0, 99)]
    sandbox.updatedAt = new Date().toISOString()
    saveLocalSandbox(sandbox)
    scheduleCloudSync(sandbox)
    emit(cleanEmail)
  },

  /** Appends a chat message to the AI Query Mentor drawer */
  addChatMessage(email: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) {
    const cleanEmail = email.toLowerCase()
    const sandbox = cache.get(cleanEmail)
    if (!sandbox) return
    const newMsg: ChatMessage = {
      ...message,
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    sandbox.chatHistory = [...sandbox.chatHistory, newMsg]
    sandbox.updatedAt = new Date().toISOString()
    saveLocalSandbox(sandbox)
    scheduleCloudSync(sandbox)
    emit(cleanEmail)
  },

  /** Updates the entire sandbox tables structure after a mutation */
  updateTables(email: string, newTables: SandboxTables) {
    const cleanEmail = email.toLowerCase()
    const sandbox = cache.get(cleanEmail)
    if (!sandbox) return
    sandbox.tables = newTables
    sandbox.updatedAt = new Date().toISOString()
    saveLocalSandbox(sandbox)
    scheduleCloudSync(sandbox)
    emit(cleanEmail)
  },

  /** 1-Click Rollback / Factory Reset to master database */
  resetSandbox(email: string, masterTables: SandboxTables): UserSandbox {
    const cleanEmail = email.toLowerCase()
    const current = cache.get(cleanEmail)
    const freshTables = JSON.parse(JSON.stringify(masterTables))

    const updatedSandbox: UserSandbox = {
      email: cleanEmail,
      tables: freshTables,
      editorDraft: current?.editorDraft || DEFAULT_EDITOR_QUERY,
      queryHistory: current?.queryHistory || [],
      chatHistory: [
        ...(current?.chatHistory || []),
        {
          id: `reset-${Date.now()}`,
          sender: 'assistant',
          text: 'Database successfully rolled back! All tables have been restored to the default Tamil Nadu master state.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ],
      updatedAt: new Date().toISOString()
    }

    cache.set(cleanEmail, updatedSandbox)
    saveLocalSandbox(updatedSandbox)
    void saveCloudSandbox(updatedSandbox)
    emit(cleanEmail)
    return updatedSandbox
  }
}

/** React hook for subscribing to a user's sandbox */
export function useUserSandbox(email: string | null | undefined, defaultTables: SandboxTables) {
  const [sandbox, setSandbox] = useState<UserSandbox | null>(() => {
    return email ? sandboxStore.getOrInit(email, defaultTables) : null
  })

  useEffect(() => {
    if (!email) {
      setSandbox(null)
      return
    }
    const current = sandboxStore.getOrInit(email, defaultTables)
    setSandbox(current)

    // Pull from cloud on mount
    void sandboxStore.pullCloud(email, defaultTables)

    return sandboxStore.subscribe(targetEmail => {
      if (targetEmail.toLowerCase() === email.toLowerCase()) {
        const updated = sandboxStore.getOrInit(email, defaultTables)
        setSandbox({ ...updated })
      }
    })
  }, [email])

  return sandbox
}

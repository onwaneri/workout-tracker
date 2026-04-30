import { openDB, type IDBPDatabase } from 'idb'
import { supabase } from '@/lib/supabase/client'

const DB_NAME = 'workout-offline'
const STORE = 'pending-mutations'

type PendingMutation = {
  id: string
  table: 'sessions' | 'session_sets' | 'goals' | 'plan_versions' | 'workout_days' | 'exercises' | 'plans'
  op: 'insert' | 'update' | 'delete'
  payload: Record<string, unknown>
  filter?: Record<string, unknown>
  ts: number
}

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

export async function enqueueMutation(m: Omit<PendingMutation, 'id' | 'ts'>): Promise<void> {
  const db = await getDb()
  const id = crypto.randomUUID()
  await db.put(STORE, { ...m, id, ts: Date.now() })
}

export async function pendingCount(): Promise<number> {
  const db = await getDb()
  return await db.count(STORE)
}

export async function drainQueue(): Promise<{ drained: number; failed: number }> {
  const db = await getDb()
  const all = (await db.getAll(STORE)) as PendingMutation[]
  let drained = 0
  let failed = 0
  for (const m of all.sort((a, b) => a.ts - b.ts)) {
    try {
      const tbl = supabase.from(m.table)
      let res
      if (m.op === 'insert') {
        res = await tbl.insert(m.payload as never)
      } else if (m.op === 'update') {
        let q = tbl.update(m.payload as never)
        for (const [k, v] of Object.entries(m.filter ?? {})) q = q.eq(k as never, v as never)
        res = await q
      } else {
        let q = tbl.delete()
        for (const [k, v] of Object.entries(m.filter ?? {})) q = q.eq(k as never, v as never)
        res = await q
      }
      if (res.error) {
        failed += 1
        continue
      }
      await db.delete(STORE, m.id)
      drained += 1
    } catch {
      failed += 1
    }
  }
  return { drained, failed }
}

export function setupQueueDrainTriggers(onDrained?: () => void) {
  const tryDrain = async () => {
    if (!navigator.onLine) return
    const { drained } = await drainQueue()
    if (drained > 0 && onDrained) onDrained()
  }
  window.addEventListener('online', tryDrain)
  window.addEventListener('focus', tryDrain)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tryDrain()
  })
  // initial drain on boot
  tryDrain()
}

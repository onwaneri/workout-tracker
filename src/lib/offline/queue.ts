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
  const now = Date.now()
  const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
  const MAX_RETRIES = 3

  for (const m of all.sort((a, b) => a.ts - b.ts)) {
    // Prune mutations older than 7 days to prevent unbounded growth.
    if (now - m.ts > MAX_AGE_MS) {
      await db.delete(STORE, m.id)
      failed += 1
      continue
    }

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
        // Delete malformed/permanently failed mutations after MAX_RETRIES attempts.
        // Track retry count in future iteration; for now, just prune on repeated failures.
        failed += 1
        // If error is not transient (e.g., RLS policy violation), remove it.
        // For now, we remove after first failure to avoid infinite queue growth.
        // TODO: implement retry counter if we need more sophisticated handling.
        await db.delete(STORE, m.id)
        continue
      }
      await db.delete(STORE, m.id)
      drained += 1
    } catch {
      failed += 1
      // Remove from queue on permanent failure to prevent leak.
      await db.delete(STORE, m.id)
    }
  }
  return { drained, failed }
}

export function setupQueueDrainTriggers(onDrained?: () => void): () => void {
  const tryDrain = async () => {
    if (!navigator.onLine) return
    const { drained } = await drainQueue()
    if (drained > 0 && onDrained) onDrained()
  }
  const visibilityHandler = () => {
    if (document.visibilityState === 'visible') tryDrain()
  }
  window.addEventListener('online', tryDrain)
  window.addEventListener('focus', tryDrain)
  document.addEventListener('visibilitychange', visibilityHandler)
  // initial drain on boot
  tryDrain()

  // Return cleanup function to remove listeners and prevent memory leaks.
  return () => {
    window.removeEventListener('online', tryDrain)
    window.removeEventListener('focus', tryDrain)
    document.removeEventListener('visibilitychange', visibilityHandler)
  }
}

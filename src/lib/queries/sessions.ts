import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { getClientUuid } from '@/lib/supabase/uuid'
import type { Session, SessionSet } from '@/lib/supabase/database.types'
import { qk } from './keys'
import { enqueueMutation } from '@/lib/offline/queue'

async function fetchSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('started_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

async function fetchSession(id: string): Promise<Session | null> {
  const { data, error } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

async function fetchSessionSets(sessionId: string): Promise<SessionSet[]> {
  const { data, error } = await supabase
    .from('session_sets')
    .select('*')
    .eq('session_id', sessionId)
    .order('set_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

async function fetchExerciseHistory(exerciseIds: string[]): Promise<SessionSet[]> {
  if (exerciseIds.length === 0) return []
  const { data, error } = await supabase
    .from('session_sets')
    .select('*')
    .in('exercise_id', exerciseIds)
    .order('logged_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export const useSessions = () => useQuery({ queryKey: qk.sessions(), queryFn: fetchSessions })

export const useSession = (id: string | undefined) =>
  useQuery({ queryKey: qk.session(id ?? ''), queryFn: () => fetchSession(id!), enabled: !!id })

export const useSessionSets = (sessionId: string | undefined) =>
  useQuery({
    queryKey: qk.sessionSets(sessionId ?? ''),
    queryFn: () => fetchSessionSets(sessionId!),
    enabled: !!sessionId,
  })

export const useExerciseHistory = (exerciseIds: string[]) =>
  useQuery({
    queryKey: qk.exerciseHistory(exerciseIds.join(',')),
    queryFn: () => fetchExerciseHistory(exerciseIds),
    enabled: exerciseIds.length > 0,
  })

export const useStartSession = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { plan_version_id: string; workout_day_id: string }) => {
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          client_uuid: getClientUuid(),
          plan_version_id: input.plan_version_id,
          workout_day_id: input.workout_day_id,
        })
        .select('*')
        .single()
      if (error) throw error
      return data as Session
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.sessions() }),
  })
}

export const useEndSession = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      foreground_ms: number
      background_ms: number
    }): Promise<Session> => {
      const payload = {
        ended_at: new Date().toISOString(),
        foreground_ms: input.foreground_ms,
        background_ms: input.background_ms,
      }
      const filter = { id: input.id }
      try {
        const { data, error } = await supabase
          .from('sessions')
          .update(payload)
          .eq('id', input.id)
          .select('*')
          .single()
        if (error) throw error
        return data as Session
      } catch (err) {
        if (!navigator.onLine || err instanceof TypeError) {
          await enqueueMutation({ table: 'sessions', op: 'update', payload, filter })
          const cached =
            qc.getQueryData<Session>(qk.session(input.id)) ??
            qc.getQueryData<Session[]>(qk.sessions())?.find((s) => s.id === input.id)
          if (cached) return { ...cached, ...payload }
          return {
            id: input.id,
            client_uuid: getClientUuid(),
            plan_version_id: '',
            workout_day_id: '',
            started_at: payload.ended_at,
            ended_at: payload.ended_at,
            foreground_ms: payload.foreground_ms,
            background_ms: payload.background_ms,
          }
        }
        throw err
      }
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: qk.sessions() })
      qc.invalidateQueries({ queryKey: qk.session(s.id) })
    },
  })
}

export const useLogSet = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      input: Omit<SessionSet, 'id' | 'client_uuid' | 'logged_at' | 'rest_ms' | 'rest_target_seconds'> & {
        logged_at?: string
        rest_ms?: number | null
        rest_target_seconds?: number | null
      },
    ): Promise<SessionSet> => {
      const payload = { ...input, client_uuid: getClientUuid() }
      try {
        const { data, error } = await supabase.from('session_sets').insert(payload).select('*').single()
        if (error) throw error
        return data as SessionSet
      } catch (err) {
        // Network failure — enqueue and return an optimistic row so the UI updates.
        if (!navigator.onLine || (err instanceof TypeError)) {
          await enqueueMutation({ table: 'session_sets', op: 'insert', payload })
          return {
            id: crypto.randomUUID(),
            client_uuid: payload.client_uuid,
            session_id: input.session_id,
            exercise_id: input.exercise_id,
            set_order: input.set_order,
            weight: input.weight ?? null,
            reps: input.reps ?? null,
            rpe: input.rpe ?? null,
            is_warmup: input.is_warmup,
            is_skipped: input.is_skipped,
            note: input.note ?? null,
            logged_at: input.logged_at ?? new Date().toISOString(),
            rest_ms: input.rest_ms ?? null,
            rest_target_seconds: input.rest_target_seconds ?? null,
          }
        }
        throw err
      }
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: qk.sessionSets(s.session_id) })
      qc.invalidateQueries({ queryKey: qk.exerciseHistory(s.exercise_id) })
    },
  })
}

export const useUpdateSetRest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { setId: string; sessionId: string; restMs: number }) => {
      const filter = { id: input.setId }
      const payload = { rest_ms: input.restMs }
      try {
        const { error } = await supabase.from('session_sets').update(payload).eq('id', input.setId)
        if (error) throw error
      } catch (err) {
        if (!navigator.onLine || err instanceof TypeError) {
          await enqueueMutation({ table: 'session_sets', op: 'update', payload, filter })
          return
        }
        throw err
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.sessionSets(vars.sessionId) })
    },
  })
}

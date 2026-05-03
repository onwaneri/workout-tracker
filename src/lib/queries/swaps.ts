import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { getClientUuid } from '@/lib/supabase/uuid'
import type { SessionExerciseSwap } from '@/lib/supabase/database.types'
import { qk } from './keys'

async function fetchSessionSwaps(sessionId: string): Promise<SessionExerciseSwap[]> {
  const { data, error } = await supabase
    .from('session_exercise_swaps')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const useSessionSwaps = (sessionId: string | undefined) =>
  useQuery({
    queryKey: qk.sessionSwaps(sessionId ?? ''),
    queryFn: () => fetchSessionSwaps(sessionId!),
    enabled: !!sessionId,
  })

export const useCreateSwap = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      session_id: string
      planned_exercise_id: string
      performed_exercise_name: string
      performed_muscle_group: string
      performed_type: 'compound' | 'isolation'
      reason: string | null
    }): Promise<SessionExerciseSwap> => {
      const { data, error } = await supabase
        .from('session_exercise_swaps')
        .insert({ ...input, client_uuid: getClientUuid() })
        .select('*')
        .single()
      if (error) throw error
      return data as SessionExerciseSwap
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: qk.sessionSwaps(s.session_id) })
    },
  })
}

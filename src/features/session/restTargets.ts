import type { ExerciseType } from '@/lib/supabase/database.types'

// README §3: compound 2–3 min, isolation 1.5–2 min — pick midpoints.
export const restTargetSeconds = (type: ExerciseType): number => (type === 'compound' ? 150 : 105)

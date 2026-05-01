// Hand-maintained from supabase/migrations. Re-generate with `supabase gen types typescript`
// once the migrations are applied to the remote project.

export type ExerciseType = 'compound' | 'isolation'

export type Plan = {
  id: string
  client_uuid: string
  name: string
  created_at: string
}

export type PlanVersion = {
  id: string
  plan_id: string
  client_uuid: string
  version_number: number
  is_active: boolean
  created_at: string
}

export type WorkoutDay = {
  id: string
  plan_version_id: string
  client_uuid: string
  name: string
  order_index: number
  is_rest: boolean
  created_at: string
}

export type Exercise = {
  id: string
  workout_day_id: string
  client_uuid: string
  name: string
  muscle_group: string
  type: ExerciseType
  order_index: number
  default_sets: number
  previous_exercise_id: string | null
  created_at: string
}

export type Session = {
  id: string
  client_uuid: string
  plan_version_id: string
  workout_day_id: string
  started_at: string
  ended_at: string | null
  foreground_ms: number
  background_ms: number
}

export type SessionSet = {
  id: string
  session_id: string
  exercise_id: string
  client_uuid: string
  set_order: number
  weight: number | null
  reps: number | null
  rpe: number | null
  is_warmup: boolean
  is_skipped: boolean
  note: string | null
  logged_at: string
  rest_ms: number | null
  rest_target_seconds: number | null
}

export type Goal = {
  id: string
  client_uuid: string
  exercise_id: string | null
  muscle_group: string | null
  target_weight: number | null
  target_reps: number | null
  weekly_volume_target: number | null
  created_at: string
}

type Table<Row, Insert, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

type PlanInsert = { client_uuid: string; name: string; id?: string; created_at?: string }
type PlanVersionInsert = {
  plan_id: string
  client_uuid: string
  version_number: number
  is_active?: boolean
  id?: string
  created_at?: string
}
type WorkoutDayInsert = {
  plan_version_id: string
  client_uuid: string
  name: string
  order_index: number
  is_rest?: boolean
  id?: string
  created_at?: string
}
type ExerciseInsert = {
  workout_day_id: string
  client_uuid: string
  name: string
  muscle_group: string
  type: ExerciseType
  order_index: number
  default_sets?: number
  previous_exercise_id?: string | null
  id?: string
  created_at?: string
}
type SessionInsert = {
  client_uuid: string
  plan_version_id: string
  workout_day_id: string
  started_at?: string
  ended_at?: string | null
  foreground_ms?: number
  background_ms?: number
  id?: string
}
type SessionSetInsert = {
  session_id: string
  exercise_id: string
  client_uuid: string
  set_order: number
  weight?: number | null
  reps?: number | null
  rpe?: number | null
  is_warmup?: boolean
  is_skipped?: boolean
  note?: string | null
  logged_at?: string
  rest_ms?: number | null
  rest_target_seconds?: number | null
  id?: string
}
type GoalInsert = {
  client_uuid: string
  exercise_id?: string | null
  muscle_group?: string | null
  target_weight?: number | null
  target_reps?: number | null
  weekly_volume_target?: number | null
  id?: string
  created_at?: string
}

export type Database = {
  __InternalSupabase: { PostgrestVersion: '12' }
  public: {
    Tables: {
      plans: Table<Plan, PlanInsert>
      plan_versions: Table<PlanVersion, PlanVersionInsert>
      workout_days: Table<WorkoutDay, WorkoutDayInsert>
      exercises: Table<Exercise, ExerciseInsert>
      sessions: Table<Session, SessionInsert>
      session_sets: Table<SessionSet, SessionSetInsert>
      goals: Table<Goal, GoalInsert>
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

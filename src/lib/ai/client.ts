import { getClientUuid } from '@/lib/supabase/uuid'
import { aiPlanEditResultSchema, exerciseSwapResponseSchema, sessionInsightsSchema, generatedPlanSchema, goalSuggestionsResponseSchema } from './schemas'
import type { AiPlanEditResult, ExerciseSwapResponse, SessionInsights, GeneratedPlan, GoalSuggestionsResponse } from './schemas'
import type { ExerciseType, EquipmentType } from '@/lib/supabase/database.types'

const AI_BASE = '/api/ai'
const CLIENT_UUID = getClientUuid() // Evaluate once at module load to avoid redundant calls

async function aiPost<T>(
  path: string,
  body: unknown,
  validator: (data: unknown) => T,
): Promise<T> {
  const res = await fetch(`${AI_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-uuid': CLIENT_UUID,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error ?? `AI request failed (${res.status})`)
  }

  const data = await res.json()
  return validator(data)
}

export type PlanSnapshot = {
  days: Array<{
    name: string
    is_rest: boolean
    exercises: Array<{
      name: string
      muscle_group: string
      type: ExerciseType
      equipment: EquipmentType
      default_sets: number
    }>
  }>
}

type ConversationTurn = { role: 'user' | 'assistant'; content: string }

export async function requestPlanEdit(
  plan: PlanSnapshot,
  instruction: string,
  conversationHistory?: ConversationTurn[],
): Promise<AiPlanEditResult> {
  return aiPost(
    '/plan-edit',
    { plan, instruction, conversationHistory },
    (data) => aiPlanEditResultSchema.parse(data),
  )
}

export async function requestExerciseSwap(
  exercise: { name: string; muscle_group: string; type: ExerciseType },
  reason: string,
): Promise<ExerciseSwapResponse> {
  return aiPost(
    '/exercise-swap',
    { exercise, reason },
    (data) => exerciseSwapResponseSchema.parse(data),
  )
}

export type SessionInsightsPayload = {
  workoutDayName: string
  exercises: Array<{
    name: string
    muscle_group: string
    current: { bestWeight: number | null; totalReps: number; avgRpe: number | null; workingSets: number }
    prior: { bestWeight: number | null; totalReps: number; avgRpe: number | null; workingSets: number }
  }>
}

export async function requestSessionInsights(
  payload: SessionInsightsPayload,
): Promise<SessionInsights> {
  return aiPost(
    '/session-insights',
    payload,
    (data) => sessionInsightsSchema.parse(data),
  )
}

export async function requestPlanGenerate(
  prompt: string,
): Promise<GeneratedPlan> {
  return aiPost(
    '/plan-generate',
    { prompt },
    (data) => generatedPlanSchema.parse(data),
  )
}

export type GoalSuggestionsPayload = {
  exercises: Array<{
    name: string
    muscle_group: string
    type: string
    equipment: string
    recentSets: Array<{ weight: number | null; reps: number | null; rpe: number | null; logged_at: string }>
  }>
}

export async function requestGoalSuggestions(
  payload: GoalSuggestionsPayload,
): Promise<GoalSuggestionsResponse> {
  return aiPost(
    '/goal-suggestions',
    payload,
    (data) => goalSuggestionsResponseSchema.parse(data),
  )
}

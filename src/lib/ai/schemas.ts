import { z } from 'zod'

// ─── Plan Edit Diff Schema ────────────────────────────────────────
export const exerciseDiffSchema = z.object({
  name: z.string(),
  muscle_group: z.string(),
  type: z.enum(['compound', 'isolation']),
  default_sets: z.number().int().min(1).max(10),
})

export const planEditActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    day_index: z.number().int().min(0),
    position: z.number().int().min(0),
    exercise: exerciseDiffSchema,
  }),
  z.object({
    action: z.literal('remove'),
    day_index: z.number().int().min(0),
    exercise_name: z.string(),
  }),
  z.object({
    action: z.literal('edit'),
    day_index: z.number().int().min(0),
    exercise_name: z.string(),
    changes: exerciseDiffSchema.partial(),
  }),
  z.object({
    action: z.literal('reorder'),
    day_index: z.number().int().min(0),
    exercise_name: z.string(),
    new_position: z.number().int().min(0),
  }),
])

export const planEditResponseSchema = z.object({
  type: z.literal('diff'),
  changes: z.array(planEditActionSchema),
  summary: z.string(),
})

export const planEditClarificationSchema = z.object({
  type: z.literal('clarification'),
  question: z.string(),
})

export const aiPlanEditResultSchema = z.discriminatedUnion('type', [
  planEditResponseSchema,
  planEditClarificationSchema,
])

export type PlanEditAction = z.infer<typeof planEditActionSchema>
export type PlanEditResponse = z.infer<typeof planEditResponseSchema>
export type PlanEditClarification = z.infer<typeof planEditClarificationSchema>
export type AiPlanEditResult = z.infer<typeof aiPlanEditResultSchema>

// ─── Exercise Swap Schema ─────────────────────────────────────────
export const swapSuggestionSchema = z.object({
  name: z.string(),
  muscle_group: z.string(),
  type: z.enum(['compound', 'isolation']),
  rationale: z.string(),
})

export const exerciseSwapResponseSchema = z.object({
  suggestions: z.array(swapSuggestionSchema).min(1).max(5),
})

export type SwapSuggestion = z.infer<typeof swapSuggestionSchema>
export type ExerciseSwapResponse = z.infer<typeof exerciseSwapResponseSchema>

// ─── Session Insights Schema ──────────────────────────────────────
export const sessionInsightRowSchema = z.object({
  exerciseName: z.string(),
  delta: z.string(),
  direction: z.enum(['up', 'down', 'same']),
  note: z.string().optional(),
})

export const sessionInsightsSchema = z.object({
  headline: z.string(),
  rows: z.array(sessionInsightRowSchema),
  callout: z.string().nullable(),
})

export type SessionInsightRow = z.infer<typeof sessionInsightRowSchema>
export type SessionInsights = z.infer<typeof sessionInsightsSchema>

import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { goalSuggestionsResponseSchema } from '../../src/lib/ai/schemas.js'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000

function checkRateLimit(clientUuid: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(clientUuid)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(clientUuid, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

const SYSTEM_PROMPT = `You are a strength training coach setting next-session goals for a trainee.
For each exercise, you receive recent performance data (last 3-5 sessions of sets: weight, reps, RPE).

GOAL-SETTING PRINCIPLES:
- Progressive overload: increase weight by smallest increment (2.5-5 lbs) when all target reps are hit at RPE < 9
- If RPE was 9-10 on last session, keep same weight but aim for +1 rep
- If RPE was 10 and reps declined, suggest same weight and same reps (consolidation)
- For bodyweight exercises (null weight), progress via reps only
- If no history exists for an exercise, return null for both (user should set manually)
- Reps targets should be integers within the exercise's typical range (compounds 5-12, isolations 8-20)

OUTPUT:
Return JSON with "suggestions" array, one per exercise provided:
- exercise_name: exactly as provided in input
- target_weight: number in lbs (or null for bodyweight/no-history)
- target_reps: integer (or null if no history)
- rationale: 1 short sentence explaining the suggestion

Return raw JSON only, no markdown fences.`

const recentSetSchema = z.object({
  weight: z.number().nullable(),
  reps: z.number().nullable(),
  rpe: z.number().nullable(),
  logged_at: z.string(),
})

const exerciseInputSchema = z.object({
  name: z.string(),
  muscle_group: z.string(),
  type: z.string(),
  recentSets: z.array(recentSetSchema),
})

const requestBodySchema = z.object({
  exercises: z.array(exerciseInputSchema).min(1),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const clientUuid = req.headers['x-client-uuid'] as string | undefined
  if (!clientUuid) {
    return res.status(401).json({ error: 'Missing x-client-uuid header' })
  }

  if (!checkRateLimit(clientUuid)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'AI features not configured (missing API key)' })
  }

  const parsed = requestBodySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
  }

  const { exercises } = parsed.data

  const exerciseSummary = exercises
    .map((e) => {
      const setsText =
        e.recentSets.length === 0
          ? '  No history'
          : e.recentSets
              .map(
                (s) =>
                  `  ${s.logged_at}: ${s.weight ?? 'BW'} lbs x ${s.reps ?? '?'} reps${s.rpe != null ? ` @ RPE ${s.rpe}` : ''}`,
              )
              .join('\n')
      return `${e.name} (${e.muscle_group}, ${e.type}):\n${setsText}`
    })
    .join('\n\n')

  const userMessage = `Set goals for these exercises:\n\n${exerciseSummary}`

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: '{' },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return res.status(500).json({ error: 'No text response from AI' })
    }

    const jsonText = '{' + textBlock.text
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch (parseErr) {
      console.error('[goal-suggestions] AI returned invalid JSON:', jsonText.slice(0, 500))
      return res.status(502).json({ error: 'AI returned invalid JSON' })
    }

    const validated = goalSuggestionsResponseSchema.safeParse(parsed)
    if (!validated.success) {
      return res.status(502).json({
        error: 'AI returned invalid goal structure',
        details: validated.error.flatten(),
      })
    }

    return res.status(200).json(validated.data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(502).json({ error: `AI request failed: ${message}` })
  }
}

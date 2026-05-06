import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

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

const SYSTEM_PROMPT = `You analyze a strength training session vs the previous session for the same workout type.
You are given pre-computed per-exercise stats (best weight, total reps, avg RPE, working sets) for both sessions.
Return a JSON insights object. Rules:
- headline: 1 concise sentence summarizing overall direction (stronger, similar, off day, etc.)
- rows: one object per exercise, ordered by most positive delta first
  - exerciseName: the exercise name exactly as provided
  - delta: the most meaningful single change as a short string: "+5 lbs", "+2 reps", "—", "-5 lbs", "skipped"
  - direction: "up" if improved, "down" if declined, "same" if no meaningful change
  - note: include ONLY if there is a notable RPE signal (e.g. "RPE down 1.5" or "RPE up 2"); omit otherwise
- callout: a single sentence if something stands out across the session (e.g. RPE spike across the board, multiple stalls); null if nothing is particularly notable
Return raw JSON only, no markdown fences.

RESPONSE SCHEMA:
{
  "headline": "...",
  "rows": [
    { "exerciseName": "...", "delta": "...", "direction": "up"|"down"|"same", "note": "..." },
    ...
  ],
  "callout": "..." | null
}`

const exerciseStatSchema = z.object({
  name: z.string(),
  muscle_group: z.string(),
  current: z.object({
    bestWeight: z.number().nullable(),
    totalReps: z.number(),
    avgRpe: z.number().nullable(),
    workingSets: z.number(),
  }),
  prior: z.object({
    bestWeight: z.number().nullable(),
    totalReps: z.number(),
    avgRpe: z.number().nullable(),
    workingSets: z.number(),
  }),
})

const requestBodySchema = z.object({
  workoutDayName: z.string(),
  exercises: z.array(exerciseStatSchema).min(1),
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

  const { workoutDayName, exercises } = parsed.data

  const exerciseSummary = exercises
    .map((e) => {
      const cur = e.current
      const pri = e.prior
      return [
        `${e.name} (${e.muscle_group}):`,
        `  Current:  best ${cur.bestWeight ?? 'BW'} lbs × ${cur.totalReps} total reps, ${cur.workingSets} working sets${cur.avgRpe != null ? `, avg RPE ${cur.avgRpe.toFixed(1)}` : ''}`,
        `  Previous: best ${pri.bestWeight ?? 'BW'} lbs × ${pri.totalReps} total reps, ${pri.workingSets} working sets${pri.avgRpe != null ? `, avg RPE ${pri.avgRpe.toFixed(1)}` : ''}`,
      ].join('\n')
    })
    .join('\n\n')

  const userMessage = `Workout: ${workoutDayName}\n\n${exerciseSummary}`

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
      messages: [{ role: 'user', content: userMessage }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return res.status(500).json({ error: 'No text response from AI' })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(textBlock.text)
    } catch {
      return res.status(502).json({ error: 'AI returned invalid JSON', raw: textBlock.text })
    }

    return res.status(200).json(parsed)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(502).json({ error: `AI request failed: ${message}` })
  }
}

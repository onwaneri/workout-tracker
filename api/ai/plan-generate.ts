import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { generatedPlanSchema } from '../../src/lib/ai/schemas.js'

// Simple in-memory rate limiting: max 20 requests per minute per client
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000
const MAX_RATE_LIMIT_ENTRIES = 10000

function checkRateLimit(clientUuid: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(clientUuid)

  // Prune expired entries if map is getting large (prevents memory leak)
  if (rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetAt) {
        rateLimitMap.delete(key)
      }
    }
  }

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(clientUuid, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

const SYSTEM_PROMPT = `You are a workout plan generator for a gym training app. Generate structured workout plans based on the user's request.

TRAINING SCIENCE GUIDELINES:
- Volume: 10-20 sets per muscle group per week (MEV ~8-10, MAV ~12-18, MRV ~20-25)
- Frequency: Each muscle group trained 2-3x per week minimum
- Exercise selection: 1 compound + 1-2 isolations per muscle group per session
- Default sets per exercise: 2 (the app uses 2 sets to failure as default)
- Rep ranges: compounds 6-12, isolations 10-20 (not included in output, just guides exercise choice)
- Rest between sets: compounds 2-3 min, isolations 1-2 min (not in output)

SPLIT TEMPLATES (guide, not rigid):
- 3 days: Full Body (3 training days, rest days fill the cycle)
- 4 days: Upper/Lower (2 upper + 2 lower + rest days)
- 5 days: Upper/Lower/Push/Pull/Legs or similar hybrid
- 6 days: PPL (Push/Pull/Legs repeated twice)
- 7 days: Upper/Lower with rest days (e.g. U/L/Rest/U/L/Rest/Rest)

MUSCLE GROUPS TO COVER:
Chest, Back/Lats, Front Delts, Side Delts, Rear Delts, Triceps, Biceps, Quads, Hamstrings, Glutes, Calves

EXERCISE SELECTION RULES:
- Start each training day with compound movements
- Add isolations after compounds to reach volume targets
- Muscles needing direct work (not enough from compounds alone): side delts, rear delts, biceps, calves
- Each training day should have 4-9 exercises
- Rest days must have is_rest: true and an empty exercises array
- Total days in the plan should be 3-10 (forming a repeating cycle)

OUTPUT FORMAT:
Return a JSON object with:
- name: a short descriptive plan name (e.g. "4-Day Upper/Lower", "PPL 6-Day")
- days: array of day objects, each with:
  - name: day label (e.g. "Upper A", "Lower — Quad Focus", "Rest")
  - is_rest: boolean
  - exercises: array (empty for rest days) of:
    - name: exercise name
    - muscle_group: primary muscle targeted
    - type: "compound" or "isolation"
    - default_sets: 2 (always 2 unless user explicitly requests otherwise)

IMPORTANT:
- Always default to 2 sets per exercise unless the user explicitly requests a different number
- The plan forms a repeating cycle (not tied to calendar weekdays)
- Include rest days in the cycle
- Generate practical, gym-friendly exercises (standard barbell, dumbbell, cable, machine equipment)
- Match the user's stated goals, experience level, and available days
- Only return raw JSON, no markdown fences or extra text`

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

  const { prompt } = req.body ?? {}
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Missing prompt in request body' })
  }

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6', // Balanced speed/quality for plan generation
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return res.status(500).json({ error: 'No text response from AI' })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(textBlock.text)
    } catch (parseErr) {
      console.error('[plan-generate] AI returned invalid JSON:', textBlock.text.slice(0, 500))
      return res.status(502).json({ error: 'AI returned invalid JSON' })
    }

    // Validate response against schema before returning
    const validated = generatedPlanSchema.safeParse(parsed)
    if (!validated.success) {
      return res.status(502).json({
        error: 'AI returned invalid plan structure',
        details: validated.error.flatten(),
      })
    }

    return res.status(200).json(validated.data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(502).json({ error: `AI request failed: ${message}` })
  }
}

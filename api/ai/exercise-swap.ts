import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { TRAINING_GUIDELINES } from './training-guidelines.js'

// Simple in-memory rate limiting: max 20 requests per minute per client
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

const SYSTEM_PROMPT = `You are an AI assistant for a workout app. The user needs to substitute an exercise during their session.

Given:
- The exercise they want to swap out
- Its muscle group and type (compound/isolation)
- The reason for swapping (e.g., equipment taken, injury)

Return exactly 3 alternative exercises ranked by suitability. Each alternative should target the same muscle group and match the movement pattern as closely as possible given the constraint.

RULES:
- Return valid JSON only, no markdown fences.
- Each suggestion must include name, muscle_group, type (compound/isolation), equipment (barbell/dumbbell/machine/cable/bodyweight), and a one-sentence rationale.
- Consider the reason: if it's equipment-related, suggest alternatives using different equipment. If it's pain/injury-related, suggest gentler variants.
- Keep suggestions practical for a typical commercial gym.

${TRAINING_GUIDELINES}
When suggesting alternatives, prefer swaps that preserve the session's role for that exercise. If swapping a compound, suggest compounds first. If swapping an isolation, suggest isolations that target the same muscle group. Avoid suggesting exercises that would create redundancy with other exercises the user likely has in the same session.

RESPONSE SCHEMA:
{
  "suggestions": [
    { "name": "...", "muscle_group": "...", "type": "compound"|"isolation", "equipment": "barbell"|"dumbbell"|"machine"|"cable"|"bodyweight", "rationale": "..." },
    { "name": "...", "muscle_group": "...", "type": "compound"|"isolation", "equipment": "barbell"|"dumbbell"|"machine"|"cable"|"bodyweight", "rationale": "..." },
    { "name": "...", "muscle_group": "...", "type": "compound"|"isolation", "equipment": "barbell"|"dumbbell"|"machine"|"cable"|"bodyweight", "rationale": "..." }
  ]
}

Only return raw JSON.`

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

  const { exercise, reason } = req.body ?? {}
  if (!exercise || !exercise.name || !exercise.muscle_group || !exercise.type) {
    return res.status(400).json({ error: 'Missing exercise details in request body' })
  }

  const userMessage = `Exercise to swap: ${exercise.name}
Muscle group: ${exercise.muscle_group}
Type: ${exercise.type}
Reason for swap: ${reason || 'No specific reason given'}`

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

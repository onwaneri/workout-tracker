import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

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

const SYSTEM_PROMPT = `You are an AI assistant for a workout plan editor. The user will provide their current workout plan and an instruction to modify it.

Your job is to return a structured JSON diff of changes to apply to the plan. The plan has workout days, each with ordered exercises.

RULES:
- Only output valid JSON matching one of the two schemas below.
- If the instruction is ambiguous and you need clarification, return a clarification response.
- Never invent exercises that don't make sense for the stated muscle group.
- Maintain exercise type accuracy (compound vs isolation).
- Preserve the user's existing structure as much as possible.
- Position indexes are 0-based within each day's exercise list.

RESPONSE SCHEMAS:

1. Diff response (when you can determine the changes):
{
  "type": "diff",
  "changes": [
    { "action": "add", "day_index": 0, "position": 2, "exercise": { "name": "...", "muscle_group": "...", "type": "compound"|"isolation", "default_sets": 2 } },
    { "action": "remove", "day_index": 0, "exercise_name": "..." },
    { "action": "edit", "day_index": 0, "exercise_name": "...", "changes": { "name": "...", "muscle_group": "...", "type": "...", "default_sets": ... } },
    { "action": "reorder", "day_index": 0, "exercise_name": "...", "new_position": 3 }
  ],
  "summary": "Brief human-readable description of what changed"
}

2. Clarification response (when the instruction is ambiguous):
{
  "type": "clarification",
  "question": "Your clarifying question here"
}

Only return raw JSON, no markdown fences or extra text.`

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

  const { plan, instruction, conversationHistory } = req.body ?? {}
  if (!plan || !instruction) {
    return res.status(400).json({ error: 'Missing plan or instruction in request body' })
  }

  const planSnapshot = JSON.stringify(plan, null, 2)

  const messages: Anthropic.MessageParam[] = []

  // Include any prior conversation turns for multi-turn clarification
  if (Array.isArray(conversationHistory)) {
    for (const turn of conversationHistory) {
      messages.push(turn)
    }
  }

  messages.push({
    role: 'user',
    content: `Here is the current workout plan:\n\n${planSnapshot}\n\nInstruction: ${instruction}`,
  })

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: `Current plan snapshot for reference:\n${planSnapshot}`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return res.status(500).json({ error: 'No text response from AI' })
    }

    // Try to parse as JSON
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

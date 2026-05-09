import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/Button'
import { requestPlanEdit, type PlanSnapshot } from '@/lib/ai/client'
import type { AiPlanEditResult, PlanEditAction } from '@/lib/ai/schemas'
import type { EditedPlan } from './snapshotPlan'
import { AiDiffPreview } from './AiDiffPreview'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  diff?: PlanEditAction[]
  summary?: string
}

export function AiPlanChat({
  draft,
  onApplyDiff,
}: {
  draft: EditedPlan
  onApplyDiff: (actions: PlanEditAction[]) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDiff, setPendingDiff] = useState<PlanEditAction[] | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track online state
  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const planSnapshot = useMemo<PlanSnapshot>(() => ({
    days: draft.days.map((d) => ({
      name: d.name,
      is_rest: d.is_rest,
      exercises: d.exercises.map((e) => ({
        name: e.name,
        muscle_group: e.muscle_group,
        type: e.type,
        default_sets: e.default_sets,
      })),
    })),
  }), [draft])

  const handleSubmit = async () => {
    if (!input.trim() || loading || !isOnline) return

    const userMsg = input.trim()
    setInput('')
    setError(null)
    setPendingDiff(null)

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      // Build conversation history for multi-turn
      const history = newMessages.slice(0, -1).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      const result: AiPlanEditResult = await requestPlanEdit(planSnapshot, userMsg, history)

      if (result.type === 'clarification') {
        setMessages([...newMessages, { role: 'assistant', content: result.question }])
      } else {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: result.summary, diff: result.changes, summary: result.summary },
        ])
        setPendingDiff(result.changes)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (pendingDiff) {
      onApplyDiff(pendingDiff)
      setPendingDiff(null)
      setMessages([])
    }
  }

  const handleReject = useCallback(() => {
    setPendingDiff(null)
    setMessages((msgs) => [...msgs, { role: 'assistant', content: 'Changes discarded. What else would you like to change?' }])
  }, [])

  const handleRetry = useCallback(() => {
    setError(null)
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }, [handleSubmit])

  return (
    <div className="mt-6 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-300">
          AI
        </div>
        <span className="text-sm font-medium">Plan Assistant</span>
      </div>

      {/* Message history */}
      {messages.length > 0 && (
        <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`text-sm rounded-lg px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-[color:var(--color-accent)]/10 text-[color:var(--color-text)] ml-8'
                  : 'bg-white/5 text-[color:var(--color-text)] mr-8'
              }`}
            >
              {msg.content}
            </div>
          ))}
        </div>
      )}

      {/* Diff preview */}
      {pendingDiff && (
        <AiDiffPreview
          actions={pendingDiff}
          draft={draft}
          onApply={handleApply}
          onReject={handleReject}
        />
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 mb-3 text-sm text-[color:var(--color-muted)]">
          <div className="w-4 h-4 border-2 border-[color:var(--color-muted)] border-t-transparent rounded-full animate-spin" />
          Thinking…
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mb-3 text-sm text-red-300 bg-red-500/10 rounded-lg px-3 py-2 flex items-center justify-between">
          <span>{error}</span>
          <button
            className="text-xs underline min-h-[44px] px-2"
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isOnline ? 'e.g. "Swap incline press for barbell bench"' : 'AI unavailable offline'}
          disabled={!isOnline || loading}
          className="flex-1 min-h-[44px] px-3 rounded-xl bg-white/5 border border-[color:var(--color-border)] text-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-muted)] disabled:opacity-50"
        />
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!input.trim() || loading || !isOnline}
        >
          Send
        </Button>
      </div>
    </div>
  )
}

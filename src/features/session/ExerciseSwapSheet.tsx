import { useState } from 'react'
import { BottomSheet } from '@/components/BottomSheet'
import { Button } from '@/components/Button'
import { requestExerciseSwap } from '@/lib/ai/client'
import type { SwapSuggestion } from '@/lib/ai/schemas'
import type { Exercise } from '@/lib/supabase/database.types'
import { findMatchingExerciseId } from '@/lib/queries/exercises'

export function ExerciseSwapSheet({
  exercise,
  open,
  onClose,
  onSwap,
  allExercises,
}: {
  exercise: Exercise
  open: boolean
  onClose: () => void
  onSwap: (suggestion: SwapSuggestion, matchedExerciseId: string | null) => void
  allExercises?: Exercise[]
}) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<SwapSuggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSuggest = async () => {
    setLoading(true)
    setError(null)
    setSuggestions(null)

    try {
      const result = await requestExerciseSwap(
        { name: exercise.name, muscle_group: exercise.muscle_group, type: exercise.type },
        reason || 'No specific reason',
      )
      setSuggestions(result.suggestions)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get suggestions')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setReason('')
    setSuggestions(null)
    setError(null)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={handleClose}>
      <h3 className="text-base font-semibold mb-1">Swap: {exercise.name}</h3>
      <p className="text-xs text-[color:var(--color-muted)] mb-4">
        {exercise.muscle_group} · {exercise.type}
      </p>

      {!suggestions && (
        <>
          <label className="text-xs text-[color:var(--color-muted)] mb-1 block">
            Reason (optional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. rack taken, shoulder tweak"
            className="w-full min-h-[44px] px-3 rounded-xl bg-white/5 border border-[color:var(--color-border)] text-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-muted)] mb-3"
          />
          <Button
            variant="primary"
            onClick={handleSuggest}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Finding alternatives…
              </span>
            ) : (
              'Suggest Alternatives'
            )}
          </Button>
          <Button variant="ghost" onClick={handleClose} className="w-full mt-2">
            Cancel
          </Button>
        </>
      )}

      {error && (
        <div className="mt-3 text-sm text-red-300 bg-red-500/10 rounded-lg px-3 py-2 flex items-center justify-between">
          <span>{error}</span>
          <button className="text-xs underline min-h-[44px] px-2" onClick={handleSuggest}>
            Retry
          </button>
        </div>
      )}

      {suggestions && (
        <div className="space-y-3">
          <p className="text-xs text-[color:var(--color-muted)]">Pick a replacement for this session:</p>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSwap(s, allExercises ? findMatchingExerciseId(s.name, allExercises) : null)}
              className="w-full text-left rounded-xl border border-[color:var(--color-border)] bg-white/5 p-3 hover:bg-white/10 transition min-h-[44px]"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-xs text-[color:var(--color-muted)]">#{i + 1}</span>
              </div>
              <p className="text-xs text-[color:var(--color-muted)]">{s.rationale}</p>
              <div className="text-xs text-[color:var(--color-muted)] mt-1">
                {s.muscle_group} · {s.type}
              </div>
            </button>
          ))}
          <Button variant="ghost" onClick={handleClose} className="w-full">
            Cancel
          </Button>
        </div>
      )}
    </BottomSheet>
  )
}

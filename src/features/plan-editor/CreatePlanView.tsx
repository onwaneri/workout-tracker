import { useState, useEffect, useCallback } from 'react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/Button'
import { useView } from '@/lib/view'
import { useCreatePlan } from '@/lib/queries/plans'
import { snapshotPlan, type EditedPlan } from './snapshotPlan'
import { useQueryClient } from '@tanstack/react-query'
import { isAiFeaturesEnabled } from '@/lib/ai/featureFlag'
import { requestPlanGenerate } from '@/lib/ai/client'
import type { GeneratedPlan } from '@/lib/ai/schemas'

const MIN_DAYS = 3
const MAX_DAYS = 10

type Mode = 'ai' | 'manual'

export function CreatePlanView() {
  const setView = useView((s) => s.setView)
  const createPlan = useCreatePlan()
  const qc = useQueryClient()

  const aiEnabled = isAiFeaturesEnabled()
  const [mode, setMode] = useState<Mode>(aiEnabled ? 'ai' : 'manual')

  // Manual mode state
  const [manualName, setManualName] = useState('')
  const [manualDays, setManualDays] = useState(7)

  // AI mode state
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

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

  const handleManualCreate = useCallback(async () => {
    const name = manualName.trim()
    if (!name) return
    setSaving(true)
    try {
      await createPlan.mutateAsync({ name, dayCount: manualDays })
      setView('plan')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create plan')
      setSaving(false)
    }
  }, [manualName, manualDays, createPlan, setView])

  const handleGenerate = async () => {
    if (!prompt.trim() || generating || !isOnline) return
    setGenerating(true)
    setError(null)
    setGeneratedPlan(null)
    try {
      const plan = await requestPlanGenerate(prompt.trim())
      setGeneratedPlan(plan)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerate = useCallback(() => {
    setGeneratedPlan(null)
    setError(null)
  }, [])

  const handleSaveGenerated = async () => {
    if (!generatedPlan) return
    setSaving(true)
    setError(null)
    try {
      const { planId, planVersionId } = await createPlan.mutateAsync({
        name: generatedPlan.name,
        dayCount: generatedPlan.days.length,
      })

      // Now snapshot with the AI-generated exercises
      const editedPlan: EditedPlan = {
        planId,
        prevPlanVersionId: planVersionId,
        prevVersionNumber: 1,
        days: generatedPlan.days.map((d) => ({
          name: d.name,
          is_rest: d.is_rest,
          exercises: d.exercises.map((e) => ({
            name: e.name,
            muscle_group: e.muscle_group,
            type: e.type,
            default_sets: e.default_sets,
          })),
        })),
      }

      await snapshotPlan(editedPlan)
      await qc.invalidateQueries({ queryKey: ['plans'] })
      await qc.invalidateQueries({ queryKey: ['plan-version'] })
      await qc.invalidateQueries({ queryKey: ['workout-days'] })
      await qc.invalidateQueries({ queryKey: ['exercises'] })
      setView('plan')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save plan')
      setSaving(false)
    }
  }

  const busy = saving || createPlan.isPending

  return (
    <Screen
      title="New Plan"
      action={
        <button
          onClick={() => setView('plan')}
          className="text-sm text-[color:var(--color-muted)] min-h-[44px] px-2"
        >
          Cancel
        </button>
      }
    >
      {/* Mode toggle */}
      {aiEnabled && (
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setMode('ai')}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              mode === 'ai'
                ? 'bg-[color:var(--color-accent)] text-white'
                : 'bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-[color:var(--color-muted)]'
            }`}
          >
            AI Generate
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              mode === 'manual'
                ? 'bg-[color:var(--color-accent)] text-white'
                : 'bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-[color:var(--color-muted)]'
            }`}
          >
            Manual
          </button>
        </div>
      )}

      {mode === 'manual' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] mb-1 block">
              Plan name
            </label>
            <input
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="e.g. Push Pull Legs"
              className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-[color:var(--color-accent)]"
              onKeyDown={(e) => { if (e.key === 'Enter') handleManualCreate() }}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] mb-1 block">
              Days in cycle
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setManualDays((n) => Math.max(MIN_DAYS, n - 1))}
                className="w-11 h-11 rounded-xl border border-[color:var(--color-border)] text-lg text-[color:var(--color-muted)]"
              >
                -
              </button>
              <span className="text-lg font-semibold w-16 text-center">{manualDays}</span>
              <button
                onClick={() => setManualDays((n) => Math.min(MAX_DAYS, n + 1))}
                className="w-11 h-11 rounded-xl border border-[color:var(--color-border)] text-lg text-[color:var(--color-muted)]"
              >
                +
              </button>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleManualCreate}
            disabled={!manualName.trim() || busy}
          >
            {busy ? 'Creating...' : 'Create Plan'}
          </Button>
        </div>
      )}

      {mode === 'ai' && (
        <div className="space-y-4">
          {!generatedPlan ? (
            <>
              <div>
                <label className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] mb-1 block">
                  Describe your plan
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. 4-day upper/lower split focused on chest and back growth"
                  rows={3}
                  disabled={!isOnline || generating}
                  className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-[color:var(--color-accent)] resize-none disabled:opacity-50"
                  autoFocus
                />
              </div>

              {!isOnline && (
                <p className="text-sm text-[color:var(--color-muted)]">
                  AI generation requires an internet connection.
                </p>
              )}

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleGenerate}
                disabled={!prompt.trim() || generating || !isOnline}
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </span>
                ) : (
                  'Generate Plan'
                )}
              </Button>
            </>
          ) : (
            <>
              {/* Plan preview */}
              <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
                <h2 className="text-base font-semibold mb-3">{generatedPlan.name}</h2>
                <div className="space-y-3">
                  {generatedPlan.days.map((day, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-[color:var(--color-muted)]">Day {i + 1}</span>
                        <span className="text-sm font-medium">{day.name}</span>
                        {day.is_rest && (
                          <span className="text-xs text-[color:var(--color-muted)] bg-white/5 px-1.5 py-0.5 rounded">
                            Rest
                          </span>
                        )}
                      </div>
                      {!day.is_rest && day.exercises.length > 0 && (
                        <ul className="ml-6 space-y-0.5">
                          {day.exercises.map((ex, j) => (
                            <li key={j} className="text-sm text-[color:var(--color-muted)]">
                              {ex.name}
                              <span className="text-xs ml-1 opacity-60">
                                {ex.muscle_group} · {ex.default_sets}s
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={handleRegenerate}
                  disabled={busy}
                >
                  Regenerate
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleSaveGenerated}
                  disabled={busy}
                >
                  {busy ? 'Creating...' : 'Create Plan'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 text-sm text-red-300 bg-red-500/10 rounded-xl px-3 py-2">
          {error}
        </div>
      )}
    </Screen>
  )
}

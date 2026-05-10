import { useEffect, useMemo, useState } from 'react'
import { Screen } from '@/components/Screen'
import { useActivePlanVersion, useWorkoutDays, usePlans, useSwitchActivePlan } from '@/lib/queries/plans'
import { useAllExercises } from '@/lib/queries/exercises'
import { buildEditedPlanFromDb, snapshotPlan, type EditedDay, type EditedPlan } from './snapshotPlan'
import { useQueryClient } from '@tanstack/react-query'
import { DayEditor } from './DayEditor'
import { isAiFeaturesEnabled } from '@/lib/ai/featureFlag'
import { AiPlanChat } from './AiPlanChat'
import { applyAiDiff } from './applyAiDiff'
import type { PlanEditAction } from '@/lib/ai/schemas'
import { useView } from '@/lib/view'

const MIN_DAYS = 3
const MAX_DAYS = 10

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', color: 'var(--color-muted)' }}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

export function PlanEditorView() {
  const qc = useQueryClient()
  const plans = usePlans()
  const pv = useActivePlanVersion()
  const days = useWorkoutDays(pv.data?.id)
  const allExercises = useAllExercises()
  const switchPlan = useSwitchActivePlan()
  const setView = useView((s) => s.setView)

  const allLoaded = !!pv.data && !!days.data && !!allExercises.data

  const [draft, setDraft] = useState<EditedPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  type Exercise = NonNullable<typeof allExercises.data>[number]
  const exercisesByDay = useMemo(() => {
    const exMap = new Map<string, Exercise[]>()
    if (allExercises.data && days.data) {
      const dayIdSet = new Set(days.data.map((d) => d.id))
      for (const e of allExercises.data) {
        if (!dayIdSet.has(e.workout_day_id)) continue
        const list = exMap.get(e.workout_day_id) ?? []
        list.push(e)
        exMap.set(e.workout_day_id, list)
      }
    }
    return exMap
  }, [allExercises.data, days.data])

  useEffect(() => {
    if (allLoaded && pv.data && days.data && !draft) {
      setDraft(
        buildEditedPlanFromDb(
          pv.data.plan_id,
          pv.data.id,
          pv.data.version_number,
          days.data,
          exercisesByDay as Map<string, never[]>,
        ),
      )
    }
  }, [allLoaded, pv.data, days.data, draft, exercisesByDay])

  if (pv.isLoading || days.isLoading || allExercises.isLoading || !draft) {
    return (
      <Screen title="Plan" eyebrow="Your blueprint">
        <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>Loading…</p>
      </Screen>
    )
  }

  const activePlanId = pv.data?.plan_id ?? null

  const handleSwitchPlan = async (planId: string) => {
    if (planId === activePlanId) return
    if (draft && !window.confirm('Switch plans? Unsaved changes will be lost.')) return
    setDraft(null)
    setSavedMsg(null)
    setOpenIdx(null)
    await switchPlan.mutateAsync(planId)
  }

  const updateDay = (idx: number, next: EditedDay) => {
    setDraft((d) => (d ? { ...d, days: d.days.map((x, i) => (i === idx ? next : x)) } : d))
  }

  const moveDay = (from: number, to: number) => {
    setDraft((d) => {
      if (!d) return d
      if (to < 0 || to >= d.days.length) return d
      const next = d.days.slice()
      const [m] = next.splice(from, 1)
      next.splice(to, 0, m)
      return { ...d, days: next }
    })
  }

  const addDay = () => {
    setDraft((d) => {
      if (!d || d.days.length >= MAX_DAYS) return d
      const n = d.days.length + 1
      const newDays = [...d.days, { name: `Day ${n}`, is_rest: false, exercises: [] }]
      setOpenIdx(newDays.length - 1)
      return { ...d, days: newDays }
    })
  }

  const removeDay = (idx: number) => {
    setDraft((d) => {
      if (!d || d.days.length <= MIN_DAYS) return d
      setOpenIdx(null)
      return { ...d, days: d.days.filter((_, i) => i !== idx) }
    })
  }

  const onSave = async () => {
    if (!draft) return
    setSaving(true)
    setSavedMsg(null)
    try {
      await snapshotPlan(draft)
      await qc.invalidateQueries({ queryKey: ['plans'] })
      await qc.invalidateQueries({ queryKey: ['plan-version'] })
      await qc.invalidateQueries({ queryKey: ['workout-days'] })
      await qc.invalidateQueries({ queryKey: ['exercises'] })
      setSavedMsg('Saved as new plan version.')
      setDraft(null)
    } catch (e) {
      setSavedMsg(`Save failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  const busy = switchPlan.isPending

  return (
    <Screen
      title="Plan"
      eyebrow="Your blueprint"
      action={
        <button
          onClick={onSave}
          disabled={saving || busy}
          style={{
            minHeight: 36,
            padding: '0 16px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--color-accent)',
            color: 'var(--color-accent-ink)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            cursor: saving || busy ? 'default' : 'pointer',
            opacity: saving || busy ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      }
    >
      {/* Plan switcher */}
      <div style={{ overflowX: 'auto', marginBottom: 24, paddingBottom: 2, display: 'flex', gap: 8 }}>
        {(plans.data ?? []).map((p) => {
          const active = p.id === activePlanId
          return (
            <button
              key={p.id}
              onClick={() => handleSwitchPlan(p.id)}
              disabled={busy}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: 20,
                border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: active ? 'var(--color-accent)' : 'transparent',
                color: active ? 'var(--color-accent-ink)' : 'var(--color-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: active ? 600 : 400,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {p.name}
            </button>
          )
        })}
        <button
          onClick={() => setView('create-plan')}
          style={{
            flexShrink: 0,
            padding: '6px 14px',
            borderRadius: 20,
            border: '1px dashed var(--color-border)',
            background: 'transparent',
            color: 'var(--color-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          + New plan
        </button>
      </div>

      {/* Cycle description */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>
        Rolling {draft.days.length}-day cycle
      </div>

      {savedMsg && (
        <div style={{
          marginBottom: 16, fontSize: 13,
          borderRadius: 10, border: '1px solid var(--color-border)',
          background: 'var(--color-surface)', padding: '10px 14px',
          fontFamily: 'var(--font-mono)', color: 'var(--color-muted)',
        }}>
          {savedMsg}
        </div>
      )}

      {/* Day rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {draft.days.map((d, i) => {
          const isOpen = openIdx === i
          const exCount = d.exercises.length
          const estMin = d.is_rest ? null : Math.round(exCount * 2.5 * d.exercises.reduce((acc, e) => acc + e.default_sets, 0) / Math.max(exCount, 1) + exCount * 1.5)

          return (
            <div key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
              {/* Row header — tappable to expand */}
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : i)}
                style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: '44px 1fr auto',
                  alignItems: 'center',
                  gap: 14,
                  padding: '16px 0',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderTop: i === 0 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                {/* D1 label */}
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: d.is_rest ? 'var(--color-muted)' : 'var(--color-accent)',
                }}>
                  D{i + 1}
                </div>

                {/* Name + meta */}
                <div>
                  <div style={{ fontWeight: 500, fontSize: 15, color: 'var(--color-text)' }}>
                    {d.name}
                    {d.is_rest && (
                      <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        · Rest
                      </span>
                    )}
                  </div>
                  {!d.is_rest && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', marginTop: 3 }}>
                      {exCount} exercise{exCount !== 1 ? 's' : ''}{estMin != null && estMin > 0 ? ` · ~${estMin} min` : ''}
                    </div>
                  )}
                </div>

                {/* Chevron */}
                <ChevronIcon open={isOpen} />
              </button>

              {/* Expanded editor */}
              {isOpen && (
                <div style={{ paddingBottom: 20 }}>
                  <DayEditor
                    day={d}
                    dayNumber={i + 1}
                    onChange={(next) => updateDay(i, next)}
                    onMoveUp={() => moveDay(i, i - 1)}
                    onMoveDown={() => moveDay(i, i + 1)}
                    onRemove={draft.days.length > MIN_DAYS ? () => removeDay(i) : undefined}
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* Add day */}
        <button
          type="button"
          onClick={addDay}
          disabled={draft.days.length >= MAX_DAYS}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '16px 0',
            border: 'none',
            borderBottom: '1px dashed var(--color-border)',
            background: 'none',
            color: draft.days.length >= MAX_DAYS ? 'var(--color-faint)' : 'var(--color-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.04em',
            cursor: draft.days.length >= MAX_DAYS ? 'default' : 'pointer',
          }}
        >
          + Add day
          <span style={{ fontSize: 10, opacity: 0.6 }}>({draft.days.length}/{MAX_DAYS})</span>
        </button>
      </div>

      <p style={{ marginTop: 20, fontSize: 11, color: 'var(--color-faint)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
        Saving creates a new plan version. In-progress sessions stay on the previous version.
      </p>

      {isAiFeaturesEnabled() && (
        <AiPlanChat
          draft={draft}
          onApplyDiff={(actions: PlanEditAction[]) => {
            try {
              const updated = applyAiDiff(draft, actions)
              setDraft(updated)
            } catch {
              // diff application failure is non-fatal
            }
          }}
        />
      )}
    </Screen>
  )
}

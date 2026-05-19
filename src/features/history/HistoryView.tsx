import { lazy, Suspense, useMemo, useState } from 'react'
import { Screen } from '@/components/Screen'
import { useAllExercises, resolveExerciseLineage } from '@/lib/queries/exercises'
import { useExerciseHistory } from '@/lib/queries/sessions'
import { useActivePlanVersion, useWorkoutDays } from '@/lib/queries/plans'
import { fmtDate, fmtDuration, fmtWeight } from '@/lib/format'
import { avgRestMs, totalRestMs } from '@/lib/stats/rest'
import { PastSessionsList } from './PastSessionsList'

const ExerciseChart = lazy(() => import('./ExerciseChart').then((m) => ({ default: m.ExerciseChart })))

type HistoryGroup = { id: string; name: string; ids: string[] }
type Tab = 'sessions' | 'exercises'

const TABS: Tab[] = ['sessions', 'exercises']

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6"/>
    </svg>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: 'var(--color-muted)',
      paddingTop: 20, paddingBottom: 10,
    }}>
      {children}
    </div>
  )
}

function ExerciseRow({ group, first, onSelect }: { group: HistoryGroup; first: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      style={{
        display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
        padding: '16px 0',
        borderTop: first ? '1px solid var(--color-border)' : 'none',
        borderBottom: '1px solid var(--color-border)',
        borderLeft: 'none', borderRight: 'none',
        background: 'transparent',
        cursor: 'pointer', textAlign: 'left', width: '100%',
      }}
    >
      <span style={{ fontWeight: 500, fontSize: 15 }}>{group.name}</span>
      <span style={{ color: 'var(--color-muted)' }}><ArrowIcon /></span>
    </button>
  )
}

export function HistoryView() {
  const allEx = useAllExercises()
  const pv = useActivePlanVersion()
  const days = useWorkoutDays(pv.data?.id)
  const [selectedGroup, setSelectedGroup] = useState<HistoryGroup | null>(null)
  const [tab, setTab] = useState<Tab>('sessions')

  const currentPlanExerciseIds = useMemo(() => {
    if (!allEx.data || !days.data) return new Set<string>()
    const dayIds = new Set(days.data.map((d) => d.id))
    return new Set(allEx.data.filter((e) => dayIds.has(e.workout_day_id)).map((e) => e.id))
  }, [allEx.data, days.data])

  const { activeGroups, inactiveGroups } = useMemo(() => {
    if (!allEx.data) return { activeGroups: [], inactiveGroups: [] }
    const lineageCache = new Map<string, string[]>()
    const getLineage = (id: string) => {
      if (!lineageCache.has(id)) lineageCache.set(id, resolveExerciseLineage(id, allEx.data))
      return lineageCache.get(id)!
    }
    const groupsByRoot = new Map<string, { id: string; name: string; ids: Set<string>; latestCreatedAt: string }>()
    for (const e of allEx.data) {
      const lineage = getLineage(e.id)
      const root = lineage[lineage.length - 1] ?? e.id
      const existing = groupsByRoot.get(root)
      if (!existing) {
        groupsByRoot.set(root, { id: e.id, name: e.name, ids: new Set(lineage), latestCreatedAt: e.created_at })
      } else {
        for (const id of lineage) existing.ids.add(id)
        if (e.created_at > existing.latestCreatedAt) {
          existing.id = e.id; existing.name = e.name; existing.latestCreatedAt = e.created_at
        }
      }
    }
    const groupsByName = new Map<string, { id: string; name: string; ids: Set<string>; latestCreatedAt: string }>()
    for (const group of groupsByRoot.values()) {
      const key = group.name.trim().toLowerCase()
      const existing = groupsByName.get(key)
      if (!existing) {
        groupsByName.set(key, { id: group.id, name: group.name, ids: new Set(group.ids), latestCreatedAt: group.latestCreatedAt })
      } else {
        for (const id of group.ids) existing.ids.add(id)
        if (group.latestCreatedAt > existing.latestCreatedAt) {
          existing.id = group.id; existing.name = group.name; existing.latestCreatedAt = group.latestCreatedAt
        }
      }
    }
    const active: HistoryGroup[] = []
    const inactive: HistoryGroup[] = []
    for (const g of groupsByName.values()) {
      const ids = Array.from(g.ids).sort()
      const isActive = ids.some((id) => currentPlanExerciseIds.has(id))
      if (isActive) {
        active.push({ id: g.id, name: g.name, ids })
      } else {
        inactive.push({ id: g.id, name: g.name, ids })
      }
    }
    active.sort((a, b) => a.name.localeCompare(b.name))
    inactive.sort((a, b) => a.name.localeCompare(b.name))
    return { activeGroups: active, inactiveGroups: inactive }
  }, [allEx.data, currentPlanExerciseIds])

  const hist = useExerciseHistory(selectedGroup?.ids ?? [])

  if (selectedGroup) {
    return (
      <Screen
        title={selectedGroup.name}
        eyebrow="Exercise history"
        action={
          <button
            onClick={() => setSelectedGroup(null)}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ← Back
          </button>
        }
      >
        <div className="hidden md:block mb-6">
          <Suspense fallback={<div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--color-muted)' }}>Loading chart…</div>}>
            <ExerciseChart sets={hist.data ?? []} />
          </Suspense>
        </div>

        {hist.data && hist.data.length > 0 ? (
          <>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', marginBottom: 14 }}>
              Avg rest {fmtDuration(avgRestMs(hist.data))} · Total rest {fmtDuration(totalRestMs(hist.data))}
            </div>
            <div style={{ borderRadius: 16, border: '1px solid var(--color-border)', background: 'var(--color-surface)', overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto auto auto',
                gap: 12, padding: '10px 16px',
                borderBottom: '1px solid var(--color-border)',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted)',
              }}>
                <span>Date</span><span>Weight</span><span>Reps</span><span>RPE</span><span>Rest</span>
              </div>
              {hist.data.map((s, i) => (
                <div key={s.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto auto auto',
                  gap: 12, padding: '12px 16px', alignItems: 'center',
                  borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                  fontFamily: 'var(--font-mono)', fontSize: 13,
                }}>
                  <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>{fmtDate(s.logged_at)}</span>
                  <span>{fmtWeight(s.weight)}</span>
                  <span>{s.reps ?? '—'}</span>
                  <span style={{ color: 'var(--color-muted)' }}>{s.rpe ?? '—'}</span>
                  <span style={{ color: 'var(--color-muted)' }}>{s.rest_ms != null ? fmtDuration(s.rest_ms) : '—'}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>No sets logged yet.</p>
        )}
      </Screen>
    )
  }

  return (
    <Screen title="Log" eyebrow="The receipts">
      {/* Tab strip */}
      <div style={{ display: 'inline-flex', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: 3, marginBottom: 20, gap: 2 }}>
        {TABS.map((t) => {
          const active = tab === t
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                minHeight: 34, padding: '0 14px', borderRadius: 8, border: 'none',
                background: active ? 'var(--color-accent)' : 'transparent',
                color: active ? 'var(--color-accent-ink)' : 'var(--color-muted)',
                fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                fontWeight: active ? 600 : 400, cursor: 'pointer',
              }}
            >
              {t === 'sessions' ? 'Sessions' : 'Exercises'}
            </button>
          )
        })}
      </div>

      {tab === 'sessions' ? (
        <PastSessionsList />
      ) : activeGroups.length === 0 && inactiveGroups.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>No exercises yet.</p>
      ) : (
        <>
          {activeGroups.length > 0 && (
            <>
              <SectionLabel>In your plan</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {activeGroups.map((e, i) => (
                  <ExerciseRow key={e.id} group={e} first={i === 0} onSelect={() => setSelectedGroup(e)} />
                ))}
              </div>
            </>
          )}
          {inactiveGroups.length > 0 && (
            <>
              <SectionLabel>Past exercises</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {inactiveGroups.map((e, i) => (
                  <ExerciseRow key={e.id} group={e} first={i === 0} onSelect={() => setSelectedGroup(e)} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Screen>
  )
}
